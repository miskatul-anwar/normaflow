/**
 * First normal form: move multi-valued columns into child tables.
 *
 * A cell such as `"red; green; blue"` holds several values. Each such column
 * becomes a child relation `(key…, column)` with one row per
 * value, linked to the parent through the parent's key. The parent loses the
 * column, so every remaining cell is atomic.
 */

import type { RelationSchema } from '../../types';
import { DataProcessor } from './dataProcessor';
import { chooseKey } from './keySelection';
import { newRelationId } from '../naming/relationNames';

export interface AtomicSplit {
  /** Parent rows without the multi-valued columns (and with a surrogate key if one was needed). */
  parentRows: Record<string, unknown>[];
  parentAttributes: string[];
  /** Key that links children to the parent. */
  key: string[];
  children: RelationSchema[];
  /** Columns that were moved out. */
  moved: string[];
}

const isMissing = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Split `text` into its values: list tokens when it is a list, else the single trimmed value. */
function valuesOf(cell: unknown): string[] {
  if (isMissing(cell)) return [];
  const text = String(cell).trim();
  return DataProcessor.listTokens(text) ?? [text];
}

export function splitMultiValuedColumns(
  rows: Record<string, unknown>[],
  multiValued: string[],
  tableName: string,
): AtomicSplit | null {
  if (rows.length === 0) return null;
  const all = Object.keys(rows[0]);
  const moved = multiValued.filter(c => all.includes(c));
  const remaining = all.filter(c => !moved.includes(c));
  if (moved.length === 0 || remaining.length === 0) return null;

  // Parent rows and a link key (adds a surrogate `row_id` when nothing unique exists).
  const parentRows = rows.map(r => {
    const copy: Record<string, unknown> = {};
    for (const c of remaining) copy[c] = r[c];
    return copy;
  });
  const parentAttributes = [...remaining];
  const uniqueSingles = remaining
    .filter(c => parentRows.length > 0 && new Set(parentRows.map(r => String(r[c] ?? ''))).size === parentRows.length)
    .map(c => [c]);
  const choice = chooseKey(parentAttributes, parentRows, uniqueSingles, tableName);
  const key = choice.primaryKey;
  const keyOf = (i: number) => key.map(k => parentRows[i][k]);

  const children: RelationSchema[] = [];
  for (const col of moved) {
    const childRows: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      for (const value of valuesOf(row[col])) {
        const k = JSON.stringify([...keyOf(i), value]);
        if (seen.has(k)) continue;
        seen.add(k);
        const out: Record<string, unknown> = {};
        key.forEach((kc, j) => (out[kc] = keyOf(i)[j]));
        out[col] = value;
        childRows.push(out);
      }
    });
    children.push({
      name: newRelationId(),
      attributes: [...key, col],
      primaryKey: [...key, col],
      foreignKeys: [],
      rows: childRows,
      sourceType: '1NF',
      metadata: { rowCount: childRows.length, attributeTypes: {} },
    } as RelationSchema);
  }
  return { parentRows, parentAttributes, key, children, moved };
}
