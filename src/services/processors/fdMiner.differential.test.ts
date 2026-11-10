import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mineFunctionalDependencies } from './fdMiner';

/** Brute force: all minimal exact FDs with |LHS| <= maxLhs. */
function bruteForce(rows: Record<string, unknown>[], maxLhs: number) {
  const cols = Object.keys(rows[0]);
  const holds = (lhs: string[], rhs: string) => {
    const seen = new Map<string, unknown>();
    for (const r of rows) {
      const k = JSON.stringify(lhs.map(c => r[c]));
      if (seen.has(k) && seen.get(k) !== r[rhs]) return false;
      seen.set(k, r[rhs]);
    }
    return true;
  };
  const subsets: string[][] = [];
  const rec = (start: number, cur: string[]) => {
    if (cur.length > 0) subsets.push([...cur]);
    if (cur.length === maxLhs) return;
    for (let i = start; i < cols.length; i++) rec(i + 1, [...cur, cols[i]]);
  };
  rec(0, []);
  const found = new Set<string>();
  for (const rhs of cols) {
    const valid = subsets.filter(l => !l.includes(rhs) && holds(l, rhs));
    for (const l of valid) {
      const minimal = !valid.some(o => o.length < l.length && o.every(c => l.includes(c)));
      if (minimal) found.add(`${l.join('+')}->${rhs}`);
    }
  }
  return found;
}

describe('FD miner agrees with brute force on exact dependencies', () => {
  it('finds exactly the minimal exact FDs (up to key pruning)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 4, maxLength: 4 }), { minLength: 2, maxLength: 12 }),
        grid => {
          const rows = grid.map(g => ({ a: g[0], b: g[1], c: g[2], d: g[3] }));
          const mined = mineFunctionalDependencies(rows, { minConfidence: 1, maxLhsSize: 3 });
          const got = new Set(mined.fds.map(f => `${[...f.lhs].join('+')}->${f.rhs}`));
          const want = bruteForce(rows, 3);
          // Every mined FD is a true minimal FD, and every minimal FD is mined unless its LHS contains a key.
          for (const g of got) expect(want.has(g), `spurious ${g}`).toBe(true);
          const keyOf = (l: string[]) => {
            const seen = new Set(rows.map(r => JSON.stringify(l.map(c => (r as any)[c]))));
            return seen.size === rows.length;
          };
          for (const w of want) {
            const [lhs] = w.split('->');
            const parts = lhs.split('+');
            const strictKey = parts.length > 1 && parts.some((_, i) => keyOf(parts.filter((__, j) => j !== i)));
            if (!strictKey) expect(got.has(w), `missing ${w}`).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
