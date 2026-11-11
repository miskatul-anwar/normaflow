import { describe, it, expect } from 'vitest';
import { buildBarkerDot, buildUmlDot, optionalColumns, type BoxRelation } from './boxNotations';
import { renderDot } from './renderDot';

const customer: BoxRelation = {
  name: 'Customer', attributes: ['id', 'name', 'fax'], primaryKey: ['id'], foreignKeys: [],
  rows: [{ id: 1, name: 'A', fax: '' }, { id: 2, name: 'B', fax: '123' }],
  metadata: { attributeTypes: { id: 'integer', name: 'string', fax: 'string' } },
};
const order: BoxRelation = {
  name: 'Order', attributes: ['id', 'customer_id', 'date'], primaryKey: ['id'],
  foreignKeys: [{ attributes: ['customer_id'], references: 'Customer', referencedKey: ['id'] }],
  rows: [{ id: 1, customer_id: 1, date: 'x' }, { id: 2, customer_id: '', date: 'y' }],
};
const line: BoxRelation = {
  name: 'Line', attributes: ['order_id', 'n'], primaryKey: ['order_id', 'n'],
  foreignKeys: [{ attributes: ['order_id'], references: 'Order', referencedKey: ['id'] }],
};
const rels = [customer, order, line];

describe('optionality', () => {
  it('finds columns with empty values', () => {
    expect([...optionalColumns(customer)]).toEqual(['fax']);
    expect([...optionalColumns(order)]).toEqual(['customer_id']);
  });
});

describe('Barker notation', () => {
  const dot = buildBarkerDot(rels);
  it('marks identifiers, mandatory and optional attributes and hides foreign-key columns', () => {
    expect(dot).toContain('#&nbsp;* id');
    expect(dot).toContain('o&nbsp;&nbsp; fax');
    expect(dot).toContain('*&nbsp;&nbsp; name');
    expect(dot).not.toContain('customer_id</TD>');
  });
  it('draws crow\'s feet, dashes optional relationships and bars identifying ones', () => {
    expect(dot).toContain('arrowhead=crow, style=dashed'); // Order -> Customer is optional (empty customer_id)
    expect(dot).toContain('arrowhead=crowtee'); // Line's key includes the foreign key
  });
  it('escapes hostile names', () => {
    const d = buildBarkerDot([{ name: '<b>x"', attributes: ['<script>'], primaryKey: ['<script>'], foreignKeys: [] }]);
    expect(d).toContain('&lt;B&gt;');
    expect(d).not.toContain('<script>');
  });
});

describe('UML notation', () => {
  const dot = buildUmlDot(rels);
  it('lists typed attributes with stereotypes and multiplicities', () => {
    expect(dot).toContain('+ <U>id</U> : integer &#171;PK&#187;');
    expect(dot).toContain('&#171;FK&#187;');
    expect(dot).toContain('taillabel="0..1"'); // optional foreign key
    expect(dot).toContain('headlabel="0..*"');
    expect(dot).toContain('headlabel="1..*"'); // identifying: at least one
  });
  it('can hide attributes', () => {
    expect(buildUmlDot(rels, { attributes: false })).not.toContain('PK');
  });
});

describe('all notations render with the bundled Graphviz', () => {
  it('produces SVG for Barker and UML', async () => {
    for (const dot of [buildBarkerDot(rels), buildUmlDot(rels)]) {
      const svg = await renderDot(dot, 'dot');
      expect(svg).toContain('<svg');
      expect(svg).toContain('Customer'.toUpperCase().slice(0, 1));
    }
  }, 30_000);
});

import { withoutAttributes } from './renderMermaid';
describe('Mermaid without attributes', () => {
  it('collapses entity blocks and leaves relationships alone', () => {
    const src = 'erDiagram\n  customer {\n    int id PK\n    string name\n  }\n  order {\n    int id PK\n  }\n  customer ||--o{ order : "places"\n';
    const out = withoutAttributes(src);
    expect(out).not.toContain('int id');
    expect(out).toContain('customer {');
    expect(out).toContain('customer ||--o{ order : "places"');
  });
});
