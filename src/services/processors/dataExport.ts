/**
 * Export the normalized data, not only the schema.
 *
 * For every relation: its rows projected onto the relation's columns with
 * duplicates removed (CSV), `INSERT` statements in dependency order so foreign
 * keys resolve, and one query per foreign key that counts orphan rows after a
 * load. Identifiers match the generated DDL.
 */

import type { DecomposedRelation, SQLDialect } from '../api/databaseService';
import { quoteIdentifier } from '../api/databaseService';
import type { BuiltSchema } from './schemaGraph';
import { toDecomposedRelations } from './schemaGraph';

export interface ExportedFile {
  name: string;
  content: string;
  type: 'csv' | 'sql';
}

const missing = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export function csvCell(value: unknown): string {
  if (missing(value)) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sqlLiteral(value: unknown, sqlType: string): string {
  if (missing(value)) return 'NULL';
  const text = String(value).trim();
  const t = sqlType.toUpperCase();
  if (/^(INTEGER|BIGINT|DECIMAL)/.test(t) && /^-?\d+(\.\d+)?$/.test(text)) return text;
  if (t.startsWith('BOOLEAN')) return /^true$/i.test(text) ? 'TRUE' : 'FALSE';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Distinct rows of `rows` projected onto `columns` (original column names). */
function distinctProjection(rows: Record<string, unknown>[], columns: string[]): unknown[][] {
  const seen = new Set<string>();
  const out: unknown[][] = [];
  for (const row of rows) {
    const values = columns.map(c => row[c]);
    const key = JSON.stringify(values);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(values);
  }
  return out;
}

export function exportNormalizedData(schema: BuiltSchema, dialect: SQLDialect = 'sqlite'): ExportedFile[] {
  const decomposed = toDecomposedRelations(schema);
  const bySource = new Map(schema.relations.map(r => [r.name, r]));
  const files: ExportedFile[] = [];
  const inserts: string[] = [
    '-- NormaFlow normalized data',
    `-- Dialect: ${dialect.toUpperCase()}`,
    '-- Load after the CREATE TABLE statements; tables are ordered so parents come first.',
    '',
  ];
  const projected = new Map<string, unknown[][]>();

  for (const rel of decomposed) {
    const source = bySource.get(rel.sourceName ?? rel.name);
    if (!source) continue;
    const originals = rel.attributes.map(a => rel.columnSources?.[a] ?? a);
    const rows = distinctProjection(source.rows ?? [], originals);
    projected.set(rel.name, rows);

    files.push({
      name: `data_${rel.name}.csv`,
      type: 'csv',
      content: `${[rel.attributes.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n')}\n`,
    });

    if (rows.length > 0) {
      const table = quoteIdentifier(rel.name, dialect);
      const cols = rel.attributes.map(a => quoteIdentifier(a, dialect)).join(', ');
      inserts.push(`-- ${rel.name}: ${rows.length} row${rows.length === 1 ? '' : 's'}`);
      for (const row of rows) {
        const values = row.map((v, i) => sqlLiteral(v, rel.columnTypes?.[rel.attributes[i]] ?? 'TEXT')).join(', ');
        inserts.push(`INSERT INTO ${table} (${cols}) VALUES (${values});`);
      }
      inserts.push('');
    }
  }
  files.push({ name: 'data_inserts.sql', type: 'sql', content: `${inserts.join('\n')}\n` });
  files.push({ name: 'verify_foreign_keys.sql', type: 'sql', content: orphanChecks(decomposed, dialect) });
  return files;
}

/** One query per foreign key: rows whose key has no match in the parent (should all be 0). */
export function orphanChecks(relations: DecomposedRelation[], dialect: SQLDialect = 'sqlite'): string {
  const q = (s: string) => quoteIdentifier(s, dialect);
  const out = ['-- Post-load check: every query should return 0.', ''];
  for (const r of relations) {
    for (const fk of r.foreignKeys ?? []) {
      const on = fk.attributes.map((a, i) => `p.${q(fk.referencedKey[i])} = c.${q(a)}`).join(' AND ');
      const notNull = fk.attributes.map(a => `c.${q(a)} IS NOT NULL`).join(' AND ');
      out.push(`-- ${r.name}(${fk.attributes.join(', ')}) -> ${fk.references}(${fk.referencedKey.join(', ')})`);
      out.push(
        `SELECT COUNT(*) AS orphans FROM ${q(r.name)} c LEFT JOIN ${q(fk.references)} p ON ${on} WHERE ${notNull} AND p.${q(fk.referencedKey[0])} IS NULL;`,
      );
      out.push('');
    }
  }
  return `${out.join('\n')}\n`;
}
