import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { NormalizationEngine } from '../services/processors/normalizationEngine';
import { verifyLosslessOnData } from '../services/processors/instanceVerification';

/**
 * Property: for random tables whose exact FDs are mined from the data, 3NF
 * synthesis and BCNF decomposition always join back to exactly the input rows.
 *
 * Tables are built so real dependencies exist: some columns are free, others
 * are functions (lookup tables) of earlier columns.
 */
const tableArb = fc
  .record({
    free: fc.integer({ min: 1, max: 3 }),
    derived: fc.integer({ min: 1, max: 3 }),
    rows: fc.integer({ min: 4, max: 40 }),
    seed: fc.integer({ min: 0, max: 1_000_000 }),
    domain: fc.integer({ min: 2, max: 6 }),
    noise: fc.boolean(),
  })
  .map(({ free, derived, rows, seed, domain, noise }) => {
    let s = seed || 1;
    const rand = (n: number) => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s % n;
    };
    const cols: string[] = [];
    for (let i = 0; i < free; i++) cols.push(`f${i}`);
    for (let i = 0; i < derived; i++) cols.push(`d${i}`);
    // Each derived column depends on one or two free columns via a random lookup.
    const deps = Array.from({ length: derived }, () =>
      Array.from(new Set([rand(free), rand(free)])),
    );
    const lookups = deps.map(() => new Map<string, number>());
    const data: Record<string, unknown>[] = [];
    for (let r = 0; r < rows; r++) {
      const row: Record<string, unknown> = {};
      for (let i = 0; i < free; i++) row[`f${i}`] = rand(domain);
      deps.forEach((d, i) => {
        const key = d.map(c => row[`f${c}`]).join('|');
        const lk = lookups[i];
        if (!lk.has(key)) lk.set(key, rand(domain));
        row[`d${i}`] = lk.get(key)!;
      });
      if (noise && r === rows - 1) row[`d0`] = 999; // a violation: FD must not be assumed
      data.push(row);
    }
    return { cols, data };
  });

describe('property: decompositions are lossless on the data', () => {
  it('3NF synthesis and BCNF decomposition re-join to the input', async () => {
    await fc.assert(
      fc.asyncProperty(tableArb, async ({ cols, data }) => {
        const { fds } = await NormalizationEngine.mineFunctionalDependenciesDetailed(data, 4, {});
        const exact = NormalizationEngine.exactFDs(fds);
        const { candidateKeys } = await NormalizationEngine.findKeys(cols, exact);

        const threeNF = await NormalizationEngine.synthesize3NF(exact, candidateKeys, data, cols);
        const r3 = verifyLosslessOnData(data, threeNF.map(r => r.attributes));
        expect(r3.lossless, `3NF lossy: ${JSON.stringify(threeNF.map(r => r.attributes))}`).not.toBe(false);

        const bcnf = await NormalizationEngine.decomposeBCNF(cols, exact, data);
        const rb = verifyLosslessOnData(data, bcnf.map(r => r.attributes));
        expect(rb.lossless, `BCNF lossy: ${JSON.stringify(bcnf.map(r => r.attributes))}`).not.toBe(false);
      }),
      { numRuns: 60 },
    );
  }, 120_000);
});
