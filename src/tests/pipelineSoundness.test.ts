import { describe, expect, it } from 'vitest';
import { DatabaseService } from '../services/api/databaseService';
import { chooseKey, isUniqueAndComplete } from '../services/processors/keySelection';
import { verifyLosslessOnData } from '../services/processors/instanceVerification';
import { detectForeignKeys } from '../services/processors/foreignKeyDetector';
import { inferColumnSqlType } from '../services/utils/sqlTypes';
import { IdentifierRegistry, mdEscape } from '../services/utils/identifiers';

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' });

const ALL_OPS = [
  'CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler', 'NER Classifier', '1NF',
  'FD Miner', 'Key Discovery', 'Relation Detector', 'Cardinality Analyzer', '2NF', '3NF', 'Lossless Check',
  'Dependency Preservation', 'ERD Generator', 'Relation Generator', 'SQL Generator', 'Report Generator',
];

describe('key selection', () => {
  const rows = [
    { code: 'a', order_id: 1, sku: 'x' },
    { code: 'b', order_id: 2, sku: 'x' },
    { code: 'c', order_id: 3, sku: 'y' },
  ];

  it('prefers an identifier-looking unique column over other candidate keys', () => {
    const choice = chooseKey(['code', 'order_id', 'sku'], rows.map(r => ({ ...r })), [['code'], ['order_id']]);
    expect(choice.primaryKey).toEqual(['order_id']);
    expect(choice.rule).toBe('identifier-column');
  });

  it('rejects keys with missing cells and adds a surrogate instead', () => {
    const data = [{ a: '1', b: 'x' }, { a: '', b: 'y' }, { a: '1', b: 'x' }];
    const attrs = ['a', 'b'];
    const choice = chooseKey(attrs, data, [['a', 'b']]);
    expect(choice.surrogateAdded).toBe(true);
    expect(attrs[0]).toBe(choice.surrogateColumn);
    expect(data.map(r => (r as any)[choice.surrogateColumn!])).toEqual([1, 2, 3]);
  });

  it('isUniqueAndComplete detects duplicates and blanks', () => {
    expect(isUniqueAndComplete(rows, ['code'])).toBe(true);
    expect(isUniqueAndComplete(rows, ['sku'])).toBe(false);
    expect(isUniqueAndComplete([{ k: '' }], ['k'])).toBe(false);
  });
});

describe('instance-level lossless check', () => {
  const rows = [
    { order: 1, customer: 'c1', city: 'Paris' },
    { order: 2, customer: 'c1', city: 'Paris' },
    { order: 3, customer: 'c2', city: 'Rome' },
    { order: 4, customer: 'c3', city: 'Paris' },
  ];

  it('accepts a decomposition whose FDs really hold', () => {
    const r = verifyLosslessOnData(rows, [['order', 'customer'], ['customer', 'city']]);
    expect(r.lossless).toBe(true);
  });

  it('reports spurious rows for a lossy split', () => {
    const r = verifyLosslessOnData(rows, [['order', 'city'], ['customer', 'city']]);
    expect(r.lossless).toBe(false);
    expect(r.spuriousRows).toBeGreaterThan(0);
  });
});

describe('foreign key detection from data', () => {
  const customers = {
    tableName: 'customers',
    headers: ['customer_id', 'name'],
    rows: Array.from({ length: 20 }, (_, i) => ({ customer_id: String(i + 1), name: `n${i}` })),
  };

  it('finds a conventionally named key', () => {
    const orders = {
      tableName: 'orders',
      headers: ['order_id', 'customer_id'],
      rows: Array.from({ length: 40 }, (_, i) => ({ order_id: String(100 + i), customer_id: String((i % 20) + 1) })),
    };
    const fks = detectForeignKeys([customers, orders]);
    expect(fks.map(f => `${f.sourceTable}.${f.sourceColumn}->${f.targetTable}.${f.targetColumn}`)).toContain(
      'orders.customer_id->customers.customer_id',
    );
  });

  it('finds an unconventionally named key from values alone', () => {
    const tickets = {
      tableName: 'tickets',
      headers: ['ticket', 'buyer'],
      rows: Array.from({ length: 30 }, (_, i) => ({ ticket: `T${i}`, buyer: String(((i * 7) % 20) + 1) })),
    };
    const keyed = { ...customers, rows: customers.rows.map(r => ({ ...r, customer_id: `${r.customer_id}` })) };
    // Shift ids away from a dense 1..n run so accidental containment is not the explanation.
    const sparse = { ...keyed, rows: keyed.rows.map((r, i) => ({ ...r, customer_id: String(1000 + i * 3) })) };
    const sparseTickets = { ...tickets, rows: tickets.rows.map((r, i) => ({ ...r, buyer: String(1000 + (i % 20) * 3) })) };
    const fks = detectForeignKeys([sparse, sparseTickets]);
    expect(fks.some(f => f.sourceTable === 'tickets' && f.sourceColumn === 'buyer' && f.targetTable === 'customers')).toBe(true);
  });

  it('rejects accidental containment between two auto-increment ids', () => {
    const a = { tableName: 'alpha', headers: ['id'], rows: Array.from({ length: 50 }, (_, i) => ({ id: String(i + 1) })) };
    const b = { tableName: 'beta', headers: ['id', 'qty'], rows: Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), qty: String(i) })) };
    expect(detectForeignKeys([a, b])).toEqual([]);
  });

  it('marks nullable foreign keys optional', () => {
    const orders = {
      tableName: 'orders',
      headers: ['order_id', 'customer_id'],
      rows: Array.from({ length: 40 }, (_, i) => ({ order_id: String(i), customer_id: i % 5 === 0 ? '' : String((i % 20) + 1) })),
    };
    const fk = detectForeignKeys([customers, orders]).find(f => f.sourceTable === 'orders');
    expect(fk?.optional).toBe(true);
  });
});

