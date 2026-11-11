import { describe, it, expect } from 'vitest';
import { buildChenDot, isJunction, isWeak, type ChenRelation } from './chenErd';
import { renderDot } from './renderDot';

const customer: ChenRelation = { name: 'Customer', attributes: ['id', 'name'], primaryKey: ['id'], foreignKeys: [] };
const order: ChenRelation = {
  name: 'Order', attributes: ['id', 'customer_id', 'date'], primaryKey: ['id'],
  foreignKeys: [{ attributes: ['customer_id'], references: 'Customer', referencedKey: ['id'] }],
};
const product: ChenRelation = { name: 'Product', attributes: ['sku', 'title'], primaryKey: ['sku'], foreignKeys: [] };
const line: ChenRelation = {
  name: 'OrderLine', attributes: ['order_id', 'sku', 'qty'], primaryKey: ['order_id', 'sku'],
  foreignKeys: [
    { attributes: ['order_id'], references: 'Order', referencedKey: ['id'] },
    { attributes: ['sku'], references: 'Product', referencedKey: ['sku'] },
  ],
};
const item: ChenRelation = {
  name: 'Item', attributes: ['order_id', 'n', 'note'], primaryKey: ['order_id', 'n'],
  foreignKeys: [{ attributes: ['order_id'], references: 'Order', referencedKey: ['id'] }],
};

describe('Chen ERD', () => {
  it('classifies junction and weak relations', () => {
    expect(isJunction(line)).toBe(true);
    expect(isJunction(order)).toBe(false);
    expect(isWeak(item)).toBe(true);
    expect(isWeak(order)).toBe(false);
  });

  it('draws entities, relationship diamonds with 1/N, and a junction as one N:M diamond', () => {
    const dot = buildChenDot([customer, order, product, line]);
    expect(dot).toContain('shape=box');
    expect(dot).toContain('shape=diamond');
    expect(dot).toContain('label="1"');
    expect(dot).toContain('label="N"');
    expect(dot).not.toContain('label="OrderLine", shape=box'); // junction is not an entity
    expect(dot).toContain('label="OrderLine", shape=diamond');
    expect(dot).not.toMatch(/label="customer_id", shape=ellipse/); // FK columns are relationships, not attributes
    expect(dot).toContain('<U>id</U>'); // key attributes underlined
    expect(dot).toContain('label="qty"'); // junction attribute hangs off the diamond
  });

  it('weak entities get a double border and an identifying relationship', () => {
    const dot = buildChenDot([customer, order, item]);
    expect(dot.match(/peripheries=2/g)?.length).toBe(2);
  });

  it('can omit attributes', () => {
    expect(buildChenDot([customer, order], { attributes: false })).not.toContain('shape=ellipse');
  });

  it('escapes hostile names', () => {
    const dot = buildChenDot([{ name: 'a"b\\c\n<d>', attributes: ['x"y', '<script>'], primaryKey: ['<script>'], foreignKeys: [] }]);
    expect(dot).not.toMatch(/[^\\]"b/);
    expect(dot).toContain('&lt;script&gt;');
    expect(dot).not.toContain('\n<d>');
  });

  it('renders to SVG with the bundled WebAssembly Graphviz', async () => {
    const svg = await renderDot(buildChenDot([customer, order, product, line]));
    expect(svg).toContain('<svg');
    expect(svg).toContain('Customer');
    expect(svg).toContain('OrderLine');
  }, 30_000);
});
