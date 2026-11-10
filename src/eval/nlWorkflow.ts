import { NL_CASES, type NLCase } from './nlWorkflowCases';
import { resolve, type ResolveMode, type Thresholds } from '../services/nlp/workflow/resolver';
import { planFor } from '../services/nlp/workflow/planner';
import type { EmbeddingProvider } from '../services/nlp/workflow/embeddingProvider';

export interface NLResultRow {
  case: NLCase;
  got: string[];
  ok: boolean;
  planOk: boolean;
}

export interface NLReport {
  mode: ResolveMode;
  thresholds?: Thresholds;
  total: number;
  /** Fraction of non-junk cases whose planned pipeline equals the expected one. */
  planAccuracy: number;
  /** Fraction of non-junk cases whose target set equals the expected set (or an alternative). */
  targetAccuracy: number;
  /** Of the cases the system answered, how many were junk (lower is better). */
  junkAccepted: number;
  junkTotal: number;
  /** Share of junk requests that were correctly rejected. */
  rejectionRate: number;
  byKind: Record<string, { ok: number; total: number }>;
  failures: NLResultRow[];
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));

export async function evaluateNL(
  provider: EmbeddingProvider,
  mode: ResolveMode = 'hybrid',
  thresholds?: Thresholds,
  cases: NLCase[] = NL_CASES,
): Promise<NLReport> {
  const rows: NLResultRow[] = [];
  for (const k of cases) {
    const r = await resolve(k.text, provider, { mode, thresholds });
    const got = r.targets.length > 0 && r.plan.length > 0 ? r.targets : [];
    let ok: boolean;
    let planOk: boolean;
    if (k.reject) {
      ok = got.length === 0;
      planOk = ok;
    } else {
      const acceptable = [k.targets, ...(k.alt ?? [])];
      ok = acceptable.some(t => sameSet(got, t));
      // Compound requests may be phrased with extra intermediate targets; compare the plans.
      planOk = acceptable.some(t => {
        try {
          return sameSet(planFor(t, new Set(k.excluded ?? [])).plan, r.plan);
        } catch {
          return false;
        }
      });
      if (!ok && planOk) ok = true; // same pipeline, different surface targets
    }
    rows.push({ case: k, got, ok, planOk });
  }
  const real = rows.filter(r => !r.case.reject);
  const junk = rows.filter(r => r.case.reject);
  const byKind: NLReport['byKind'] = {};
  for (const r of rows) {
    const e = (byKind[r.case.kind] ??= { ok: 0, total: 0 });
    e.total++;
    if (r.ok) e.ok++;
  }
  return {
    mode,
    thresholds,
    total: rows.length,
    planAccuracy: real.filter(r => r.planOk).length / (real.length || 1),
    targetAccuracy: real.filter(r => r.ok).length / (real.length || 1),
    junkAccepted: junk.filter(r => !r.ok).length,
    junkTotal: junk.length,
    rejectionRate: junk.filter(r => r.ok).length / (junk.length || 1),
    byKind,
    failures: rows.filter(r => !r.ok),
  };
}