describe('SQL type inference', () => {
  it('keeps zero-padded digit strings as text', () => {
    expect(inferColumnSqlType(['00501', '10001']).sqlType).toMatch(/^VARCHAR/);
  });
  it('sizes integers, decimals, dates and booleans from the data', () => {
    expect(inferColumnSqlType(['1', '2']).sqlType).toBe('INTEGER');
    expect(inferColumnSqlType(['3000000000']).sqlType).toBe('BIGINT');
    expect(inferColumnSqlType(['10.50', '3.1']).sqlType).toMatch(/^DECIMAL\(\d+,2\)$/);
    expect(inferColumnSqlType(['2024-01-31']).sqlType).toBe('DATE');
    expect(inferColumnSqlType(['true', 'FALSE']).sqlType).toBe('BOOLEAN');
  });
  it('reports NOT NULL only for complete columns', () => {
    expect(inferColumnSqlType(['a', 'b']).notNull).toBe(true);
    expect(inferColumnSqlType(['a', '']).notNull).toBe(false);
  });
});

describe('identifiers', () => {
  it('never lets two different names collapse into one', () => {
    const reg = new IdentifierRegistry();
    expect(reg.assign('Order Date')).not.toBe(reg.assign('Order-Date'));
  });
  it('escapes markup so hostile headers cannot inject HTML or table cells', () => {
    const out = mdEscape('<img src=x onerror=alert(1)>|`x`');
    // Every markup character is backslash-escaped, so Markdown renders it as text.
    expect(out).not.toMatch(/(^|[^\\])[<>|`]/);
  });
});

describe('multi-file pipeline (TypeScript engine)', () => {
  const orders = [
    'order_id,customer_id,customer_name,city,product,price',
    ...Array.from({ length: 12 }, (_, i) => {
      const c = (i % 4) + 1;
      return `${100 + i},${c},Cust ${c},City ${c % 2},Prod ${i % 3},${(10 + i).toFixed(2)}`;
    }),
  ].join('\n');
  const products = ['sku,product,list_price', 'P0,Prod 0,9.99', 'P1,Prod 1,19.99', 'P2,Prod 2,29.99'].join('\n');

  it('normalizes each file, links them, and builds the ERD and SQL from the normalized relations', async () => {
    const service = new DatabaseService();
    const result = await service.processFiles(
      [csv('orders.csv', orders), csv('products.csv', products)],
      ALL_OPS,
    );
    expect(result.success).toBe(true);
    expect(result.tables).toHaveLength(2);

    const ordersTable = result.tables!.find(t => t.tableName === 'orders')!;
    // The Rust-only path used to leave these empty.
    expect(ordersTable.functionalDependencies.length).toBeGreaterThan(0);
    expect(ordersTable.thirdNormalForm.length).toBeGreaterThan(1);

    // city depends on the customer, not on the order, so it must not sit in the same relation as order_id.
    const withCity = ordersTable.thirdNormalForm.filter(r => r.attributes.includes('city'));
    expect(withCity.length).toBeGreaterThan(0);
    expect(withCity.some(r => r.attributes.includes('order_id'))).toBe(false);

    // The relation that holds order_id is keyed by the key chosen for the table.
    const rels = result.relations as Array<{ name: string; attributes: string[]; primaryKey: string[]; foreignKeys: any[] }>;
    const main = rels.find(r => r.name === 'orders')!;
    expect(main.primaryKey).toEqual(['order_id']);

    // The cross-file link lands on the normalized relation, not on a raw file header.
    expect(main.foreignKeys.some(fk => fk.references === 'products')).toBe(true);

    expect(result.erdDiagram).toMatch(/^erDiagram/);
    expect(result.erdDiagram).toMatch(/products \|\|--o\{ orders/);
    expect(result.sqlStatements).toContain('CREATE TABLE');
    expect(result.reportMarkdown).toContain('Per-table analysis');
  });

  it('respects the selected operations: no 3NF node means no normalized relations', async () => {
    const service = new DatabaseService();
    const result = await service.processFiles(
      [csv('orders.csv', orders), csv('products.csv', products)],
      ['CSV Data Loader', 'Data Cleaner', 'FD Miner', 'Key Discovery'],
    );
    expect(result.success).toBe(true);
    for (const t of result.tables!) expect(t.thirdNormalForm).toEqual([]);
    expect(result.sqlStatements).toBe('');
  });
});

describe('soundness: approximate dependencies do not shape the schema', () => {
  it('a single dirty row does not create a lossy decomposition', async () => {
    const lines = ['order_id,customer_id,city'];
    for (let i = 0; i < 40; i++) lines.push(`${i},${(i % 5) + 1},City ${(i % 5) + 1}`);
    lines.push('99,1,Atlantis'); // customer 1 now has two cities: customer_id -> city is only 97.6% true
    const result = await new DatabaseService().processFile(csv('orders.csv', lines.join('\n')), ALL_OPS);
    expect(result.success).toBe(true);
    // Whatever was decomposed must re-join to exactly the input rows.
    expect(result.losslessCheck.instanceLossless).not.toBe(false);
    expect(result.losslessCheck.isLossless).toBe(true);
  });
});
