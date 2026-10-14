import { EntityTag, CrossTableRelationship, TableData } from '../../types';
import { classifyColumn } from '../nlp/semanticProfiler';

export class RelationDetectorService {
  /**
   * Named Entity Recognition (NER) for CSV column headers and sample data.
   * Delegates to the NLP semantic profiler, which fuses column-name evidence
   * with value-pattern evidence.
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

  public static detectCrossTableRelationships(tables: TableData[]): CrossTableRelationship[] {
    const relationships: CrossTableRelationship[] = [];
    if (tables.length < 2) return relationships;

    const singular = (name: string) => name.toLowerCase().replace(/s$/, '').replace(/_table$/, '');

    const nameScore = (srcColLower: string, targetTableName: string, tgtColLower: string): number | null => {
      const targetSingular = singular(targetTableName);
      if (srcColLower === `${targetSingular}_id` && (tgtColLower === 'id' || tgtColLower === `${targetSingular}_id`)) return 0.95;
      if (tgtColLower === `${targetSingular}_id` && srcColLower === 'id') return -0.95; // reversed orientation
      if (srcColLower === tgtColLower && (srcColLower.endsWith('_id') || srcColLower === 'id')) return 0.6;
      return null;
    };

    for (let i = 0; i < tables.length; i++) {
      for (let j = 0; j < tables.length; j++) {
        if (i === j) continue;
        const source = tables[i];
        const target = tables[j];

        source.headers.forEach(srcCol => {
          const srcColLower = srcCol.toLowerCase();

          target.headers.forEach(tgtCol => {
            const tgtColLower = tgtCol.toLowerCase();
            const score = nameScore(srcColLower, target.tableName, tgtColLower);
            if (score === null || score < 0) return; // no match or reversed orientation is stronger

            // Directed containment: referencing values should exist in the
            // referenced set. Sampling keeps this O(sample) per pair.
            const srcSample = source.rows.slice(0, 1000).map(r => String(r[srcCol] ?? '').trim()).filter(Boolean);
            const tgtSet = new Set(
              target.rows.slice(0, 1000).map(r => String(r[tgtCol] ?? '').trim()).filter(Boolean),
            );
            if (srcSample.length === 0 || tgtSet.size === 0) return;

            let hits = 0;
            const srcSet = new Set<string>();
            srcSample.forEach(v => {
              srcSet.add(v);
              if (tgtSet.has(v)) hits++;
            });
            const matchRatio = hits / srcSet.size;
            if (matchRatio < 0.5) return; // same name, unrelated data

            const confidence = Math.min(0.98, Math.max(0.65, score * 0.7 + matchRatio * 0.3));

            const srcUnique = srcSet.size === srcSample.length;
            const cardinality: '1:1' | '1:N' | 'N:M' =
              srcUnique && matchRatio > 0.95 ? '1:1' : '1:N';

            const exists = relationships.some(r =>
              (r.sourceTable === source.tableName && r.targetTable === target.tableName && r.sourceColumn === srcCol && r.targetColumn === tgtCol) ||
              (r.sourceTable === target.tableName && r.targetTable === source.tableName && r.sourceColumn === tgtCol && r.targetColumn === srcCol),
            );

            if (!exists) {
              relationships.push({
                sourceTable: source.tableName,
                sourceColumn: srcCol,
                targetTable: target.tableName,
                targetColumn: tgtCol,
                cardinality,
                confidence,
                matchRatio,
                detectedBy: 'VALUE_OVERLAP',
              });
            }
          });
        });
      }
    }

    return relationships;
  }
}
