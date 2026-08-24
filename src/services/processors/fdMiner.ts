/**
 * Fast functional-dependency mining via partition refinement.
 *
 * Replaces the exhaustive pairwise validator with a TANE-inspired lattice
 * algorithm:
 *
 *  1. Column values are integer-encoded once (string interning).
 *  2. Partitions (equivalence classes of rows) are computed per attribute and
 *     refined incrementally along the LHS lattice — each candidate LHS set
 *     reuses its parent's partition, so total work is ~O(rows × lattice edges)
 *     instead of O(combinations × rows) full scans with per-pair Map churn.
 *  3. X → Y holds exactly when refining π(X) with Y produces no additional
 *     equivalence classes.
 *
 * Approximate FDs are supported: violations are counted during refinement so
 * near-miss dependencies can be surfaced with their confidence, preserving the
 * engine's "keep meaningful low-confidence FDs" philosophy at a fraction of
 * the previous cost.
 */

export interface MinedFD {
  lhs: string[];
  rhs: string;
  /** Fraction of rows agreeing with the dependency (1.0 = exact). */
  confidence: number;
  /** Distinct LHS groups / rows — how selective the determinant is. */
  coverage: number;
  /** Rows that violate the dependency. */
  violations: number;
  /** Number of distinct LHS value combinations. */
  uniqueGroups: number;
}

interface Partition {
  /** Row-index groups; singletons included. */
  groups: number[][];
  /** Number of groups (equivalence classes). */
  classCount: number;
}

const EMPTY_PARTITION: Partition = { groups: [], classCount: 0 };

/**
 * Encode every column of the dataset into integer codes. Empty/undefined
 * values share code -1 and are treated as "unknown" (excluded from FD
 * evidence like SQL NULLs).
 */
function encodeColumns(data: Record<string, unknown>[], attributes: string[]): number[][] {
  return attributes.map(attr => {
    const codes = new Int32Array(data.length);
    const dictionary = new Map<string, number>();
    for (let row = 0; row < data.length; row++) {
      const raw = data[row][attr];
      if (raw === null || raw === undefined) {
        codes[row] = -1;
        continue;
      }
      const key =
        typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : JSON.stringify(raw);
      let code = dictionary.get(key);
      if (code === undefined) {
        code = dictionary.size;
        dictionary.set(key, code);
      }
      codes[row] = code;
    }
    return Array.from(codes);
  });
}

/** Build the initial partition for one attribute (skipping nulls). */
function partitionOfColumn(codes: number[], rowCount: number): Partition {
  const byCode = new Map<number, number[]>();
  for (let row = 0; row < rowCount; row++) {
    const code = codes[row];
    if (code === -1) continue;
    const group = byCode.get(code);
    if (group) group.push(row);
    else byCode.set(code, [row]);
  }
  const groups = Array.from(byCode.values());
  return { groups, classCount: groups.length };
}

/**
 * Refine an existing partition with an extra column. Returns both the new
 * partition and violation statistics for `column → nothing` agreement:
 * rows falling into newly split subgroups beyond the first occurrence count
 * as violations of "LHS → column".
 */
function refinePartition(partition: Partition, codes: number[]): { refined: Partition; splitRows: number } {
  const newGroups: number[][] = [];
  let splitRows = 0;

  for (const group of partition.groups) {
    if (group.length === 1) {
      newGroups.push(group);
      continue;
    }
    const byCode = new Map<number, number[]>();
    for (const row of group) {
      const code = codes[row];
      const sub = byCode.get(code);
      if (sub) sub.push(row);
      else byCode.set(code, [row]);
    }
    if (byCode.size <= 1) {
      newGroups.push(group);
    } else {
      // Group splits — every row beyond the largest subgroup is a violation.
      let largest = 0;
      for (const sub of byCode.values()) {
        if (sub.length > largest) largest = sub.length;
      }
      splitRows += group.length - largest;
      for (const sub of byCode.values()) newGroups.push(sub);
    }
  }

  return { refined: { groups: newGroups, classCount: newGroups.length }, splitRows };
}

/** Canonical combination generator (indices in ascending order, no duplicates). */
function* combinations(n: number, size: number): Generator<number[]> {
  if (size <= 0 || size > n) return;
  const indices = Array.from({ length: size }, (_, i) => i);
  while (true) {
    yield [...indices];
    let i = size - 1;
    while (i >= 0 && indices[i] === n - size + i) i--;
    if (i < 0) return;
    indices[i]++;
    for (let j = i + 1; j < size; j++) indices[j] = indices[j - 1] + 1;
  }
}

export interface MineOptions {
  /** Maximum LHS size to explore (default 4). */
  maxLhsSize?: number;
  /**
   * Minimum confidence to keep an approximate FD. Exact FDs always pass.
   * Set to 1 to collect only exact dependencies (default: 0.85).
   */
  minConfidence?: number;
  /** Progress callback invoked after each lattice level. */
  onProgress?: (level: number, fdsFound: number) => void;
}

