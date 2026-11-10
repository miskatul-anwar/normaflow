import { describe, it, expect } from 'vitest';
import { detectForeignKeys } from '../services/processors/foreignKeyDetector';
import { buildSchema, emitMermaidErd } from '../services/processors/schemaGraph';

const orderLines = {
  tableName: 'order_lines',
  headers: ['order_id', 'line_no', 'sku'],
  primaryKey: ['order_id', 'line_no'],
  rows: [1, 2, 3].flatMap(o => [1, 2, 3].map(l => ({ order_id: String(o), line_no: String(l), sku: `s${o}${l}` }))),
};
const shipments = {
  tableName: 'shipments',
  headers: ['shipment_id', 'order_id', 'line_no'],
  primaryKey: ['shipment_id'],
  rows: [
    { shipment_id: 'a', order_id: '1', line_no: '2' },
    { shipment_id: 'b', order_id: '2', line_no: '3' },
    { shipment_id: 'c', order_id: '3', line_no: '1' },
    { shipment_id: 'd', order_id: '1', line_no: '1' },
  ],
};

describe('composite foreign keys', () => {
  it('detects a two-column foreign key to a composite primary key', () => {
    const fks = detectForeignKeys([orderLines, shipments]);
    const c = fks.find(f => f.sourceTable === 'shipments');
    expect(c?.sourceColumns).toEqual(['order_id', 'line_no']);
    expect(c?.targetColumns).toEqual(['order_id', 'line_no']);
    expect(c?.targetTable).toBe('order_lines');
  });

  it('does not link when a tuple is missing from the key', () => {
    const bad = { ...shipments, rows: [...shipments.rows, { shipment_id: 'e', order_id: '9', line_no: '9' }] };
    const fks = detectForeignKeys([orderLines, bad], { minContainment: 1 });
    expect(fks.find(f => f.sourceColumns)).toBeUndefined();
  });
});

describe('junction tables', () => {
  const students = { tableName: 'students', headers: ['student_id', 'name'], primaryKey: ['student_id'], rows: Array.from({ length: 5 }, (_, i) => ({ student_id: String(i + 10), name: `n${i}` })) };
  const courses = { tableName: 'courses', headers: ['course_id', 'title'], primaryKey: ['course_id'], rows: Array.from({ length: 4 }, (_, i) => ({ course_id: `C${i}`, title: `t${i}` })) };
  const enrol = {
    tableName: 'enrolments',
    headers: ['student_id', 'course_id'],
    primaryKey: ['student_id', 'course_id'],
    rows: [['10', 'C0'], ['10', 'C1'], ['11', 'C0'], ['12', 'C2'], ['13', 'C3'], ['14', 'C1']].map(([s, c]) => ({ student_id: s, course_id: c })),
  };

  it('is recognised and noted in the ER diagram', () => {
    const tables = [students, courses, enrol];
    const cross = detectForeignKeys(tables);
    const schema = buildSchema(
      tables.map(t => ({ ...t, relations: [] })),
      cross,
    );
    expect(schema.junctions).toEqual([{ relation: 'enrolments', between: expect.arrayContaining(['students', 'courses']) }]);
    expect(emitMermaidErd(schema)).toContain('junction table');
  });
});
