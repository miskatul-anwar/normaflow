import { describe, it, expect } from 'vitest';
import { NormalizationEngine } from '../services/processors/normalizationEngine';
import { buildSchema, emitMermaidErd, toDecomposedRelations } from '../services/processors/schemaGraph';
import { detectForeignKeys } from '../services/processors/foreignKeyDetector';
import { DatabaseService } from '../services/api/databaseService';

/** Golden-file tests: outputs are compared with committed snapshots (`__snapshots__`). */

const customers = {
  tableName: 'customers',
  headers: ['customer_id', 'name'],
  primaryKey: ['customer_id'],
  rows: Array.from({ length: 6 }, (_, i) => ({ customer_id: String(i + 1), name: `Name ${i + 1}` })),
};
const orders = {
  tableName: 'orders',
  headers: ['order_id', 'customer_id', 'order date', 'total'],
  primaryKey: ['order_id'],
  rows: Array.from({ length: 12 }, (_, i) => ({
    order_id: String(100 + i),
    customer_id: String((i % 6) + 1),
    'order date': `2024-01-${String(i + 1).padStart(2, '0')}`,
    total: (10 + i * 1.5).toFixed(2),
  })),
};

const stable = (sql: string) => sql.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<time>');

describe('golden output', () => {
  const tables = [customers, orders];
  const schema = buildSchema(
    tables.map(t => ({ ...t, relations: [] })),
    detectForeignKeys(tables),
  );

  it('multi-file ER diagram', () => {
    expect(emitMermaidErd(schema)).toMatchSnapshot();
  });

  it('multi-file DDL (sqlite)', () => {
    expect(stable(DatabaseService.generateDDL(toDecomposedRelations(schema), 'sqlite'))).toMatchSnapshot();
  });

  it('multi-file DDL (postgres)', () => {
    expect(stable(DatabaseService.generateDDL(toDecomposedRelations(schema), 'postgresql'))).toMatchSnapshot();
  });

  it('single-file ER diagram and DDL', async () => {
    const rel = {
      name: 'orders',
      attributes: ['order_id', 'order date', 'total'],
      primaryKey: ['order_id'],
      foreignKeys: [],
      rows: orders.rows,
      sourceType: '3NF',
      originalFD: { lhs: ['order_id'], rhs: 'total', confidence: 1 },
      metadata: { rowCount: orders.rows.length, attributeTypes: {} },
    } as any;
    const erd = (await NormalizationEngine.generateERD([rel])).content.replace(/Generated: .*/, 'Generated: <time>');
    expect(erd).toMatchSnapshot();
    const ddl = (await NormalizationEngine.generateSQLDDL([rel])).replace(/-- Generated.*\n/g, '');
    expect(ddl.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<time>')).toMatchSnapshot();
  });
});
