import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Copy, Download, Layers, GitBranch,
  Code, Activity, Database, FileText, BarChart3, Shield, Key, Cpu
} from 'lucide-react';

import { CustomSidebar, SidebarItem } from './output/CustomSidebar';
import { FunctionalDependenciesSection } from './output/FunctionalDependenciesSection';
import { NormalFormSection } from './output/NormalFormSection';
import { CardinalitySection } from './output/CardinalitySection';
import { QualityAssuranceSection } from './output/QualityAssuranceSection';
import { KeysSection } from './output/KeysSection';
import { RelationshipsSection, KeysByTable, QualityByTable } from './output/MultiTableSections';
import { GeneratedFilesSection } from './output/GeneratedFilesSection';
import { ReportView, NormalizationJourney } from './output/ReportView';
import { ErdSection } from './output/ErdSection';
import { CodeViewer } from './output/CodeViewer';
import { Button } from '@/components/ui/button';
import type { WorkspaceTab } from '../hooks/useWorkspaceTabs';
import { loadCachedResult, saveCachedResult } from '../utils/resultCache';

export default function OutputPage({ tabId, tabs = [] }: { tabId: string; tabs?: WorkspaceTab[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Fresh results are passed along when navigating from a run; they only apply to the tab that ran.
  // Results are untyped throughout this page (the engine's result shape differs for one file and many).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = location.state as { results?: any; tabId?: string } | null;
  const results = state?.tabId === tabId ? state.results : undefined;
  /** The workspace these results came from, so several open tabs cannot be confused. */
  const sourceTab = tabs.find(t => t.id === tabId) ?? null;

  const currentDateTime = useMemo(() => {
    const now = new Date();
    return {
      formatted: now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      utc: now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
    };
  }, []);

  const safeResults = useMemo(() => {
    const isUsable = (r: any) =>
      r && r.success !== false && (r.success || r.tables || r.outputFiles);
    if (isUsable(results)) {
      saveCachedResult(results, tabId);
      return results;
    }
    return loadCachedResult(tabId);
  }, [results, tabId]);

  const isMultiTable = safeResults?.isMultiTable || false;
  const multiTables = safeResults?.tables || [];
  const crossTableRelationships = safeResults?.crossTableRelationships || [];

  const relationData = useMemo(() => {
    if (safeResults?.relations && safeResults.relations.length > 0) return safeResults.relations;
    if (multiTables.length > 0) {
      return multiTables.flatMap((t: any) => t.thirdNormalForm || []);
    }
    return [];
  }, [safeResults, multiTables]);

  const relations1NF = useMemo(() => {
    if (safeResults?.relations1NF && safeResults.relations1NF.length > 0) return safeResults.relations1NF;
    if (multiTables.length > 0) {
      return multiTables.flatMap((t: any) => t.firstNormalForm || []);
    }
    return [];
  }, [safeResults, multiTables]);

  const relations2NF = useMemo(() => {
    if (safeResults?.relations2NF && safeResults.relations2NF.length > 0) return safeResults.relations2NF;
    if (multiTables.length > 0) {
      return multiTables.flatMap((t: any) => t.secondNormalForm || []);
    }
    return [];
  }, [safeResults, multiTables]);

  const relationsBCNF = useMemo(() => {
    if (safeResults?.bcnf && safeResults.bcnf.length > 0) return safeResults.bcnf;
    if (multiTables.length > 0) {
      return multiTables.flatMap((t: any) => t.bcnf || []);
    }
    return [];
  }, [safeResults, multiTables]);

  // The ERD follows the final schema (BCNF if it ran, otherwise 3NF).
  const erdRelations = useMemo(() => {
    const final = safeResults?.relations;
    if (Array.isArray(final) && final.length > 0) return final;
    return relationsBCNF.length > 0 ? relationsBCNF : relationData;
  }, [safeResults, relationsBCNF, relationData]);

  const erdContent = safeResults?.erdContent || safeResults?.erdDiagram || '';
  const cardinalityAnalysis = safeResults?.cardinalityAnalysis || {};
  const losslessCheck = safeResults?.losslessCheck || null;
  const dependencyPreservation = safeResults?.dependencyPreservation || null;

  const fdData = useMemo(() => {
    if (safeResults?.functionalDependencies && Array.isArray(safeResults.functionalDependencies)) {
      return safeResults.functionalDependencies;
    }
    if (multiTables.length > 0) {
      return multiTables.flatMap((t: any) => (t.functionalDependencies || []).map((fd: any) => ({ ...fd, table: t.tableName })));
    }
    if (safeResults?.outputFiles && Array.isArray(safeResults.outputFiles)) {
      const fdFile = safeResults.outputFiles.find((f: any) => f?.name?.includes('functional_dependencies') && f?.type === 'json');
      if (fdFile?.content && Array.isArray(fdFile.content)) {
        return fdFile.content;
      }
    }
    return [];
  }, [safeResults, multiTables]);

  const keyData = useMemo(() => {
    if (safeResults?.candidateKeys || safeResults?.primaryKey) {
      return {
        candidateKeys: safeResults.candidateKeys?.map((k: any) => k.attributes || k) || [],
        superkeys: []
      };
    }
    if (multiTables.length > 0) {
      const keys = multiTables.flatMap((t: any) => t.candidateKeys || []);
      if (keys.length > 0) {
        return {
          candidateKeys: keys.map((k: any) => k.attributes || k),
          superkeys: []
        };
      }
    }
    if (safeResults?.outputFiles && Array.isArray(safeResults.outputFiles)) {
      const keyFile = safeResults.outputFiles.find((f: any) => f?.name?.includes('keys_analysis') && f?.type === 'json');
      return keyFile?.content || null;
    }
    return null;
  }, [safeResults, multiTables]);

  const [activeTab, setActiveTab] = useState("overview");

  const sqlFile = useMemo(() => {
    const files = safeResults?.outputFiles || [];
    const found = files.find((f: any) => f?.type === "sql");
    const rawContent = found?.content || safeResults?.sqlStatements || '';
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2);
    return { content };
  }, [safeResults]);

  const reportFile = useMemo(() => {
    const files = safeResults?.outputFiles || [];
    const found = files.find((f: any) => f?.name?.includes("report"));
    const rawContent = found?.content || safeResults?.reportMarkdown || '';
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2);
    return { content };
  }, [safeResults]);

  const sidebarItems: SidebarItem[] = [
    {
      id: "overview",
      group: "summary",
      description: "Summary of this run",
      label: "Overview",
      icon: <Activity className="w-4 h-4" />,
      hasData: true
    },
    {
      id: "normal-forms",
      group: "analysis",
      description: "1NF to BCNF relations",
      label: "Normal Forms",
      icon: <Layers className="w-4 h-4" />,
      count: (relations1NF.length || 0) + (relations2NF.length || 0) + (relationData.length || 0) + (relationsBCNF.length || 0),
      hasData: relations1NF.length > 0 || relations2NF.length > 0 || relationData.length > 0 || relationsBCNF.length > 0
    },
    {
      id: "functional-dependencies",
      group: "analysis",
      description: "Mined dependencies",
      label: "Functional Dependencies",
      icon: <GitBranch className="w-4 h-4" />,
      count: fdData.length,
      hasData: fdData.length > 0 || isMultiTable
    },
    {
      id: "cardinality",
      group: "analysis",
      description: "Links between tables",
      label: "Cardinality & Relations",
      icon: <BarChart3 className="w-4 h-4" />,
      count: crossTableRelationships.length || Object.keys(cardinalityAnalysis).length,
      hasData: crossTableRelationships.length > 0 || Object.keys(cardinalityAnalysis).length > 0
    },
    {
      id: "keys",
      group: "analysis",
      description: "Candidate keys",
      label: "Keys & Superkeys",
      icon: <Key className="w-4 h-4" />,
      hasData: Boolean(keyData) || isMultiTable
    },
    {
      id: "quality",
      group: "analysis",
      description: "Lossless and preservation",
      label: "Quality Assurance",
      icon: <Shield className="w-4 h-4" />,
      hasData: Boolean(losslessCheck || dependencyPreservation) || isMultiTable
    },
    {
      id: "erd",
      group: "generated",
      description: "Entity-relationship diagram",
      label: "ERD Diagram",
      icon: <GitBranch className="w-4 h-4" />,
      hasData: Boolean(erdContent)
    },
    {
      id: "sql",
      group: "generated",
      description: "DDL for your schema",
      label: "SQL Schema",
      icon: <Database className="w-4 h-4" />,
      hasData: Boolean(sqlFile?.content)
    },
    {
      id: "report",
      group: "generated",
      description: "Full written report",
      label: "Full Report",
      icon: <FileText className="w-4 h-4" />,
      hasData: Boolean(reportFile?.content)
    },
    {
      id: "files",
      group: "generated",
      description: "Everything generated",
      label: "Generated Files",
      icon: <Code className="w-4 h-4" />,
      count: safeResults?.outputFiles?.length || 0,
      hasData: Boolean(safeResults?.outputFiles?.length)
    }
  ];

  if (!safeResults) {
    return (
      <div className="nf-output-page flex items-center justify-center p-4" style={{ background: "#e5e7eb" }}>
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 mx-auto mb-4">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {sourceTab ? `No results yet for “${sourceTab.title}”` : 'No Output Available'}
          </h3>
          <p className="text-gray-600 mb-6">
            Run this workspace's pipeline to see its results here. Use the tabs above to switch to another workspace.
          </p>
          <Button variant="primary" className="w-full" onClick={() => navigate('/')}>
            <ArrowLeft />
            Back to workflow
          </Button>
        </div>
      </div>
    );
  }

  return (
    // Same shell as the pipeline page: header card, sidebar card, content panel.
    <div
      className="nf-shell nf-output-page"
      style={{ ['--nf-palette-width' as string]: '300px' }}
    >
      <header className="nf-header">
        <div className="flex w-full items-center justify-between gap-3 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icon.png" alt="NormaFlow" title="NormaFlow" className="h-9 w-9 shrink-0 object-contain drop-shadow-xs" />
            <Button onClick={() => navigate('/')} title="Return to the workflow canvas" aria-label="Back to the workflow canvas">
              <ArrowLeft />
              <span>Back to workflow</span>
            </Button>
          </div>
          <div className="min-w-0 text-right leading-tight">
            <h1 className="truncate text-sm font-semibold text-gray-900">
              Analysis results{isMultiTable ? ` · ${multiTables.length} tables` : ''}
            </h1>
            <p className="truncate text-xs tabular-nums text-gray-500">Opened {currentDateTime.utc}</p>
          </div>
        </div>
      </header>

      <aside className="nf-palette" aria-label="Result sections">
        <CustomSidebar items={sidebarItems} activeTab={activeTab} onTabChange={setActiveTab} />
      </aside>

      <main className="nf-canvas-panel">
        <div key={activeTab} className="nf-fade-in min-h-0 flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {(isMultiTable
                  ? [
                      { label: 'Dataset tables', value: String(multiTables.length) },
                      { label: 'Cross-table foreign keys', value: String(crossTableRelationships.length) },
                      { label: 'Functional dependencies', value: String(safeResults.stats?.functionalDependencies || fdData.length) },
                      { label: 'Pipeline duration', value: safeResults.duration || '—' },
                    ]
                  : [
                      { label: 'Rows', value: String(safeResults.stats?.cleanedRows ?? safeResults.stats?.originalRows ?? '—') },
                      { label: 'Columns', value: String(safeResults.stats?.attributes ?? '—') },
                      { label: 'Functional dependencies', value: String(safeResults.stats?.functionalDependencies || fdData.length) },
                      { label: 'Pipeline duration', value: safeResults.duration || '—' },
                    ]
                ).map(card => (
                  <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow">
                    <div className="text-xs font-medium text-gray-500">{card.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-teal-700">{card.value}</div>
                  </div>
                ))}
              </div>

              {!isMultiTable && (
                <NormalizationJourney
                  levels={[
                    { id: '1NF', relations: relations1NF },
                    { id: '2NF', relations: relations2NF },
                    { id: '3NF', relations: relationData },
                    { id: 'BCNF', relations: relationsBCNF },
                  ].filter(l => l.relations.length > 0).map(({ id, relations }) => ({ id, relations }))}
                />
              )}

              {/* Multi-Table NER Tags & Relational Overview */}
              {isMultiTable && multiTables.length > 0 && (
                <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-5 py-3">
                    <Cpu className="size-4 text-teal-600" aria-hidden />
                    <h3 className="text-sm font-semibold text-gray-900">Column classification</h3>
                    <span className="text-xs text-gray-500">entity type detected for every column</span>
                  </div>
                  <div className="space-y-3 p-4">
                    {multiTables.map((t: any) => (
                      <div key={t.tableName} className="rounded-lg border border-gray-200 p-3 transition-shadow hover:shadow-sm">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-sm font-semibold text-teal-800">{t.tableName} <span className="font-normal text-gray-400">({t.fileName})</span></span>
                          <span className="text-xs text-gray-500">{t.rowCount} rows • {t.headers.length} columns</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {t.nerTags?.map((tag: any) => (
                            <span
                              key={tag.columnName}
                              className={`rounded-md border px-2 py-0.5 font-mono text-xs font-medium ${
                                tag.entityType === 'PRIMARY_KEY_ID' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                tag.entityType === 'FOREIGN_KEY_REF' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                tag.entityType === 'EMAIL' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                tag.entityType === 'CURRENCY_PRICE' ? 'bg-teal-100 text-teal-800 border-teal-300' :
                                'bg-gray-100 text-gray-700 border-gray-300'
                              }`}
                              title={tag.description}
                            >
                              {tag.columnName} : <span className="font-bold">{tag.entityType}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>
          )}

          {activeTab === 'normal-forms' && (
            <NormalFormSection
              relations1NF={relations1NF}
              relations2NF={relations2NF}
              relations3NF={relationData}
              relationsBCNF={relationsBCNF}
            />
          )}

          {activeTab === 'functional-dependencies' && (
            <FunctionalDependenciesSection fdData={fdData} />
          )}

          {activeTab === 'cardinality' && (
            isMultiTable
              ? <RelationshipsSection relationships={crossTableRelationships} />
              : <CardinalitySection cardinalityAnalysis={cardinalityAnalysis} />
          )}

          {activeTab === 'keys' && (
            isMultiTable ? <KeysByTable tables={multiTables} /> : <KeysSection keyData={keyData} />
          )}

          {activeTab === 'quality' && (
            isMultiTable
              ? <QualityByTable tables={multiTables} />
              : <QualityAssuranceSection losslessCheck={losslessCheck} dependencyPreservation={dependencyPreservation} />
          )}

          {activeTab === 'erd' && erdContent && (
            <ErdSection relations={erdRelations} erdContent={erdContent} />
          )}

          {activeTab === 'sql' && sqlFile?.content && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900">
                  SQL Data Definition Language (DDL) {isMultiTable && '(Consolidated Multi-Table)'}
                </h4>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => navigator.clipboard.writeText(sqlFile.content)}>
                    <Copy /> Copy SQL
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([sqlFile.content], { type: 'application/sql' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'schema.sql';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download /> Download .sql
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <CodeViewer code={sqlFile.content} language="sql" />
              </div>
            </div>
          )}

          {activeTab === 'report' && reportFile?.content && (
            <ReportView
              results={safeResults}
              markdown={reportFile.content}
              fdData={fdData}
              levels={[
                { id: '1NF', relations: relations1NF },
                { id: '2NF', relations: relations2NF },
                { id: '3NF', relations: relationData },
                { id: 'BCNF', relations: relationsBCNF },
              ].filter(l => l.relations.length > 0)}
            />
          )}

          {activeTab === 'files' && safeResults?.outputFiles && (
            <GeneratedFilesSection outputFiles={safeResults.outputFiles} />
          )}
        </div>
      </main>
    </div>
  );
}