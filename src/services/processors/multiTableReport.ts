/**
 * Markdown report for a multi-file run. Everything that comes from the input
 * files (names, headers, values) is escaped, because the report is rendered.
 */

import type { CrossTableRelationship } from '../../types';
import type { TableAnalysis } from '../api/databaseService';
import { mdEscape } from '../utils/identifiers';
import type { BuiltSchema } from './schemaGraph';

export interface TableReportInput {
  tableName: string;
  fileName: string;
  rowCount: number;
  headers: string[];
  analysis: TableAnalysis;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
// Inside a code span only backticks and line breaks matter; backslash escapes are not processed there.
const code = (s: string) => `\`${String(s).replace(/`/g, "'").replace(/\r?\n/g, ' ')}\``;
const list = (xs: string[]) => xs.map(code).join(', ');

export function buildMultiTableReport(args: {
  tables: TableReportInput[];
  links: CrossTableRelationship[];
  schema: BuiltSchema;
  dialect: string;
  selectedOperations: string[];
}): string {
  const { tables, links, schema, dialect } = args;
  const out: string[] = [];

  out.push('# Multi-CSV Database Normalization Report', '');
  out.push(`**Files**: ${tables.map(t => mdEscape(t.fileName)).join(', ')}`);
  out.push(`**Tables analysed**: ${tables.length}`);
  out.push(`**Relations after normalization**: ${schema.relations.length}`);
  out.push(`**Cross-table foreign keys**: ${links.length}`);
  out.push(`**SQL dialect**: ${mdEscape(dialect)}`, '');

  out.push('## 1. Per-table analysis', '');
  for (const t of tables) {
    const a = t.analysis;
    out.push(`### ${code(t.tableName)} (${t.rowCount} rows, ${a.attributes.length} columns)`, '');
    out.push(`- **Source file**: ${mdEscape(t.fileName)}`);
    if (a.keyChoice) {
      out.push(`- **Primary key**: ${list(a.keyChoice.primaryKey)} — ${mdEscape(a.keyChoice.reason)}`);
    }
    if (a.keyResult?.candidateKeys?.length) {
      out.push(`- **Candidate keys**: ${a.keyResult.candidateKeys.map((k: string[]) => `{${list(k)}}`).join(', ')}`);
    }
    if (a.fdSearch) {
      out.push(
        `- **Functional dependencies**: ${a.fdSearch.exact} exact (used), ${a.fdSearch.approximate} approximate ` +
          `(${a.fdSearch.approximateUsed ? 'used' : 'not used'})`,
      );
      if (a.fdSearch.truncated) {
        out.push(`- **Search limit**: stopped after determinants of size ${a.fdSearch.levelReached}`);
      }
    }
    const finalRels = a.relations3NF.length ? a.relations3NF : a.relations2NF;
    if (finalRels.length) {
      out.push('- **Normalized relations**:');
      for (const r of finalRels) {
        out.push(`  - ${code(r.name)}: ${list(r.attributes)} (key: ${list(r.primaryKey)})`);
      }
    }
    if (a.losslessCheck && 'chaseLossless' in a.losslessCheck) {
      const inst = a.losslessCheck.instanceLossless;
      out.push(
        `- **Lossless join**: ${a.losslessCheck.chaseLossless ? 'yes' : 'no'} by the chase; ` +
          `${inst === null ? 'not decided on data' : inst ? 'confirmed on the data' : 'NOT reproduced by the data'}`,
      );
    }
    if (a.dependencyPreservation && 'preservedCount' in a.dependencyPreservation) {
      const d = a.dependencyPreservation;
      out.push(`- **Dependency preservation**: ${d.preservedCount}/${d.totalDependencies} preserved` +
        (d.lostCount ? ` (${d.lostCount} lost)` : ''));
    }
    for (const note of a.notes) out.push(`- ⚠️ ${mdEscape(note)}`);
    out.push('');
  }

  out.push('## 2. Cross-table relationships', '');
  if (links.length > 0) {
    out.push('| From | To | Cardinality | Nullable | Containment | Confidence |');
    out.push('| :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const l of links) {
      out.push(
        `| ${code(`${l.sourceTable}.${(l.sourceColumns ?? [l.sourceColumn]).join(' + ')}`)} | ${code(`${l.targetTable}.${(l.targetColumns ?? [l.targetColumn]).join(' + ')}`)} | ` +
          `${l.cardinality} | ${l.optional ? 'yes' : 'no'} | ${pct(l.matchRatio)} | ${pct(l.confidence)} |`,
      );
    }
  } else {
    out.push('*No foreign keys were detected between the files.*');
  }
  out.push('');

  if (schema.junctions.length > 0) {
    out.push('### Many-to-many relationships (junction tables)', '');
    for (const j of schema.junctions) {
      out.push(`- ${code(j.relation)} links ${j.between.map(code).join(' ↔ ')}`);
    }
    out.push('');
  }

  if (schema.unplaced.length > 0) {
    out.push('### Links that could not be placed', '');
    for (const u of schema.unplaced) {
      out.push(
        `- ${code(`${u.link.sourceTable}.${(u.link.sourceColumns ?? [u.link.sourceColumn]).join(' + ')}`)} → ${code(`${u.link.targetTable}.${(u.link.targetColumns ?? [u.link.targetColumn]).join(' + ')}`)}: ${mdEscape(u.reason)}`,
      );
    }
    out.push('');
  }

  out.push('## 3. Final schema', '');
  out.push('| Relation | Columns | Primary key | Foreign keys |');
  out.push('| :--- | :--- | :--- | :--- |');
  for (const r of schema.relations) {
    const fks = r.foreignKeys.map(fk => `${list(fk.attributes)} → ${code(fk.references)}`).join('; ') || '—';
    out.push(`| ${code(r.name)} | ${list(r.attributes)} | ${list(r.primaryKey)} | ${fks} |`);
  }
  out.push('');
  return out.join('\n');
}