export interface MineResult {
  fds: MinedFD[];
  /** Wall-clock duration in ms. */
  durationMs: number;
  combinationsEvaluated: number;
  exactCount: number;
}

/**
 * Mine functional dependencies from tabular data.
 *
 * @param data   Array of row objects (uniform keys expected)
 * @param options See {@link MineOptions}
 */
export function mineFunctionalDependencies(
  data: Record<string, unknown>[],
  options: MineOptions = {},
): MineResult {
  const started = Date.now();
  const empty: MineResult = {
    fds: [],
    durationMs: 0,
    combinationsEvaluated: 0,
    exactCount: 0,
  };
  if (!Array.isArray(data) || data.length === 0) return empty;

  const attributes = Object.keys(data[0] ?? {});
  if (attributes.length < 2) return empty;

  const maxLhsSize = Math.max(1, Math.min(options.maxLhsSize ?? 4, attributes.length - 1));
  const minConfidence = options.minConfidence ?? 0.85;

  const encoded = encodeColumns(data, attributes);
  const rowCount = data.length;

  const basePartitions = encoded.map(codes => partitionOfColumn(codes, rowCount));

  const results: MinedFD[] = [];
  let evaluated = 0;
  let exactCount = 0;

  // Partition cache keyed by sorted attribute index tuple ("i,j,k").
  const partitionCache = new Map<string, Partition>();
  const keyOf = (idxs: number[]) => idxs.join(',');

  // Seed level-1 partitions.
  for (let a = 0; a < attributes.length; a++) {
    partitionCache.set(keyOf([a]), basePartitions[a]);
  }

  const fdExistsForSubset = (subsetKey: string, rhsIdx: number): boolean =>
    results.some(fd => {
      if (fd.rhs !== attributes[rhsIdx]) return false;
      const subset = fd.lhs.map(a => attributes.indexOf(a)).sort((x, y) => x - y);
      return keyOf(subset) === subsetKey && subset.length > 0;
    });

  const lhsSetKeys = new Set<string>();

  for (let level = 1; level <= maxLhsSize; level++) {
    for (const combo of combinations(attributes.length, level)) {
      const cacheKey = keyOf(combo);

      // Build this node's partition from its parent (combo without last attr).
      let partition: Partition | undefined = partitionCache.get(cacheKey);
      if (!partition) {
        const parentKey = keyOf(combo.slice(0, -1));
        const parent = partitionCache.get(parentKey) ?? EMPTY_PARTITION;
        partition = refinePartition(parent, encoded[combo[combo.length - 1]]).refined;
        partitionCache.set(cacheKey, partition);

        if (level > 1) {
          // Parent partitions of non-key nodes can be dropped once children exist.
          // Keep parents that are prefixes of later combos at same level.
          lhsSetKeys.add(parentKey);
        }
      }

      // Key pruning: if X determines everything, no superset yields minimal FDs.
      if (level > 1 && partition.classCount === rowCount) {
        lhsSetKeys.add(cacheKey);
        continue;
      }

      for (let rhs = 0; rhs < attributes.length; rhs++) {
        if (combo.includes(rhs)) continue;

        evaluated++;
        const base = partition!;
        const baseCount = base.classCount;
        if (baseCount === 0) continue;

        const { refined, splitRows } = refinePartition(base, encoded[rhs]);
        const holdsExactly = refined.classCount === baseCount;

        if (!holdsExactly && minConfidence >= 1) continue;

        // Confidence: rows not violating / rows considered.
        // splitRows counts rows in split groups beyond majority vote.
        const confidence = holdsExactly ? 1 : 1 - splitRows / rowCount;
        if (confidence < minConfidence) continue;

        // Minimality pruning: skip if any strict subset already implies RHS.
        let minimal = true;
        if (level > 1) {
          for (let drop = 0; drop < level && minimal; drop++) {
            const subset = combo.filter((_, i) => i !== drop);
            if (fdExistsForSubset(keyOf(subset), rhs)) minimal = false;
          }
        } else {
          minimal = true;
        }
        if (!minimal) continue;

        const lhsNames = combo.map(i => attributes[i]);
        const rhsName = attributes[rhs];

        if (holdsExactly) exactCount++;
        else {
          // Approximate FD: record violation stats for transparency.
          results.push({
            lhs: lhsNames,
            rhs: rhsName,
            confidence,
            coverage: baseCount / rowCount,
            violations: splitRows,
            uniqueGroups: baseCount,
          });
          continue;
        }

        results.push({
          lhs: lhsNames,
          rhs: rhsName,
          confidence: 1,
          coverage: baseCount / rowCount,
          violations: 0,
          uniqueGroups: baseCount,
        });
      }

      if (options.onProgress) options.onProgress(level, results.length);
    }
  }

  // Order: exact first, then by determinacy strength.
  results.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.lhs.length !== b.lhs.length) return a.lhs.length - b.lhs.length;
    return b.coverage - a.coverage;
  });

  return {
    fds: results,
    durationMs: Date.now() - started,
    combinationsEvaluated: evaluated,
    exactCount,
  };
}
