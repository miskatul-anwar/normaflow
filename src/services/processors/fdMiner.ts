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
 * How missing values (null, undefined or the empty string) take part in FD
 * evidence. Both are standard in the FD-discovery literature:
 *
 * - `equal`    (default): all missing values in a column are one value, so
 *                two rows with missing cells agree on that column.
 * - `distinct`: every missing value is different from every other, like SQL
 *                NULL in a UNIQUE constraint.
 *
 * Either way no row is dropped, so `rowCount` is the right denominator for
 * confidence and for the superkey test.
 */
export type NullSemantics = 'equal' | 'distinct';

function isMissing(raw: unknown): boolean {
  return raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');
}

/** Encode every column of the dataset into integer codes. */
function encodeColumns(
  data: Record<string, unknown>[],
  attributes: string[],
  nullSemantics: NullSemantics = 'equal',
): number[][] {
  return attributes.map(attr => {
    const codes = new Int32Array(data.length);
    const dictionary = new Map<string, number>();
    let nextUnique = 0;
    for (let row = 0; row < data.length; row++) {
      const raw = data[row][attr];
      if (isMissing(raw)) {
        if (nullSemantics === 'distinct') {
          // Unique negative codes never collide with dictionary codes (>= 0).
          codes[row] = -1 - nextUnique++;
        } else {
          let nullCode = dictionary.get('\u0000null');
          if (nullCode === undefined) {
            nullCode = dictionary.size;
            dictionary.set('\u0000null', nullCode);
          }
          codes[row] = nullCode;
        }
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

/** Build the initial partition for one attribute (every row is placed). */
function partitionOfColumn(codes: number[], rowCount: number): Partition {
  const byCode = new Map<number, number[]>();
  for (let row = 0; row < rowCount; row++) {
    const code = codes[row];
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
  /** How missing values compare (default `equal`). See {@link NullSemantics}. */
  nullSemantics?: NullSemantics;
  /** Abort the search early; the result is flagged `truncated`. */
  signal?: AbortSignal;
  /** Wall-clock budget in ms; the result is flagged `truncated` when exceeded. */
  timeBudgetMs?: number;
  /** Progress callback invoked after each lattice level. */
  onProgress?: (level: number, fdsFound: number) => void;
}

export interface MineResult {
  fds: MinedFD[];
  /** Wall-clock duration in ms. */
  durationMs: number;
  combinationsEvaluated: number;
  exactCount: number;
  /** True when the search stopped early (abort or time budget). */
  truncated?: boolean;
  /** Highest LHS size fully explored. */
  levelReached?: number;
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

  const encoded = encodeColumns(data, attributes, options.nullSemantics ?? 'equal');
  let truncated = false;
  let levelReached = 0;
  const outOfBudget = () =>
    Boolean(options.signal?.aborted) ||
    (options.timeBudgetMs !== undefined && Date.now() - started > options.timeBudgetMs);
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

  const knownSuperkeys: number[][] = [];
  const minedLhsByRhs = new Map<number, Array<{ combo: number[]; confidence: number }>>();

  search: for (let level = 1; level <= maxLhsSize; level++) {
    // Level k only needs the partitions of level k-1 (its parents); free the rest.
    if (level >= 3) {
      for (const key of partitionCache.keys()) {
        if (key.split(',').length < level - 1) partitionCache.delete(key);
      }
    }
    for (const combo of combinations(attributes.length, level)) {
      if (outOfBudget()) {
        truncated = true;
        break search;
      }

      // Key pruning: if a strict subset of combo is already a known superkey,
      // no superset can yield minimal functional dependencies.
      if (level > 1 && knownSuperkeys.some(k => k.every(attr => combo.includes(attr)))) {
        continue;
      }

      const cacheKey = keyOf(combo);

      // Build this node's partition from its parent (combo without last attr).
      let partition: Partition | undefined = partitionCache.get(cacheKey);
      if (!partition) {
        const parentKey = keyOf(combo.slice(0, -1));
        const parent = partitionCache.get(parentKey) ?? EMPTY_PARTITION;
        partition = refinePartition(parent, encoded[combo[combo.length - 1]]).refined;
        partitionCache.set(cacheKey, partition);
      }

      const base = partition!;
      const baseCount = base.classCount;
      if (baseCount === 0) continue;

      // Identify whether combo uniquely determines all tuples (superkey)
      const isSuperkey = baseCount === rowCount;
      const comboNames = combo.map(i => attributes[i]);

      for (let rhs = 0; rhs < attributes.length; rhs++) {
        if (combo.includes(rhs)) continue;

        // Minimality check across all prior levels for exact determinants:
        // Skip if any strict subset already implies RHS with confidence 1.0.
        const existingList = minedLhsByRhs.get(rhs);
        if (
          existingList &&
          existingList.some(prev => prev.confidence === 1 && prev.combo.every(attr => combo.includes(attr)))
        ) {
          continue;
        }

        evaluated++;

        let holdsExactly = false;
        let splitRows = 0;
        let confidence = 1;

        if (isSuperkey) {
          // If combo is a superkey, every tuple is distinct; hence X -> Y holds with 0 violations.
          holdsExactly = true;
          splitRows = 0;
          confidence = 1;
        } else {
          const { refined, splitRows: sr } = refinePartition(base, encoded[rhs]);
          splitRows = sr;
          holdsExactly = refined.classCount === baseCount;

          if (!holdsExactly && minConfidence >= 1) continue;

          // Confidence: rows not violating / rows considered.
          confidence = holdsExactly ? 1 : 1 - splitRows / rowCount;
          if (confidence < minConfidence) continue;
        }

        // For approximate dependencies, skip if an existing subset already has equal or higher confidence.
        if (
          !holdsExactly &&
          existingList &&
          existingList.some(prev => prev.confidence >= confidence && prev.combo.every(attr => combo.includes(attr)))
        ) {
          continue;
        }

        const rhsName = attributes[rhs];

        if (holdsExactly) {
          exactCount++;
          results.push({
            lhs: comboNames,
            rhs: rhsName,
            confidence: 1,
            coverage: baseCount / rowCount,
            violations: 0,
            uniqueGroups: baseCount,
          });
        } else {
          // Approximate FD: record violation stats for transparency.
          results.push({
            lhs: comboNames,
            rhs: rhsName,
            confidence,
            coverage: baseCount / rowCount,
            violations: splitRows,
            uniqueGroups: baseCount,
          });
        }

        let list = minedLhsByRhs.get(rhs);
        if (!list) {
          list = [];
          minedLhsByRhs.set(rhs, list);
        }
        list.push({ combo: [...combo], confidence });
      }

      // Record as known superkey AFTER evaluating RHS attributes so supersets are pruned at higher levels
      if (isSuperkey) {
        knownSuperkeys.push([...combo]);
      }

      if (options.onProgress) options.onProgress(level, results.length);
    }
    levelReached = level;
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
    truncated,
    levelReached,
  };
}

// ---------------------------------------------------------------------------
// Sampling with full-data validation (HyFD style)
// ---------------------------------------------------------------------------

/** Deterministic PRNG so repeated runs sample the same rows. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform reservoir sample of `size` row indices out of `total`, ascending. */
export function reservoirSampleIndices(total: number, size: number, seed = 42): number[] {
  if (size >= total) return Array.from({ length: total }, (_, i) => i);
  const rand = mulberry32(seed);
  const reservoir = Array.from({ length: size }, (_, i) => i);
  for (let i = size; i < total; i++) {
    const j = Math.floor(rand() * (i + 1));
    if (j < size) reservoir[j] = i;
  }
  return reservoir.sort((a, b) => a - b);
}

export interface FDValidation {
  /** Statistics measured on every row. */
  fd: MinedFD;
  /** Row indices of one violating pair (empty when the FD holds exactly). */
  witness: number[];
}

/**
 * Check dependencies against *all* rows. Returns the true confidence,
 * violation count and group count for each, plus a witness pair of rows for
 * every dependency that fails (used to refine a sample).
 */
export function validateFunctionalDependencies(
  data: Record<string, unknown>[],
  fds: MinedFD[],
  nullSemantics: NullSemantics = 'equal',
): FDValidation[] {
  if (fds.length === 0 || data.length === 0) return [];
  const attributes = Object.keys(data[0]);
  const index = new Map(attributes.map((a, i) => [a, i]));
  const needed = new Set<number>();
  for (const fd of fds) {
    for (const a of fd.lhs) if (index.has(a)) needed.add(index.get(a)!);
    if (index.has(fd.rhs)) needed.add(index.get(fd.rhs)!);
  }
  // Encode only the columns that appear in some dependency.
  const encodedAll = encodeColumns(data, attributes.filter((_, i) => needed.has(i)), nullSemantics);
  const byName = new Map<string, number[]>();
  attributes.filter((_, i) => needed.has(i)).forEach((a, i) => byName.set(a, encodedAll[i]));
  const rows = data.length;

  return fds.map(fd => {
    const lhsCols = fd.lhs.map(a => byName.get(a));
    const rhsCol = byName.get(fd.rhs);
    if (!rhsCol || lhsCols.some(c => !c)) return { fd, witness: [] };
    const cols = lhsCols as number[][];
    // Fast pass: first row and first RHS code per LHS group.
    const first = new Map<string, number>();
    let conflict: number[] = [];
    for (let r = 0; r < rows; r++) {
      let key = '';
      for (let c = 0; c < cols.length; c++) key += cols[c][r] + ',';
      const prev = first.get(key);
      if (prev === undefined) first.set(key, r);
      else if (rhsCol[prev] !== rhsCol[r] && conflict.length === 0) conflict = [prev, r];
    }
    if (conflict.length === 0) {
      return {
        fd: { ...fd, confidence: 1, violations: 0, uniqueGroups: first.size, coverage: first.size / rows },
        witness: [],
      };
    }
    // Slow pass: count rows outside the majority RHS value of each group.
    const counts = new Map<string, Map<number, number>>();
    for (let r = 0; r < rows; r++) {
      let key = '';
      for (let c = 0; c < cols.length; c++) key += cols[c][r] + ',';
      let m = counts.get(key);
      if (!m) counts.set(key, (m = new Map()));
      m.set(rhsCol[r], (m.get(rhsCol[r]) ?? 0) + 1);
    }
    let violations = 0;
    for (const m of counts.values()) {
      if (m.size <= 1) continue;
      let total = 0;
      let max = 0;
      for (const n of m.values()) {
        total += n;
        if (n > max) max = n;
      }
      violations += total - max;
    }
    return {
      fd: {
        ...fd,
        confidence: 1 - violations / rows,
        violations,
        uniqueGroups: counts.size,
        coverage: counts.size / rows,
      },
      witness: conflict,
    };
  });
}

export interface SamplingInfo {
  sampled: true;
  totalRows: number;
  sampleSize: number;
  /** Mine → validate → refine rounds that ran. */
  rounds: number;
  /** Rows added to the sample because they refuted a candidate. */
  rowsAdded: number;
  /** Candidates that held on the sample but not on the full data. */
  refuted: number;
}

export interface SampledMineOptions extends MineOptions {
  /** Rows to mine on; at or above `data.length` no sampling happens. */
  sampleSize?: number;
  /** Maximum mine/validate rounds (default 6). */
  maxRounds?: number;
  seed?: number;
}

/**
 * Mine on a reservoir sample, then validate every reported dependency on all
 * rows. A candidate refuted by the full data contributes its violating rows to
 * the sample and mining repeats, so exact dependencies reported are always
 * true on the whole file. Dependencies still failing after the last round keep
 * their measured confidence (or are dropped below `minConfidence`).
 */
export function mineFunctionalDependenciesSampled(
  data: Record<string, unknown>[],
  options: SampledMineOptions = {},
): MineResult & { sampling?: SamplingInfo } {
  const sampleSize = options.sampleSize ?? 10_000;
  if (data.length <= sampleSize) return mineFunctionalDependencies(data, options);

  const started = Date.now();
  const minConfidence = options.minConfidence ?? 0.85;
  const maxRounds = options.maxRounds ?? 6;
  const chosen = new Set(reservoirSampleIndices(data.length, sampleSize, options.seed ?? 42));
  let rowsAdded = 0;
  let refuted = 0;
  let rounds = 0;
  let result: MineResult = { fds: [], durationMs: 0, combinationsEvaluated: 0, exactCount: 0 };
  let validated: FDValidation[] = [];

  for (; rounds < maxRounds; ) {
    rounds++;
    const rows = Array.from(chosen)
      .sort((a, b) => a - b)
      .map(i => data[i]);
    result = mineFunctionalDependencies(rows, options);
    validated = validateFunctionalDependencies(data, result.fds, options.nullSemantics ?? 'equal');
    const failedExact: FDValidation[] = [];
    result.fds.forEach((fd, i) => {
      if (fd.confidence === 1 && validated[i].fd.confidence < 1) failedExact.push(validated[i]);
    });
    if (failedExact.length === 0 || result.truncated || options.signal?.aborted) break;
    let added = 0;
    for (const f of failedExact) {
      for (const r of f.witness) {
        if (!chosen.has(r)) {
          chosen.add(r);
          added++;
        }
      }
    }
    rowsAdded += added;
    if (added === 0) break;
  }

  const finalFds: MinedFD[] = [];
  result.fds.forEach((fd, i) => {
    const v = validated[i]?.fd ?? fd;
    if (fd.confidence === 1 && v.confidence < 1) refuted++;
    if (v.confidence === 1 || v.confidence >= minConfidence) finalFds.push(v);
  });
  finalFds.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.lhs.length !== b.lhs.length) return a.lhs.length - b.lhs.length;
    return b.coverage - a.coverage;
  });

  return {
    ...result,
    fds: finalFds,
    exactCount: finalFds.filter(f => f.confidence === 1).length,
    durationMs: Date.now() - started,
    sampling: { sampled: true, totalRows: data.length, sampleSize: chosen.size, rounds, rowsAdded, refuted },
  };
}
