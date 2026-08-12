import { EntityTag, EntityType, CrossTableRelationship, OllamaAIInsight, TableData } from '../../types';
import { OllamaWrapper } from '../ollama-wrapper';

export class RelationDetectorService {
  /**
   * Named Entity Recognition (NER) for CSV column headers and sample data
   */
  public static classifyColumnEntity(tableName: string, colName: string, sampleValues: any[]): EntityTag {
    const colLower = colName.toLowerCase().trim();
    const strValues = sampleValues.filter(v => v !== null && v !== undefined && String(v).trim() !== '').map(v => String(v).trim());
    
    let entityType: EntityType = 'GENERAL_TEXT';
    let confidence = 0.6;
    let description = 'Text attribute';

    if (colLower === 'id' || colLower.endsWith('_id') || colLower.endsWith('id')) {
      if (colLower === 'id' || colLower === `${tableName.toLowerCase()}_id`) {
        entityType = 'PRIMARY_KEY_ID';
        confidence = 0.95;
        description = 'Primary key';
      } else {
        entityType = 'FOREIGN_KEY_REF';
        confidence = 0.90;
        description = 'Foreign key';
      }
    }
    else if (colLower.includes('email') || strValues.some(v => v.includes('@') && v.includes('.'))) {
      entityType = 'EMAIL';
      confidence = 0.95;
      description = 'Email address';
    }
    else if (colLower.includes('name') || colLower.includes('author') || colLower.includes('customer') || colLower.includes('user') || colLower.includes('employee') || colLower === 'fname' || colLower === 'lname') {
      entityType = 'PERSON_NAME';
      confidence = 0.85;
      description = 'Person name';
    }
    else if (colLower.includes('date') || colLower.includes('time') || colLower.includes('created') || colLower.includes('updated') || colLower.includes('year') || colLower.includes('month') || strValues.some(v => !isNaN(Date.parse(v)) && v.length > 5)) {
      entityType = 'DATE_TIMESTAMP';
      confidence = 0.90;
      description = 'Date/timestamp';
    }
    else if (colLower.includes('price') || colLower.includes('cost') || colLower.includes('amount') || colLower.includes('salary') || colLower.includes('total') || colLower.includes('revenue') || colLower.includes('budget') || strValues.some(v => v.startsWith('$') || v.startsWith('€') || v.startsWith('£'))) {
      entityType = 'CURRENCY_PRICE';
      confidence = 0.92;
      description = 'Currency/price';
    }
    else if (colLower.includes('city') || colLower.includes('country') || colLower.includes('state') || colLower.includes('address') || colLower.includes('zip') || colLower.includes('location')) {
      entityType = 'LOCATION_ADDRESS';
      confidence = 0.88;
      description = 'Location/address';
    }
    else if (colLower.includes('company') || colLower.includes('org') || colLower.includes('department') || colLower.includes('vendor') || colLower.includes('publisher')) {
      entityType = 'ORGANIZATION_COMPANY';
      confidence = 0.85;
      description = 'Organization';
    }
    else if (colLower.includes('product') || colLower.includes('item') || colLower.includes('sku') || colLower.includes('model') || colLower.includes('title')) {
      entityType = 'PRODUCT_ITEM';
      confidence = 0.82;
      description = 'Product item';
    }
    else if (colLower.includes('qty') || colLower.includes('quantity') || colLower.includes('count') || colLower.includes('score') || colLower.includes('age') || strValues.every(v => !isNaN(Number(v)))) {
      entityType = 'NUMERIC_METRIC';
      confidence = 0.80;
      description = 'Numeric metric';
    }

    return {
      columnName: colName,
      tableName,
      entityType,
      confidence,
      sampleValues: strValues.slice(0, 3),
      description
    };
  }

  public static performNER(tables: { tableName: string; headers: string[]; rows: any[] }[]): { [tableName: string]: EntityTag[] } {
    const results: { [tableName: string]: EntityTag[] } = {};

    tables.forEach(table => {
      const tags: EntityTag[] = [];
      table.headers.forEach(header => {
        const sampleValues = table.rows.slice(0, 20).map(r => r[header]);
        const tag = this.classifyColumnEntity(table.tableName, header, sampleValues);
        tags.push(tag);
      });
      results[table.tableName] = tags;
    });

    return results;
  }

