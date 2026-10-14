import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  CheckCircle, ArrowLeft, Copy, Download, Layers, GitBranch,
  Code, Activity, Database, FileText, BarChart3, Shield, Key, Cpu, Table
} from 'lucide-react';
import 'github-markdown-css/github-markdown-light.css';

import { CustomSidebar, SidebarItem } from './output/CustomSidebar';
import { FunctionalDependenciesSection } from './output/FunctionalDependenciesSection';
import { NormalFormSection } from './output/NormalFormSection';
import { CardinalitySection } from './output/CardinalitySection';
import { QualityAssuranceSection } from './output/QualityAssuranceSection';
import { KeysSection } from './output/KeysSection';
import { GeneratedFilesSection } from './output/GeneratedFilesSection';
import { MarkdownRenderer } from './output/MarkdownRenderer';
import { SVGPreviewSection } from './output/SVGPreviewSection';
import { loadCachedResult, saveCachedResult } from '../utils/resultCache';

export default function OutputPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { results } = location.state || {};

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
      saveCachedResult(results);
      return results;
    }
    return loadCachedResult();
  }, [results]);

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

  const erdContent = safeResults?.erdContent || safeResults?.erdDiagram || '';
  const cardinalityAnalysis = safeResults?.cardinalityAnalysis || {};
  const losslessCheck = safeResults?.losslessCheck || null;
  const dependencyPreservation = safeResults?.dependencyPreservation || null;

  const fdData = useMemo(() => {
    if (safeResults?.functionalDependencies && Array.isArray(safeResults.functionalDependencies)) {
      return safeResults.functionalDependencies;
    }
    if (multiTables.length > 0) {
      return multiTables.flatMap((t: any) => t.functionalDependencies || []);
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
      label: "Overview",
      icon: <Activity className="w-4 h-4" />,
      hasData: true
    },
    {
      id: "normal-forms",
      label: "Normal Forms",
      icon: <Layers className="w-4 h-4" />,
      count: (relations1NF.length || 0) + (relations2NF.length || 0) + (relationData.length || 0),
      hasData: relations1NF.length > 0 || relations2NF.length > 0 || relationData.length > 0
    },
    {
      id: "functional-dependencies",
      label: "Functional Dependencies",
      icon: <GitBranch className="w-4 h-4" />,
      count: fdData.length,
      hasData: fdData.length > 0 || isMultiTable
    },
    {
      id: "cardinality",
      label: "Cardinality & Relations",
      icon: <BarChart3 className="w-4 h-4" />,
      count: crossTableRelationships.length || Object.keys(cardinalityAnalysis).length,
      hasData: crossTableRelationships.length > 0 || Object.keys(cardinalityAnalysis).length > 0
    },
    {
      id: "keys",
      label: "Keys & Superkeys",
      icon: <Key className="w-4 h-4" />,
      hasData: Boolean(keyData) || isMultiTable
    },
    {
      id: "quality",
      label: "Quality Assurance",
      icon: <Shield className="w-4 h-4" />,
      hasData: Boolean(losslessCheck || dependencyPreservation) || isMultiTable
    },
    {
      id: "erd",
      label: "ERD Diagram",
      icon: <GitBranch className="w-4 h-4" />,
      hasData: Boolean(erdContent)
    },
    {
      id: "sql",
      label: "SQL Schema",
      icon: <Database className="w-4 h-4" />,
      hasData: Boolean(sqlFile?.content)
    },
    {
      id: "report",
      label: "Full Report",
      icon: <FileText className="w-4 h-4" />,
      hasData: Boolean(reportFile?.content)
    },
    {
      id: "files",
      label: "Generated Files",
      icon: <Code className="w-4 h-4" />,
      count: safeResults?.outputFiles?.length || 0,
      hasData: Boolean(safeResults?.outputFiles?.length)
    }
  ];

  if (!safeResults) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
            No Output Available
          </h3>
          <p className="text-gray-600 mb-6" style={{ fontFamily: "'Inter', sans-serif" }}>
            Please execute a normalization workflow from the main application before viewing outputs.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Workflow Canvas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 text-gray-700 hover:text-teal-600 flex items-center justify-center transition-all shadow-xs active:scale-95 group"
            title="Return to Main Workflow Canvas"
            aria-label="Back to Main Application"
          >
            <ArrowLeft className="w-4.5 h-4.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
              NormaFlow Analysis Results {isMultiTable && '(Multi-CSV Dataset)'}
            </h1>
            <p className="text-xs text-gray-500 font-mono">
              Generated: {currentDateTime.utc}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isMultiTable && (
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Table className="w-3.5 h-3.5" /> {multiTables.length} Tables Processed
            </span>
          )}
          <span className="bg-teal-100 text-teal-800 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Complete Pipeline Executed
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 flex-shrink-0">
          <CustomSidebar items={sidebarItems} activeTab={activeTab} onTabChange={setActiveTab} />
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="text-sm text-gray-500">Dataset Tables</div>
                  <div className="text-2xl font-bold text-teal-600 mt-1">{isMultiTable ? multiTables.length : 1}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="text-sm text-gray-500">Cross-Table FKs</div>
                  <div className="text-2xl font-bold text-teal-600 mt-1">{crossTableRelationships.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="text-sm text-gray-500">Total FDs Discovered</div>
                  <div className="text-2xl font-bold text-teal-600 mt-1">{safeResults.stats?.functionalDependencies || fdData.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="text-sm text-gray-500">Pipeline Duration</div>
                  <div className="text-2xl font-bold text-green-600 mt-1">
                    {safeResults.duration || '0.5s'}
                  </div>
                </div>
              </div>

              {/* Multi-Table NER Tags & Relational Overview */}
              {isMultiTable && multiTables.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu className="w-5 h-5 text-teal-600" />
                    <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
                      Named Entity Recognition (NER) & Schema Classification
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {multiTables.map((t: any) => (
                      <div key={t.tableName} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-teal-800 font-mono text-sm">{t.tableName} ({t.fileName})</span>
                          <span className="text-xs text-gray-500">{t.rowCount} rows • {t.headers.length} columns</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {t.nerTags?.map((tag: any) => (
                            <span
                              key={tag.columnName}
                              className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
                                tag.entityType === 'PRIMARY_KEY_ID' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                tag.entityType === 'FOREIGN_KEY_REF' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                tag.entityType === 'EMAIL' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                tag.entityType === 'CURRENCY_PRICE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
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
                </div>
              )}

              {reportFile?.content && (
                <MarkdownRenderer content={reportFile.content} filename="Executive_Summary.md" />
              )}
            </div>
          )}

          {activeTab === 'normal-forms' && (
            <NormalFormSection
              relations1NF={relations1NF}
              relations2NF={relations2NF}
              relations3NF={relationData}
            />
          )}

          {activeTab === 'functional-dependencies' && (
            <FunctionalDependenciesSection fdData={fdData} />
          )}

          {activeTab === 'cardinality' && (
            <CardinalitySection cardinalityAnalysis={cardinalityAnalysis} />
          )}

          {activeTab === 'keys' && (
            <KeysSection keyData={keyData} />
          )}

          {activeTab === 'quality' && (
            <QualityAssuranceSection losslessCheck={losslessCheck} dependencyPreservation={dependencyPreservation} />
          )}

          {activeTab === 'erd' && erdContent && (
            <SVGPreviewSection erdContent={erdContent} />
          )}

          {activeTab === 'sql' && sqlFile?.content && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
                  SQL Data Definition Language (DDL) {isMultiTable && '(Consolidated Multi-Table)'}
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(sqlFile.content)}
                    className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-gray-700"
                  >
                    <Copy className="w-4 h-4" /> Copy SQL
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([sqlFile.content], { type: 'application/sql' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'schema.sql';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium"
                  >
                    <Download className="w-4 h-4" /> Download .sql
                  </button>
                </div>
              </div>
              <div className="p-4">
                <SyntaxHighlighter language="sql" style={oneDark} customStyle={{ borderRadius: '0.5rem', margin: 0 }}>
                  {sqlFile.content}
                </SyntaxHighlighter>
              </div>
            </div>
          )}

          {activeTab === 'report' && reportFile?.content && (
            <MarkdownRenderer content={reportFile.content} filename="normalization_report.md" />
          )}

          {activeTab === 'files' && safeResults?.outputFiles && (
            <GeneratedFilesSection outputFiles={safeResults.outputFiles} />
          )}
        </main>
      </div>
    </div>
  );
}