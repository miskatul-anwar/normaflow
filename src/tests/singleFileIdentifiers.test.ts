import { describe, it, expect } from 'vitest';
import { NormalizationEngine } from '../services/processors/normalizationEngine';

const rel = (rows: any[]) => ({
  name: 'Sales Data',
  attributes: ['Order Date', 'Order-Date', 'qty'],
  primaryKey: ['qty'],
  foreignKeys: [],
  rows,
  sourceType: '3NF',
  originalFD: { lhs: ['qty'], rhs: 'Order Date', confidence: 1 },
  metadata: { rowCount: rows.length, attributeTypes: {} },
});

describe('single-file output keeps colliding identifiers apart', () => {
  const rows = [
    { 'Order Date': '2024-01-01', 'Order-Date': '2024-02-01', qty: 5 },
    { 'Order Date': '2024-01-02', 'Order-Date': '2024-02-02', qty: 7 },
  ];

  it('DDL gives distinct column names and sized types', async () => {
    const sql = await NormalizationEngine.generateSQLDDL([rel(rows) as any]);
    expect(sql).toMatch(/Order_Date\s+DATE/);
    expect(sql).toMatch(/Order_Date_2\s+DATE/);
    expect(sql).toMatch(/qty\s+INTEGER/);
  });

  it('ERD gives distinct attribute names', async () => {
    const { content } = await NormalizationEngine.generateERD([rel(rows) as any]);
    expect(content).toContain('Order_Date_2');
  });
});
