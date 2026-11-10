import { describe, it, expect } from 'vitest';
import {
  mineFunctionalDependencies,
  mineFunctionalDependenciesSampled,
  validateFunctionalDependencies,
  reservoirSampleIndices,
} from './fdMiner';

/** A table where `a -> b` holds except for one rare row far from the start. */
function tableWithRareViolation(n: number) {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < n; i++) rows.push({ id: i, a: i % 50, b: (i % 50) * 2, c: i % 7 });
  rows[n - 3].b = -1;
  return rows;
}

describe('sampled FD mining validates on all rows', () => {
  it('reservoir sample is deterministic, sorted and the right size', () => {
    const s1 = reservoirSampleIndices(1000, 100);
    expect(s1).toEqual(reservoirSampleIndices(1000, 100));
    expect(s1.length).toBe(100);
    expect([...s1].sort((x, y) => x - y)).toEqual(s1);
  });

  it('never reports an exact FD that fails on the full data', () => {
    const rows = tableWithRareViolation(5000);
    const res = mineFunctionalDependenciesSampled(rows, { sampleSize: 200, minConfidence: 0.85 });
    expect(res.sampling?.sampled).toBe(true);
    const exact = res.fds.filter(f => f.confidence === 1);
    const check = validateFunctionalDependencies(rows, exact);
    for (const v of check) expect(v.fd.violations).toBe(0);
    const ab = res.fds.find(f => f.lhs.join() === 'a' && f.rhs === 'b');
    // Either refuted and demoted to approximate, or absent — never exact.
    if (ab) expect(ab.confidence).toBeLessThan(1);
  });

  it('recovers the same exact FDs as full mining on clean data', () => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 4000; i++) rows.push({ id: i, a: i % 40, b: (i % 40) * 3, c: i % 9 });
    const full = mineFunctionalDependencies(rows, { minConfidence: 1 });
    const sampled = mineFunctionalDependenciesSampled(rows, { sampleSize: 300, minConfidence: 1 });
    const key = (f: { lhs: string[]; rhs: string }) => `${f.lhs.join('+')}->${f.rhs}`;
    expect(sampled.fds.map(key).sort()).toEqual(full.fds.map(key).sort());
  });

  it('does not sample small tables', () => {
    const res = mineFunctionalDependenciesSampled(tableWithRareViolation(100), { sampleSize: 200 });
    expect(res.sampling).toBeUndefined();
  });
});
