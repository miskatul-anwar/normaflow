import { describe, it, expect } from 'vitest';
import { DatabaseService } from '../services/api/databaseService';
import { splitMultiValuedColumns } from '../services/processors/atomicSplit';

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' });
const OPS = ['CSV Data Loader', 'Atomicity Checker', '1NF', 'FD Miner', 'Key Discovery', '2NF', '3NF',
  'Lossless Check', 'ERD Generator', 'SQL Generator', 'Report Generator'];

describe('1NF moves multi-valued columns into child tables', () => {
  it('splits a list column and links it to the parent key', () => {
    const rows = [
      { id: 1, name: 'a', tags: 'red; green' },
      { id: 2, name: 'b', tags: 'blue' },
      { id: 3, name: 'c', tags: '' },
    ];
    const s = splitMultiValuedColumns(rows, ['tags'], 'items')!;
    expect(s.parentAttributes).toEqual(['id', 'name']);
    expect(s.key).toEqual(['id']);
    expect(s.children[0].name).toMatch(/^relation_\d+$/);
    expect(s.children[0].rows).toEqual([
      { id: 1, tags: 'red' },
      { id: 1, tags: 'green' },
      { id: 2, tags: 'blue' },
    ]);
  });

  it('removes the column from the schema and adds the child table end to end', async () => {
    const lines = ['item_id,name,tags'];
    for (let i = 1; i <= 20; i++) lines.push(`${i},Item ${i},"t${i % 4}; t${(i + 1) % 4}; t${(i + 2) % 4}"`);
    const result = await new DatabaseService().processFile(csv('items.csv', lines.join('\n')), OPS);
    expect(result.success).toBe(true);
    const rels = result.relations as Array<{ name: string; attributes: string[]; foreignKeys: any[] }>;
    const child = rels.find(r => r.attributes.includes('tags'))!;
    expect(child).toBeTruthy();
    expect(child.name).not.toContain('items_tags'); // not built from column names
    expect(rels.filter(r => r !== child && r.attributes.includes('tags'))).toEqual([]);
    expect(child.foreignKeys.length).toBe(1);
    expect(result.outputFiles.map(f => f.name).join(' ')).toBeTruthy();
  });
});
