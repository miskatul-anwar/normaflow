import { describe, it, expect } from 'vitest';
import { retail, university } from './datasets';
import { evaluate, score } from './harness';

describe('evaluation harness', () => {
  it('scores sets', () => {
    const s = score(new Set(['a', 'b', 'x']), new Set(['a', 'b', 'c', 'd']));
    expect(s.precision).toBeCloseTo(2 / 3);
    expect(s.recall).toBe(0.5);
  });

  // Regression floor: keys and foreign keys on ground-truth schemas (incl. composite keys and a junction table).
  for (const ds of [retail(1), university(1)]) {
    it(`recovers keys and foreign keys on ${ds.name}`, async () => {
      const r = await evaluate(ds);
      expect(r.primaryKeys.recall).toBeGreaterThanOrEqual(0.9);
      expect(r.foreignKeys.recall).toBeGreaterThanOrEqual(0.9);
      expect(r.foreignKeys.precision).toBeGreaterThanOrEqual(0.9);
    }, 60_000);
  }
});
