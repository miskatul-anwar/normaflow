/**
 * Cross-table foreign-key detection driven by the data.
 *
 * A foreign key is first an inclusion dependency: every value of the
 * referencing column also appears in the referenced column, and the
 * referenced column is a key (unique). Inclusion alone over-generates (two
 * auto-increment id columns "contain" each other by accident), so each
 * candidate is scored on several features and weak ones are rejected:
 *
 *  - containment of the referencing values in the referenced values;
 *  - coverage of the referenced key by the referencing values;
 *  - name similarity (tokenized, singularized, camel/snake aware);
 *  - type compatibility;
 *  - whether the referenced column is a dense 1..n sequence, which makes
 *    accidental containment likely and therefore requires name evidence.
 *
 * Column names are a feature, not a gate: `buyer` can reference
 * `customers.customer_id` when the values say so.
 */

import type { CrossTableRelationship } from '../../types';

export interface DetectorTable {
  tableName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  /** Primary key chosen for the table (optional; used for tie-breaking). */
  primaryKey?: string[];
}

export interface DetectorOptions {
  /** Minimum share of distinct referencing values found in the referenced column. */
  minContainment?: number;
  /** Minimum overall score to accept a candidate. */
  minScore?: number;
}

type ValueClass = 'integer' | 'number' | 'date' | 'text';

interface ColumnInfo {
  table: string;
  column: string;
  distinct: Set<string>;
  nonNull: number;
  total: number;
  unique: boolean;
  valueClass: ValueClass;
  intMin: number;
  intMax: number;
  denseSequence: boolean;
  nameTokens: string[];
  nameKey: string;
}

const MISSING = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export function tokenizeName(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean);
}

