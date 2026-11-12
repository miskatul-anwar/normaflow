import { describe, it, expect } from 'vitest';
import { DatabaseService } from '../services/api/databaseService';
import { cleanModelName, mainOf, nameRelationSet, relationSignature } from '../services/naming/relationNames';
import { namingMessages } from '../services/naming/namingPrompt';

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' });
const OPS = ['CSV Data Loader', 'Atomicity Checker', '1NF', 'FD Miner', 'Key Discovery', '2NF', '3NF', 'Lossless Check', 'ERD Generator', 'SQL Generator', 'Report Generator'];
// order_id -> customer_id -> customer_city: a transitive dependency, so 3NF splits out the customer columns.
const orders = (() => {
  const lines = ['order_id,customer_id,customer_city,total'];
  for (let i = 1; i <= 40; i++) lines.push(`${i},${(i % 5) + 1},city${(i % 5) + 1},${i * 3}`);
  return lines.join('\n');
})();

describe('cleanModelName', () => {
  it('accepts a short noun phrase and capitalises it', () => {
    expect(cleanModelName('order line', ['a'])).toBe('Order line');
    expect(cleanModelName('"Customer".', ['a'])).toBe('Customer');
    expect(cleanModelName('Customer table', ['a'])).toBe('Customer');
  });
  it.each(['', 'The table is called customers', 'a, b, c', 'x'.repeat(50), 'one two three four five', 'Order 2', 'customer_id'])(
    'rejects %j',
    raw => expect(cleanModelName(raw, ['customer_id'])).toBeNull(),
  );
});

describe('nameRelationSet', () => {
  const rel = (name: string, attributes: string[], primaryKey: string[]) => ({ name, attributes, primaryKey, foreignKeys: [] as Array<{ references: string }> });
  it('keeps the table name for the key holder, uses chosen names, placeholders otherwise, and fixes foreign keys', () => {
    const main = rel('relation_1', ['id', 'cust'], ['id']);
    const a = rel('relation_2', ['cust', 'city'], ['cust']);
    const b = rel('relation_3', ['x', 'y'], ['x']);
    main.foreignKeys.push({ references: 'relation_2' });
    const chosen = new Map([[relationSignature('orders', a), { text: 'Customer', source: 'model' as const }]]);
    nameRelationSet([main, a, b], { tableName: 'orders', primaryKey: ['id'], chosen });
    expect(main.name).toBe('orders');
    expect(a.name).toBe('Customer');
    expect((a as any).nameSource).toBe('model');
    expect(b.name).toBe('relation_3');
    expect((b as any).nameSource).toBe('placeholder');
    expect(main.foreignKeys[0].references).toBe('Customer');
  });
});

describe('mainOf', () => {
  it('keeps the file name on the linking relation when no relation holds the whole key', () => {
    const rel = (name: string, attributes: string[], primaryKey: string[]) => ({ name, attributes, primaryKey });
    const customers = rel('c', ['customer_id', 'customer_name', 'customer_city'], ['customer_city', 'customer_name']);
    const orders = rel('o', ['order_id', 'customer_id', 'order_date'], ['order_id']);
    const lines = rel('l', ['order_id', 'product_name', 'quantity'], ['order_id', 'product_name']);
    const products = rel('p', ['product_id', 'product_name', 'unit_price'], ['product_name']);
    // The table's key was (order_id, product_id), but the decomposition used the equivalent product_name.
    expect(mainOf([customers, orders, lines, products], ['order_id', 'product_id'])).toBe(lines);
  });
});

describe('naming prompt', () => {
  it('contains column names only, never data', () => {
    const text = JSON.stringify(namingMessages(['order_id', 'total']));
    expect(text).toContain('order_id, total');
  });
});

describe('engine naming', () => {
  it('without a namer, relations are unnamed ids and nothing is built from column names', async () => {
    const r = await new DatabaseService().processFile(csv('orders.csv', orders), OPS);
    const names = (r.relations as any[]).map(x => x.name);
    expect(names).toContain('orders');
    for (const n of names.filter(n => n !== 'orders')) expect(n).toMatch(/^relation_\d+$/);
    expect(r.outputFiles.map(f => f.content).join('\n')).not.toMatch(/customer_id_customer_city|orders_customer/);
  });

  it('uses the model answer, never sends sample values, and the user name wins', async () => {
    const asked: Array<{ key: string; columns: string[] }> = [];
    const namer = async (items: Array<{ key: string; columns: string[] }>) => {
      asked.push(...items);
      return Object.fromEntries(items.map(i => [i.key, 'Buyer']));
    };
    const r = await new DatabaseService().processFile(csv('orders.csv', orders), OPS, undefined, { namer });
    const rels = r.relations as any[];
    const named = rels.filter(x => x.nameSource === 'model');
    expect(named.length).toBeGreaterThan(0);
    expect(named[0].name).toBe('Buyer');
    expect(JSON.stringify(asked)).not.toContain('city1');
    expect(r.outputFiles.map(f => f.content).join('\n')).toContain('Buyer');

    const sig = asked[0].key;
    const r2 = await new DatabaseService().processFile(csv('orders.csv', orders), OPS, undefined, { namer, userNames: { [sig]: 'Client' } });
    expect((r2.relations as any[]).some(x => x.name === 'Client' && x.nameSource === 'user')).toBe(true);
  });

  it('keeps going with unnamed relations when the model fails', async () => {
    const namer = async () => {
      throw new Error('model missing');
    };
    const r = await new DatabaseService().processFile(csv('orders.csv', orders), OPS, undefined, { namer });
    expect(r.success).toBe(true);
    expect((r.relations as any[]).some(x => x.nameSource === 'placeholder')).toBe(true);
  });
});
