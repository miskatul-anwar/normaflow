import { useState } from 'react';
import { Download, FileText, CheckCircle, AlertCircle, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadMarkdownAsPdf } from '../../utils/markdownPdf';

interface Relation {
  name?: string;
  attributes?: string[];
  primaryKey?: string[];
  foreignKeys?: Array<{ attributes: string[]; references?: { table?: string } }>;
}

interface FD {
  lhs: string[] | string;
  rhs: string;
  confidence?: number;
}

interface ReportResults {
  stats?: {
    originalRows?: number;
    cleanedRows?: number;
    dataRetention?: string;
    attributes?: number;
    functionalDependencies?: number;
    candidateKeys?: number;
    processDuration?: string;
    performanceMetrics?: {
      totalDuration?: string;
      checkpoints?: Array<{ name: string; time: number; memory?: number }>;
      memorySource?: string;
      cacheHitRate?: number | null;
      cacheHits?: number;
      cacheMisses?: number;
    };
  };
  duration?: string;
  selectedOperations?: string[];
  losslessCheck?: { isLossless?: boolean };
  dependencyPreservation?: { isPreserved?: boolean };
  tables?: Array<{ losslessCheck?: { isLossless?: boolean }; dependencyPreservation?: { isPreserved?: boolean } }>;
  qualityAssessment?: { score: number; issues?: string[]; recommendations?: string[] };
}

interface ReportViewProps {
  results: ReportResults | null;
  /** The generated Markdown report; the Download button turns it into a PDF. */
  markdown: string;
  fdData: FD[];
  levels: Array<{ id: string; relations: Relation[] }>;
  filename?: string;
}

