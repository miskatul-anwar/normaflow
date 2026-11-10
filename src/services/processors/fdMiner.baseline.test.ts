import { describe, expect, it } from 'vitest';
import { mineFunctionalDependencies } from './fdMiner';

interface Row {
  [key: string]: unknown;
}

describe('fdMiner', () => {
  it('finds exact FDs in a clean dataset', () => {
    const data: Row[] = [
      { zip: '10001', city: 'NYC', country: 'US' },
      { zip: '10001', city: 'NYC', country: 'US' },
      { zip: '90210', city: 'Beverly Hills', country: 'US' },
      { zip: '90210', city: 'Beverly Hills', country: 'US' },
      { zip: 'SW1A', city: 'London', country: 'UK' },
    ];

    const { fds, exactCount } = mineFunctionalDependencies(data, { minConfidence: 1 });

    const has = (lhs: string[], rhs: string) =>
      fds.some(fd => fd.lhs.length === lhs.length && lhs.every(a => fd.lhs.includes(a)) && fd.rhs === rhs);

    expect(has(['zip'], 'city')).toBe(true);
    expect(has(['city'], 'country')).toBe(true);
    expect(has(['zip'], 'country')).toBe(true);
    expect(exactCount).toBeGreaterThan(0);
  });

  it('does not report non-dependencies', () => {
    const data: Row[] = [
      { a: 1, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 1 },
      { a: 2, b: 3 },
    ];
    const { fds } = mineFunctionalDependencies(data, { minConfidence: 1 });
    expect(fds.find(fd => fd.lhs.includes('a') && fd.rhs === 'b')).toBeUndefined();
    expect(fds.find(fd => fd.lhs.includes('b') && fd.rhs === 'a')).toBeUndefined();
  });

  it('detects keys as FDs determining all attributes', () => {
    const data: Row[] = [
      { id: 1, name: 'x' },
      { id: 2, name: 'y' },
      { id: 3, name: 'z' },
    ];
    const { fds } = mineFunctionalDependencies(data, { minConfidence: 1 });
    expect(fds.some(fd => fd.lhs.length === 1 && fd.lhs[0] === 'id' && fd.rhs === 'name')).toBe(true);
  });

  describe('missing values', () => {
    const data: Row[] = [
      { k: 'a', v: '1' },
      { k: 'a', v: '1' },
      { k: '', v: '9' },
      { k: null, v: '8' },
    ];
    const holds = (opts: Parameters<typeof mineFunctionalDependencies>[1]) =>
      mineFunctionalDependencies(data, { minConfidence: 1, ...opts }).fds.some(
        fd => fd.lhs.length === 1 && fd.lhs[0] === 'k' && fd.rhs === 'v',
      );

    it('treats all missing values as one value by default (null = null)', () => {
      // The two rows with a missing k disagree on v, so k -> v is violated.
      expect(holds({})).toBe(false);
    });

    it('treats every missing value as distinct when asked (SQL NULL-like)', () => {
      expect(holds({ nullSemantics: 'distinct' })).toBe(true);
    });

    it('never drops rows: a column unique except for missing values is not a superkey', () => {
      const rows: Row[] = [
        { id: '1', x: 'a' },
        { id: '2', x: 'b' },
        { id: '', x: 'c' },
        { id: '', x: 'c' },
      ];
      const { fds } = mineFunctionalDependencies(rows, { minConfidence: 1 });
      // id -> x holds (both missing-id rows agree on x); x -> id does not (c maps to nothing but '' twice is fine).
      expect(fds.some(fd => fd.lhs[0] === 'id' && fd.rhs === 'x')).toBe(true);
    });
  });

  it('stops early and flags the result when the abort signal fires', () => {
    const rows: Row[] = Array.from({ length: 50 }, (_, i) => ({ a: `${i % 5}`, b: `${i % 7}`, c: `${i}` }));
    const controller = new AbortController();
    controller.abort();
    const result = mineFunctionalDependencies(rows, { signal: controller.signal });
    expect(result.truncated).toBe(true);
  });

  it('supports approximate dependencies with confidence below 1', () => {
    const data: Row[] = [];
    // 90 rows consistent with a→b (10 groups × 9 repeats)…
    for (let i = 0; i < 90; i++) data.push({ a: `g${i % 10}`, b: `v${i % 10}` });
    // …plus 10 violating rows reusing group values with conflicting b.
    for (let i = 0; i < 10; i++) data.push({ a: `g${i}`, b: `conflict${i}` });

    const { fds } = mineFunctionalDependencies(data, { maxLhsSize: 1, minConfidence: 0.5 });
    const approx = fds.find(fd => fd.lhs[0] === 'a' && fd.rhs === 'b');
    expect(approx).toBeDefined();
    expect(approx!.confidence).toBeGreaterThan(0.5);
    expect(approx!.confidence).toBeLessThan(1);
    expect(approx!.violations).toBeGreaterThan(0);
  });

  it('returns empty results for degenerate inputs', () => {
    expect(mineFunctionalDependencies([], {}).fds).toEqual([]);
    expect(mineFunctionalDependencies([{ one: 1 }], {}).fds).toEqual([]);
  });

  it('is dramatically faster than O(pairs × rows) on wide tables', () => {
    // 2000 rows × 6 attrs; old implementation re-scanned per candidate pair.
    const data: Row[] = Array.from({ length: 2000 }, (_, i) => ({
      id: i,
      group: i % 25,
      region: `R${i % 5}`,
      flag: i % 2,
      text: `t${i}`,
      score: i * 3 % 97,
    }));
    const start = Date.now();
    const { fds } = mineFunctionalDependencies(data, { maxLhsSize: 2, minConfidence: 1 });
    const elapsed = Date.now() - start;
    expect(fds.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(3000); // generous CI headroom
  });
});
