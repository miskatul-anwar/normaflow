/**
 * Primary-key selection.
 *
 * Candidate keys come from exact functional dependencies, but a key that is
 * valid for the FD set is not always a good primary key: it may contain
 * columns with missing values (SQL forbids NULL in a primary key) or may be
 * a wide composite while a single identifier column exists. This module picks
 * one deterministically and says why, and adds a surrogate key when the data
 * has no usable key at all.
 */

export type KeyRule = 'identifier-column' | 'candidate-key' | 'surrogate';

export interface KeyChoice {
  /** Chosen primary key (may be the surrogate column). */
  primaryKey: string[];
  rule: KeyRule;
  /** Human-readable explanation, suitable for the report. */
  reason: string;
  /** Candidate keys that are unique and contain no missing values. */
  cleanKeys: string[][];
  /** True when `surrogateColumn` was added to the rows. */
  surrogateAdded: boolean;
  surrogateColumn?: string;
}

export const SURROGATE_KEY_COLUMN = 'row_id';

const isMissing = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** True when `cols` identifies every row and no key cell is missing. */
export function isUniqueAndComplete(rows: any[], cols: string[]): boolean {
  if (rows.length === 0 || cols.length === 0) return false;
  const seen = new Set<string>();
  for (const row of rows) {
    const parts: string[] = [];
    for (const c of cols) {
      const v = row[c];
      if (isMissing(v)) return false;
      parts.push(String(v));
    }
    const key = parts.join('\u0001');
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function looksLikeIdentifier(name: string): number {
  const n = name.toLowerCase();
  if (n === 'id' || n === 'uuid' || n === 'guid') return 3;
  // customer_id, customer id, customer-id, CustomerID, customerId
  if (/(^|[_\s-])id$/.test(n) || /[a-z0-9](ID|Id)$/.test(name)) return 2;
  if (/(^|[_\s-])(no|num|number|code|key)$/.test(n)) return 1;
  return 0;
}

/**
 * Choose a primary key for `rows`.
 *
 * Order of preference:
 *  1. a single unique, complete column whose name looks like an identifier;
 *  2. the smallest candidate key that is unique and complete;
 *  3. a surrogate key column.
 *
 * When a surrogate is needed it is written into `rows` and `attributes` in
 * place so later steps see a real column.
 */
export function chooseKey(
  attributes: string[],
  rows: any[],
  candidateKeys: string[][],
  tableName = 'table',
): KeyChoice {
  const uniqueCandidates = candidateKeys.filter(k => k.length > 0 && k.every(c => attributes.includes(c)));

  const clean = uniqueCandidates.filter(k => isUniqueAndComplete(rows, k));
  const cleanKeys = clean.map(k => [...k]);

  // 1. Identifier-looking single columns (candidate keys first, then any unique column).
  const singleCols = new Set<string>(clean.filter(k => k.length === 1).map(k => k[0]));
  for (const col of attributes) {
    if (!singleCols.has(col) && looksLikeIdentifier(col) > 0 && isUniqueAndComplete(rows, [col])) {
      singleCols.add(col);
      cleanKeys.push([col]);
    }
  }
  const idCols = [...singleCols]
    .map(c => ({ c, score: looksLikeIdentifier(c) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || attributes.indexOf(a.c) - attributes.indexOf(b.c));
  if (idCols.length > 0) {
    return {
      primaryKey: [idCols[0].c],
      rule: 'identifier-column',
      reason: `"${idCols[0].c}" is unique, has no missing values and is named like an identifier.`,
      cleanKeys,
      surrogateAdded: false,
    };
  }

  // 2. Smallest clean candidate key (ties: earlier column order).
  if (clean.length > 0) {
    const best = [...clean].sort(
      (a, b) =>
        a.length - b.length ||
        Math.min(...a.map(c => attributes.indexOf(c))) - Math.min(...b.map(c => attributes.indexOf(c))),
    )[0];
    return {
      primaryKey: [...best],
      rule: 'candidate-key',
      reason: `Smallest candidate key that is unique and complete: {${best.join(', ')}}.`,
      cleanKeys,
      surrogateAdded: false,
    };
  }

  // 3. Surrogate key. A key with missing cells cannot be declared PRIMARY KEY,
  //    and an all-columns key over duplicate rows identifies nothing.
  let column = SURROGATE_KEY_COLUMN;
  let n = 1;
  while (attributes.includes(column)) column = `${SURROGATE_KEY_COLUMN}_${++n}`;
  rows.forEach((row, i) => {
    row[column] = i + 1;
  });
  attributes.unshift(column);
  return {
    primaryKey: [column],
    rule: 'surrogate',
    reason:
      `No candidate key of "${tableName}" is both unique and free of missing values ` +
      `(duplicate rows or incomplete key columns), so a surrogate key "${column}" was added.`,
    cleanKeys: [[column]],
    surrogateAdded: true,
    surrogateColumn: column,
  };
}
