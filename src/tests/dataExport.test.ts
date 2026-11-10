import { describe, it, expect } from 'vitest';
import { exportNormalizedData, csvCell } from '../services/processors/dataExport';
import { DatabaseService } from '../services/api/databaseService';

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' });
const OPS = ['CSV Data Loader', 'Data Cleaner', 'FD Miner', 'Key Discovery', '2NF', '3NF', 'SQL Generator', 'ERD Generator', 'Report Generator'];

describe('normalized data export', () => {
  it('quotes CSV cells', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
  });

  it('multi-file run ships deduplicated CSVs, INSERTs and orphan checks', async () => {
    const orders = ['order_id,customer_id,city'];
    for (let i = 0; i < 20; i++) orders.push(`${100 + i},${(i % 4) + 1},City ${(i % 4) + 1}`);
    const customers = ['customer_id,name', ...[1, 2, 3, 4].map(i => `${i},Name ${i}`)];
    const result = await new DatabaseService().processFiles(
      [csv('orders.csv', orders.join('\n')), csv('customers.csv', customers.join('\n'))],
      OPS,
    );
    expect(result.success).toBe(true);
    const names = result.outputFiles.map(f => f.name);
    expect(names).toContain('data_inserts.sql');
    expect(names).toContain('verify_foreign_keys.sql');
    expect(names.filter(n => n.startsWith('data_') && n.endsWith('.csv')).length).toBeGreaterThanOrEqual(2);
    // city depends on the customer, so its CSV has one row per customer, not per order.
    const cityCsv = result.outputFiles.find(f => f.name.endsWith('.csv') && String(f.content).includes('City 1'))!;
    expect(String(cityCsv.content).trim().split('\n').length).toBeLessThanOrEqual(5);
    expect(exportNormalizedData).toBeTypeOf('function');
  });
});