export function singularize(word: string): string {
  const w = word.toLowerCase();
  if (w.length > 3 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && /(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 2 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

function classify(values: string[]): ValueClass {
  let ints = 0;
  let nums = 0;
  let dates = 0;
  for (const v of values) {
    if (/^-?\d+$/.test(v)) ints++;
    if (/^-?\d+(\.\d+)?$/.test(v)) nums++;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) dates++;
  }
  const n = values.length;
  if (n === 0) return 'text';
  if (ints === n) return 'integer';
  if (nums === n) return 'number';
  if (dates === n) return 'date';
  return 'text';
}

function profileColumn(table: DetectorTable, column: string): ColumnInfo {
  const distinct = new Set<string>();
  let nonNull = 0;
  for (const row of table.rows) {
    const raw = row[column];
    if (MISSING(raw)) continue;
    nonNull++;
    distinct.add(String(raw).trim());
  }
  const sample = [...distinct].slice(0, 500);
  const valueClass = classify(sample);

  let intMin = Infinity;
  let intMax = -Infinity;
  let denseSequence = false;
  if (valueClass === 'integer' && distinct.size > 0) {
    for (const v of distinct) {
      const n = Number(v);
      if (n < intMin) intMin = n;
      if (n > intMax) intMax = n;
    }
    // 0/1-based gap-free runs are typical of auto-increment ids.
    denseSequence = distinct.size >= 3 && intMax - intMin + 1 === distinct.size && intMin >= 0 && intMin <= 1;
  }

  return {
    table: table.tableName,
    column,
    distinct,
    nonNull,
    total: table.rows.length,
    unique: nonNull > 0 && distinct.size === nonNull,
    valueClass,
    intMin,
    intMax,
    denseSequence,
    nameTokens: tokenizeName(column),
    nameKey: tokenizeName(column).join(''),
  };
}

function typesCompatible(a: ColumnInfo, b: ColumnInfo): boolean {
  if (a.valueClass === b.valueClass) return true;
  const numeric = (c: ValueClass) => c === 'integer' || c === 'number';
  return numeric(a.valueClass) && numeric(b.valueClass);
}

/** 0..1 evidence that `src` (a column) refers to `tgt` (a key column of another table). */
export function nameEvidence(src: ColumnInfo, tgt: ColumnInfo): number {
  const tableTokens = tokenizeName(tgt.table).map(singularize);
  const tableKey = tableTokens.join('');
  const genericId = (key: string) => key === 'id' || key === 'key' || key === 'code' || key === 'no';

  // customer_id -> customers.id / customers.customer_id
  if (src.nameKey === `${tableKey}${tgt.nameKey}` || src.nameKey === `${tableKey}id`) return 1;
  if (src.nameKey === tgt.nameKey && !genericId(src.nameKey)) return 0.9;
  if (src.nameKey === tgt.nameKey) return 0.15; // id -> id says nothing

  const srcTokens = src.nameTokens.map(singularize);
  const tgtTokens = [...tableTokens, ...tgt.nameTokens.map(singularize)];
  const shared = srcTokens.filter(t => tgtTokens.includes(t) && !genericId(t));
  if (shared.length > 0) {
    const union = new Set([...srcTokens, ...tgtTokens]).size;
    return Math.min(0.85, 0.35 + (shared.length / union) * 0.9);
  }
  // Suffix match such as cust_no vs customers.customer_no is left to the data.
  return 0;
}

interface Candidate {
  src: ColumnInfo;
  tgt: ColumnInfo;
  containment: number;
  coverage: number;
  nameScore: number;
  score: number;
}

export function detectForeignKeys(
  tables: DetectorTable[],
  options: DetectorOptions = {},
): CrossTableRelationship[] {
  const minContainment = options.minContainment ?? 0.95;
  const minScore = options.minScore ?? 0.7;
  if (tables.length < 2) return [];

  const profiles = tables.map(t => ({
    table: t,
    columns: t.headers.map(h => profileColumn(t, h)),
  }));

  const candidates: Candidate[] = [];

  for (const srcSide of profiles) {
    for (const src of srcSide.columns) {
      if (src.nonNull === 0 || src.distinct.size < 2) continue; // constants prove nothing

      for (const tgtSide of profiles) {
        if (tgtSide.table.tableName === srcSide.table.tableName) continue;
        for (const tgt of tgtSide.columns) {
          if (!tgt.unique) continue; // a foreign key must reference a key
          if (!typesCompatible(src, tgt)) continue;
          if (src.distinct.size > tgt.distinct.size) continue; // cannot be contained

          // Range pruning for integers.
          if (src.valueClass === 'integer' && tgt.valueClass === 'integer') {
            if (src.intMin < tgt.intMin || src.intMax > tgt.intMax) continue;
          }

          let hits = 0;
          for (const v of src.distinct) if (tgt.distinct.has(v)) hits++;
          const containment = hits / src.distinct.size;
          if (containment < minContainment) continue;
          const coverage = hits / tgt.distinct.size;

          const nameScore = nameEvidence(src, tgt);

          // Any small integer column is "contained" in a dense 1..n key by
          // accident, so that case needs name evidence.
          if (tgt.denseSequence && nameScore < 0.5) continue;

          const score = 0.45 * containment + 0.15 * coverage + 0.3 * nameScore + 0.1;
          if (score + 1e-9 < minScore) continue;

          candidates.push({ src, tgt, containment, coverage, nameScore, score });
        }
      }
    }
  }

  // Keep the best target per referencing column.
  const bestBySource = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = `${c.src.table}.${c.src.column}`;
    const current = bestBySource.get(key);
    if (!current || c.score > current.score + 1e-9) bestBySource.set(key, c);
  }

  // When two columns reference each other (identical key sets), keep one direction.
  const pkOf = new Map(tables.map(t => [t.tableName, new Set(t.primaryKey ?? [])]));
  const chosen: Candidate[] = [];
  const kept = new Map<string, Candidate>();
  for (const c of bestBySource.values()) kept.set(`${c.src.table}.${c.src.column}->${c.tgt.table}.${c.tgt.column}`, c);
  for (const c of kept.values()) {
    const reverse = kept.get(`${c.tgt.table}.${c.tgt.column}->${c.src.table}.${c.src.column}`);
    if (reverse) {
      const mine = (pkOf.get(c.tgt.table)?.has(c.tgt.column) ? 1 : 0) - (pkOf.get(c.src.table)?.has(c.src.column) ? 1 : 0);
      const theirs = (pkOf.get(reverse.tgt.table)?.has(reverse.tgt.column) ? 1 : 0) - (pkOf.get(reverse.src.table)?.has(reverse.src.column) ? 1 : 0);
      if (theirs > mine) continue;
      if (theirs === mine && reverse.score > c.score + 1e-9) continue;
      if (theirs === mine && Math.abs(reverse.score - c.score) <= 1e-9 && c.src.table > c.tgt.table) continue;
    }
    chosen.push(c);
  }

  // A link whose source column is its own table's key, while another table references that key with a
  // non-unique column, is the wrong way round (the real one-to-many runs child -> parent). Two dense id
  // sequences overlapping by chance produce such links; keeping them creates reference cycles.
  const referencedByNonUnique = new Set(chosen.filter(c => !c.src.unique).map(c => c.tgt.table));
  const oriented = chosen.filter(c => !(c.src.unique && referencedByNonUnique.has(c.src.table)));
  const single = oriented
    .sort((a, b) => b.score - a.score || a.src.table.localeCompare(b.src.table))
    .map(c => {
      const optional = c.src.nonNull < c.src.total;
      const cardinality: CrossTableRelationship['cardinality'] = c.src.unique ? '1:1' : '1:N';
      return {
        sourceTable: c.src.table,
        sourceColumn: c.src.column,
        targetTable: c.tgt.table,
        targetColumn: c.tgt.column,
        cardinality,
        confidence: Math.min(0.99, c.score),
        matchRatio: c.containment,
        detectedBy: c.nameScore >= 0.5 ? 'HEURISTIC' : 'VALUE_OVERLAP',
        optional,
        coverage: c.coverage,
        nameScore: c.nameScore,
      } satisfies CrossTableRelationship;
    });

  const composite = detectCompositeForeignKeys(profiles, minContainment);
  // A composite link supersedes single-column links from the same table to the same target.
  const compositeKeys = new Set(composite.map(c => `${c.sourceTable}->${c.targetTable}`));
  return [...composite, ...single.filter(s => !compositeKeys.has(`${s.sourceTable}->${s.targetTable}`))];
}

const TUPLE_SEP = '\u0001';

/**
 * Multi-column foreign keys: a tuple of columns whose combined values are
 * contained in a composite primary key of another table. Each component must
 * have name evidence for its key column (otherwise the search space explodes
 * and accidental matches dominate).
 */
function detectCompositeForeignKeys(
  profiles: Array<{ table: DetectorTable; columns: ColumnInfo[] }>,
  minContainment: number,
): CrossTableRelationship[] {
  const out: CrossTableRelationship[] = [];
  for (const tgtSide of profiles) {
    const key = tgtSide.table.primaryKey ?? [];
    if (key.length < 2 || key.length > 4) continue;
    const keyInfos = key.map(k => tgtSide.columns.find(c => c.column === k));
    if (keyInfos.some(k => !k)) continue;
    const targetTuples = new Set<string>();
    for (const row of tgtSide.table.rows) {
      if (key.some(k => MISSING(row[k]))) continue;
      targetTuples.add(key.map(k => String(row[k]).trim()).join(TUPLE_SEP));
    }
    if (targetTuples.size === 0) continue;

    for (const srcSide of profiles) {
      if (srcSide.table.tableName === tgtSide.table.tableName) continue;
      const options = (keyInfos as ColumnInfo[]).map(k =>
        srcSide.columns.filter(
          c => c.nonNull > 0 && typesCompatible(c, k) && (c.nameKey === k.nameKey || nameEvidence(c, k) >= 0.5),
        ),
      );
      if (options.some(o => o.length === 0)) continue;

      // Cartesian product of per-component options (small after name filtering).
      let combos: ColumnInfo[][] = [[]];
      for (const opts of options) {
        const next: ColumnInfo[][] = [];
        for (const prefix of combos) {
          for (const o of opts) if (!prefix.includes(o)) next.push([...prefix, o]);
        }
        combos = next.slice(0, 50);
      }

      let best: { cols: ColumnInfo[]; containment: number; coverage: number; distinct: number; nonNull: number } | null = null;
      for (const cols of combos) {
        const seen = new Set<string>();
        let nonNull = 0;
        for (const row of srcSide.table.rows) {
          if (cols.some(c => MISSING(row[c.column]))) continue;
          nonNull++;
          seen.add(cols.map(c => String(row[c.column]).trim()).join(TUPLE_SEP));
        }
        if (seen.size < 2) continue;
        let hits = 0;
        for (const t of seen) if (targetTuples.has(t)) hits++;
        const containment = hits / seen.size;
        if (containment < minContainment) continue;
        const candidate = { cols, containment, coverage: hits / targetTuples.size, distinct: seen.size, nonNull };
        if (!best || candidate.containment > best.containment) best = candidate;
      }
      if (!best) continue;

      const optional = best.nonNull < srcSide.table.rows.length;
      out.push({
        sourceTable: srcSide.table.tableName,
        sourceColumn: best.cols[0].column,
        targetTable: tgtSide.table.tableName,
        targetColumn: key[0],
        sourceColumns: best.cols.map(c => c.column),
        targetColumns: [...key],
        cardinality: best.distinct === best.nonNull ? '1:1' : '1:N',
        confidence: Math.min(0.99, 0.55 + 0.4 * best.containment),
        matchRatio: best.containment,
        detectedBy: 'HEURISTIC',
        optional,
        coverage: best.coverage,
        nameScore: 1,
      });
    }
  }
  return out;
}
