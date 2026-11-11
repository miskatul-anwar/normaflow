import { useMemo, useState } from 'react';
import { ArrowRight, Key, Shield, Link2, CheckCircle, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import type { CrossTableRelationship } from '../../types';
import { QualityAssuranceSection } from './QualityAssuranceSection';

const Empty = ({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) => (
  <div className="py-16 text-center text-gray-500">
    <div className="mx-auto mb-3 flex justify-center text-gray-300">{icon}</div>
    <p className="font-medium text-gray-700">{title}</p>
    <p className="mt-1 text-sm text-gray-400">{hint}</p>
  </div>
);

const pct = (n: number | undefined) => (typeof n === 'number' ? `${(n * 100).toFixed(n === 1 ? 0 : 1)}%` : '—');

const CARD_STYLE: Record<string, string> = {
  '1:1': 'bg-violet-50 text-violet-800',
  '1:N': 'bg-teal-50 text-teal-800',
  'N:M': 'bg-amber-50 text-amber-800',
};

/** Foreign keys found between the uploaded tables. */
export function RelationshipsSection({ relationships }: { relationships: CrossTableRelationship[] }) {
  if (!relationships.length) {
    return <Empty icon={<Link2 className="size-10" />} title="No links between tables" hint="No column in one file matched the key of another." />;
  }
  const counts = relationships.reduce<Record<string, number>>((m, r) => ((m[r.cardinality] = (m[r.cardinality] ?? 0) + 1), m), {});
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} className={`rounded-md px-2.5 py-1 text-xs font-medium ${CARD_STYLE[k] ?? 'bg-gray-100 text-gray-700'}`}>
            {v} × {k}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs lg:text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Foreign key</th>
              <th className="px-4 py-2.5 font-medium">References</th>
              <th className="px-4 py-2.5 font-medium">Cardinality</th>
              <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">Values matched</th>
              <th className="hidden px-4 py-2.5 text-right font-medium xl:table-cell">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {relationships.map((r, i) => {
              const from = (r.sourceColumns ?? [r.sourceColumn]).join(', ');
              const to = (r.targetColumns ?? [r.targetColumn]).join(', ');
              return (
                <tr key={i} className="transition-colors hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-mono text-gray-900 [overflow-wrap:anywhere] lg:px-4">
                    {r.sourceTable}.<span className="text-teal-700">{from}</span>
                    {r.optional && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-sans text-[10px] text-gray-500">optional</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-gray-900 [overflow-wrap:anywhere] lg:px-4">
                    <ArrowRight className="mr-2 inline size-3.5 text-gray-400" aria-hidden />
                    {r.targetTable}.<span className="text-teal-700">{to}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${CARD_STYLE[r.cardinality] ?? 'bg-gray-100 text-gray-700'}`}>{r.cardinality}</span>
                  </td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums text-gray-700 lg:table-cell">{pct(r.matchRatio)}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums text-gray-700 xl:table-cell">{pct(r.confidence)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TableLike {
  tableName: string;
  primaryKey?: string[];
  candidateKeys?: Array<{ attributes?: string[] } | string[]>;
  keyReason?: string;
  losslessCheck?: { isLossless?: boolean; details?: unknown };
  dependencyPreservation?: { isPreserved?: boolean };
}

const keyCols = (k: { attributes?: string[] } | string[]) => (Array.isArray(k) ? k : k.attributes ?? []);

/** Primary and candidate keys, one card per table. */
export function KeysByTable({ tables }: { tables: TableLike[] }) {
  if (!tables.length) return <Empty icon={<Key className="size-10" />} title="No keys found" hint="Key discovery has not run." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tables.map(t => {
        const pk = (t.primaryKey ?? []).join(', ');
        const others = (t.candidateKeys ?? []).map(keyCols).filter(k => k.join(',') !== (t.primaryKey ?? []).join(','));
        return (
          <section key={t.tableName} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><Key className="size-4" aria-hidden /></span>
              <h4 className="font-mono text-sm font-semibold text-gray-900">{t.tableName}</h4>
            </div>
            <div className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-500">Primary key</div>
            <div className="mt-1 inline-block rounded-md bg-amber-50 px-2 py-1 font-mono text-sm text-amber-900">{pk || '—'}</div>
            {t.keyReason && <p className="mt-2 text-xs text-gray-500">{t.keyReason}</p>}
            {others.length > 0 && (
              <>
                <div className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-500">Other candidate keys ({others.length})</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {others.slice(0, 12).map((k, i) => (
                    <span key={i} className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-800">{k.join(' + ')}</span>
                  ))}
                  {others.length > 12 && <span className="text-xs text-gray-500">+{others.length - 12} more</span>}
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Lossless-join and dependency-preservation verdicts for every table, with the detail on demand. */
export function QualityByTable({ tables }: { tables: TableLike[] }) {
  const checked = useMemo(() => tables.filter(t => t.losslessCheck || t.dependencyPreservation), [tables]);
  const [open, setOpen] = useState<string | null>(null);
  if (!checked.length) {
    return <Empty icon={<Shield className="size-10" />} title="No quality checks yet" hint="Add Lossless Check and Dependency Preservation to the pipeline, then run it again." />;
  }
  const lossless = checked.filter(t => t.losslessCheck?.isLossless).length;
  const preserved = checked.filter(t => t.dependencyPreservation?.isPreserved).length;
  const Badge = ({ ok, yes, no }: { ok: boolean | undefined; yes: string; no: string }) =>
    ok === undefined ? null : (
      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${ok ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800'}`}>
        {ok ? <CheckCircle className="size-3.5" aria-hidden /> : <AlertCircle className="size-3.5" aria-hidden />}
        {ok ? yes : no}
      </span>
    );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500">Lossless join</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{lossless}<span className="text-sm font-normal text-gray-500"> / {checked.length} tables</span></div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500">Dependencies preserved</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{preserved}<span className="text-sm font-normal text-gray-500"> / {checked.length} tables</span></div>
        </div>
      </div>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {checked.map(t => {
          const isOpen = open === t.tableName;
          return (
            <li key={t.tableName}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : t.tableName)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
              >
                {isOpen ? <ChevronDown className="size-4 text-gray-400" aria-hidden /> : <ChevronRight className="size-4 text-gray-400" aria-hidden />}
                <span className="flex-1 font-mono text-sm text-gray-900">{t.tableName}</span>
                <Badge ok={t.losslessCheck?.isLossless} yes="Lossless" no="Lossy" />
                <Badge ok={t.dependencyPreservation?.isPreserved} yes="Preserved" no="Not preserved" />
              </button>
              {isOpen && (
                <div className="nf-fade-in border-t border-gray-100 bg-gray-50 p-4">
                  <QualityAssuranceSection losslessCheck={t.losslessCheck} dependencyPreservation={t.dependencyPreservation} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
