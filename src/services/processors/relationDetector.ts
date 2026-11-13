import { EntityTag, CrossTableRelationship, TableData } from '../../types';
import { classifyColumn } from '../nlp/semanticProfiler';
import { detectForeignKeys } from './foreignKeyDetector';

export class RelationDetectorService {
  /**
   * Classifies a column (identifier, person name, price, date, ...) from its header and sample values.
   * Delegates to the semantic profiler, which fuses column-name evidence with value-pattern evidence.
   * Rule-based; it is not a trained named-entity-recognition model.
   */
  public static classifyColumnEntity(tableName: string, colName: string, sampleValues: any[]): EntityTag {
    const samples = sampleValues
      .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
      .map(v => String(v).trim());
    const distinct = new Set(samples).size;

    return classifyColumn({
      tableName: tableName.toLowerCase(),
      columnName: colName,
      columnIndex: -1,
      stats: { samples, filled: samples.length, distinct },
    });
  }

  public static performNER(tables: { tableName: string; headers: string[]; rows: any[]; rowCount?: number }[]): { [tableName: string]: EntityTag[] } {
    const results: { [tableName: string]: EntityTag[] } = {};

    tables.forEach(table => {
      const tags: EntityTag[] = [];
      table.headers.forEach((header, columnIndex) => {
        const samples: string[] = [];
        const seen = new Set<string>();
        let filled = 0;
        // Bounded scan: gather up to 24 distinct samples without copying rows.
        const limit = Math.min(table.rows.length, 2000);
        for (let i = 0; i < limit && samples.length < 24; i++) {
          const raw = table.rows[i]?.[header];
          if (raw === null || raw === undefined || String(raw).trim() === '') continue;
          filled++;
          const v = String(raw).trim();
          if (!seen.has(v)) {
            seen.add(v);
            samples.push(v);
          }
        }
        const rowCount = table.rowCount ?? table.rows.length;
        // If nearly everything sampled is distinct, treat the full row count
        // as the distinct estimate (high-cardinality identifier shape).
        const distinct = filled > 0 && seen.size / filled > 0.9 ? rowCount : seen.size;

        tags.push(classifyColumn({
          tableName: table.tableName.toLowerCase(),
          columnName: header,
          columnIndex,
          stats: { samples, filled, distinct },
        }));
      });
      results[table.tableName] = tags;
    });

    return results;
  }

  /**
   * Foreign-key discovery from the data (inclusion dependencies scored with
   * name, type and coverage evidence). See `foreignKeyDetector.ts`.
   */
  public static detectCrossTableRelationships(tables: TableData[]): CrossTableRelationship[] {
    return detectForeignKeys(
      tables.map(t => ({
        tableName: t.tableName,
        headers: t.headers,
        rows: t.rows,
        primaryKey: t.primaryKey,
      })),
    );
  }
}
