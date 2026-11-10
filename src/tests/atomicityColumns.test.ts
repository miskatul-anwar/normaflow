import { describe, expect, it } from 'vitest';
import { DataProcessor } from '../services/processors/dataProcessor';

const flagged = async (rows: Record<string, string>[]) => {
  const r = await DataProcessor.checkAtomicity(rows);
  return Object.keys(r.atomicity).filter(k => r.atomicity[k] === false);
};

describe('column-level atomicity', () => {
  it('does not flag ordinary text that contains "and", "&", "+" or parentheses', async () => {
    const rows = [
      { dept: 'Research and Development', company: 'AT&T', phone: '+1 (555) 010-9999', id: '1' },
      { dept: 'Sales and Marketing', company: 'Johnson & Johnson', phone: '+44 (20) 7946 0000', id: '2' },
    ];
    expect(await flagged(rows)).toEqual([]);
  });

  it('does not flag names, addresses or descriptions that contain commas', async () => {
    const rows = [
      { full_name: 'Smith, John', address: '12 Main Street, Springfield', notes: 'fast, cheap, good', id: '1' },
      { full_name: 'Doe, Jane', address: '9 Elm Road, Shelbyville', notes: 'slow, careful', id: '2' },
    ];
    expect(await flagged(rows)).toEqual([]);
  });

  it('flags a column whose cells are lists of short items', async () => {
    const rows = [
      { id: '1', tags: 'react, vite' },
      { id: '2', tags: 'rust; tauri; wasm' },
      { id: '3', tags: 'node' },
    ];
    expect(await flagged(rows)).toEqual(['tags']);
  });

  it('flags JSON arrays', async () => {
    const rows = [{ id: '1', ids: '[1, 2, 3]' }, { id: '2', ids: '[4]' }];
    expect(await flagged(rows)).toEqual(['ids']);
  });

  it('ignores a stray comma in a mostly scalar column', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: String(i), color: i === 0 ? 'red, dark' : 'blue' }));
    expect(await flagged(rows)).toEqual([]);
  });
});