export const Card = ({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) => (
  <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {right}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

export const Badge = ({ ok, children }: { ok: boolean | undefined; children: React.ReactNode }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
      ok === undefined ? 'bg-gray-100 text-gray-700' : ok ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800'
    }`}
  >
    {ok === undefined ? null : ok ? <CheckCircle className="size-3.5" aria-hidden /> : <AlertCircle className="size-3.5" aria-hidden />}
    {children}
  </span>
);

/** The normal forms the run reached and the relations at each level. */
export function NormalizationJourney({ levels }: { levels: Array<{ id: string; relations: Relation[] }> }) {
  if (levels.length === 0) return null;
  return (
    <Card title="Normalization journey">
      <ol className="space-y-4">
        {levels.map((lvl, i) => (
          <li key={lvl.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-7 min-w-[3.5rem] items-center justify-center rounded-full bg-teal-700 px-2.5 text-xs font-semibold text-white">{lvl.id}</span>
              {i < levels.length - 1 && <span className="mt-1 w-px flex-1 bg-gray-200" />}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="text-sm font-medium text-gray-900">{lvl.relations.length} relation{lvl.relations.length === 1 ? '' : 's'}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {lvl.relations.slice(0, 24).map((r, k) => (
                  <span key={k} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-800" title={(r.attributes ?? []).join(', ')}>
                    {r.name ?? `R${k + 1}`}
                    <span className="text-gray-500"> · {r.attributes?.length ?? 0} cols</span>
                    {r.primaryKey?.length ? <span className="text-amber-700"> · PK {r.primaryKey.join('+')}</span> : null}
                  </span>
                ))}
                {lvl.relations.length > 24 && <span className="text-xs text-gray-500">+{lvl.relations.length - 24} more</span>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** The analysis report as real components. The Markdown is only the source for the PDF download. */
export function ReportView({ results, markdown, fdData, levels, filename = 'normalization_report' }: ReportViewProps) {
  const [busy, setBusy] = useState(false);
  const stats = results?.stats ?? {};
  const perf = stats.performanceMetrics ?? {};
  const checkpoints = perf.checkpoints ?? [];
  const maxTime = Math.max(1, ...checkpoints.map(c => c.time));
  const hasMemory = checkpoints.some(c => typeof c.memory === 'number' && c.memory > 0);
  const memNote =
    perf.memorySource === 'estimate'
      ? 'estimated size of the loaded data (this runtime does not report heap usage)'
      : 'JavaScript heap in use';
  // Multi-table runs verify each table; a single table has one verdict.
  const tableChecks = results?.tables ?? [];
  const withLossless = tableChecks.filter(t => t.losslessCheck);
  const withPreserved = tableChecks.filter(t => t.dependencyPreservation);
  const lossless = tableChecks.length ? (withLossless.length ? withLossless.every(t => t.losslessCheck?.isLossless) : undefined) : results?.losslessCheck?.isLossless;
  const preserved = tableChecks.length ? (withPreserved.length ? withPreserved.every(t => t.dependencyPreservation?.isPreserved) : undefined) : results?.dependencyPreservation?.isPreserved;
  const losslessNote = withLossless.length ? ` (${withLossless.filter(t => t.losslessCheck?.isLossless).length}/${withLossless.length} tables)` : '';
  const preservedNote = withPreserved.length ? ` (${withPreserved.filter(t => t.dependencyPreservation?.isPreserved).length}/${withPreserved.length} tables)` : '';
  const quality = results?.qualityAssessment;
  const ops = results?.selectedOperations ?? [];
  const topFDs = [...fdData].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 8);

  const rows: Array<[string, string]> = [
    ['Rows (original → cleaned)', stats.originalRows != null ? `${stats.originalRows} → ${stats.cleanedRows ?? stats.originalRows}` : '—'],
    ['Data retained', stats.dataRetention ?? (stats.originalRows ? `${(((stats.cleanedRows ?? stats.originalRows) / stats.originalRows) * 100).toFixed(1)}%` : '—')],
    ['Attributes', String(stats.attributes ?? '—')],
    ['Functional dependencies', String(stats.functionalDependencies ?? fdData.length)],
    ['Candidate keys', String(stats.candidateKeys ?? '—')],
    ['Duration', results?.duration ?? stats.processDuration ?? '—'],
  ];

  const download = async () => {
    setBusy(true);
    try {
      await downloadMarkdownAsPdf(markdown, `${filename}.pdf`, 'NormaFlow report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-teal-700" aria-hidden />
          <h2 className="text-base font-semibold text-gray-900">Report</h2>
        </div>
        <Button variant="primary" size="sm" onClick={download} disabled={busy || !markdown} title="Download the report as a PDF">
          <Download /> {busy ? 'Preparing…' : 'Download PDF'}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Run summary">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-right font-medium text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Quality checks">
          <div className="flex flex-wrap gap-2">
            <Badge ok={lossless}>{lossless === undefined ? 'Lossless join: not run' : `${lossless === false && !losslessNote ? 'Lossy decomposition' : 'Lossless join'}${losslessNote}`}</Badge>
            <Badge ok={preserved}>
              {preserved === undefined ? 'Dependency preservation: not run' : `${preserved === false && !preservedNote ? 'Dependencies lost' : 'Dependencies preserved'}${preservedNote}`}
            </Badge>
          </div>
          {quality && (
            <div className="mt-4 text-sm">
              <div className="text-gray-500">Data quality score</div>
              <div className="text-2xl font-semibold text-gray-900">{Math.round(quality.score)}<span className="text-sm text-gray-500"> / 100</span></div>
              {[...(quality.issues ?? []), ...(quality.recommendations ?? [])].slice(0, 5).map((t: string, i: number) => (
                <p key={i} className="mt-1 text-gray-700">• {t}</p>
              ))}
            </div>
          )}
        </Card>
      </div>

      <NormalizationJourney levels={levels} />

      {topFDs.length > 0 && (
        <Card title={`Strongest functional dependencies (${topFDs.length} of ${fdData.length})`}>
          <ul className="divide-y divide-gray-100 text-sm">
            {topFDs.map((fd, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="font-mono text-gray-900">
                  {(Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs)} <span className="text-gray-500">→</span> {fd.rhs}
                </span>
                <span className="text-xs text-gray-500">{((fd.confidence ?? 0) * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {checkpoints.length > 0 && (
        <Card
          title="Performance"
          right={
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <Gauge className="size-3.5" aria-hidden />
              {perf.totalDuration ?? results?.duration}
              {typeof perf.cacheHitRate === 'number' && ` · partition cache ${(perf.cacheHitRate * 100).toFixed(1)}% hits`}
            </span>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2 font-medium">Checkpoint</th>
                <th className="pb-2 font-medium">Time (ms)</th>
                {hasMemory && <th className="pb-2 text-right font-medium">Memory (MB)</th>}
              </tr>
            </thead>
            <tbody>
              {checkpoints.map((c, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3 text-gray-900">{c.name}</td>
                  <td className="w-1/2 py-1.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                        <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${Math.max(2, (c.time / maxTime) * 100)}%` }} />
                      </div>
                      <span className="w-12 text-right tabular-nums text-gray-700">{c.time}</span>
                    </div>
                  </td>
                  {hasMemory && <td className="py-1.5 text-right tabular-nums text-gray-700">{typeof c.memory === 'number' ? c.memory.toFixed(2) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {hasMemory && <p className="mt-3 text-xs text-gray-500">Memory is the {memNote}.</p>}
          {typeof perf.cacheHitRate === 'number' && (
            <p className="mt-1 text-xs text-gray-500">
              Partition cache: {perf.cacheHits} of {(perf.cacheHits ?? 0) + (perf.cacheMisses ?? 0)} partition requests during dependency mining were served from the cache.
            </p>
          )}
        </Card>
      )}

      {ops.length > 0 && (
        <Card title="Operations run">
          <div className="flex flex-wrap gap-2">
            {ops.map(o => (
              <span key={o} className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-800">{o}</span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