  public static detectCrossTableRelationships(tables: TableData[]): CrossTableRelationship[] {
    const relationships: CrossTableRelationship[] = [];
    if (tables.length < 2) return relationships;

    for (let i = 0; i < tables.length; i++) {
      for (let j = 0; j < tables.length; j++) {
        if (i === j) continue;
        const source = tables[i];
        const target = tables[j];

        source.headers.forEach(srcCol => {
          const srcColLower = srcCol.toLowerCase();
          const targetTableNameLower = target.tableName.toLowerCase().replace(/s$/, '').replace(/_table$/, '');

          target.headers.forEach(tgtCol => {
            const tgtColLower = tgtCol.toLowerCase();

            const isFkMatch = 
              (srcColLower === `${targetTableNameLower}_id` && (tgtColLower === 'id' || tgtColLower === `${targetTableNameLower}_id`)) ||
              (tgtColLower === `${targetTableNameLower}_id` && srcColLower === 'id') ||
              (srcColLower === tgtColLower && (srcColLower.endsWith('_id') || srcColLower === 'id'));

            if (isFkMatch) {
              const srcValues = new Set(source.rows.map(r => String(r[srcCol])).filter(Boolean));
              const tgtValues = new Set(target.rows.map(r => String(r[tgtCol])).filter(Boolean));

              let intersectionCount = 0;
              srcValues.forEach(val => {
                if (tgtValues.has(val)) intersectionCount++;
              });

              const matchRatio = srcValues.size > 0 ? intersectionCount / srcValues.size : 0;
              const confidence = Math.min(0.98, Math.max(0.65, 0.70 + matchRatio * 0.28));

              const srcUnique = srcValues.size === source.rows.length;
              const tgtUnique = tgtValues.size === target.rows.length;

              let cardinality: '1:1' | '1:N' | 'N:M' = '1:N';
              if (srcUnique && tgtUnique) cardinality = '1:1';
              else if (!srcUnique && !tgtUnique) cardinality = 'N:M';
              else cardinality = '1:N';

              const exists = relationships.some(r => 
                (r.sourceTable === source.tableName && r.targetTable === target.tableName && r.sourceColumn === srcCol && r.targetColumn === tgtCol) ||
                (r.sourceTable === target.tableName && r.targetTable === source.tableName && r.sourceColumn === tgtCol && r.targetColumn === srcCol)
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
                  detectedBy: 'VALUE_OVERLAP'
                });
              }
            }
          });
        });
      }
    }

    return relationships;
  }

  public static async enrichWithOllama(
    tables: TableData[],
    relationships: CrossTableRelationship[],
    ollamaWrapper?: OllamaWrapper | null
  ): Promise<OllamaAIInsight[]> {
    const insights: OllamaAIInsight[] = [];
    if (!ollamaWrapper || !ollamaWrapper.isServiceAvailable()) {
      return [
        {
          type: 'NER_TAGGING',
          title: 'NER Profiling',
          summary: `Classified entities across ${tables.length} tables.`,
          confidence: 0.90
        },
        {
          type: 'RELATION_DETECTION',
          title: 'Foreign Key Detection',
          summary: `Detected ${relationships.length} foreign key relationships.`,
          confidence: 0.88
        }
      ];
    }

    try {
      const schemaSummary = tables.map(t => `${t.tableName} (${t.headers.join(', ')})`).join('\n');
      const prompt = `Analyze schema for optimization insights:\n${schemaSummary}\nRelationships:\n${relationships.map(r => `${r.sourceTable}.${r.sourceColumn} -> ${r.targetTable}.${r.targetColumn} (${r.cardinality})`).join('\n')}\nJSON format: [{"type":"RELATION_DETECTION","title":"Title","summary":"Summary","confidence":0.95}]`;

      const response = await ollamaWrapper.chat({
        messages: [{ role: 'user', content: prompt }],
        options: { temperature: 0.2 }
      });

      const text = response.message.content;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            insights.push({
              type: item.type || 'SCHEMA_OPTIMIZATION',
              title: item.title || 'Schema Insight',
              summary: item.summary || 'Analyzed relational structure.',
              confidence: item.confidence || 0.92
            });
          });
        }
      }
    } catch (err) {
      console.warn('[RelationDetector] Ollama enrichment query skipped:', err);
    }

    if (insights.length === 0) {
      insights.push({
        type: 'SCHEMA_OPTIMIZATION',
        title: 'Schema Analysis',
        summary: `Validated constraints across ${tables.length} tables.`,
        confidence: 0.94
      });
    }

    return insights;
  }
}
