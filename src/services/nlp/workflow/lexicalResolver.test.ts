import { describe, it, expect } from 'vitest';
import { OPERATIONS } from '../../../config/operations';
import { ANCHORS } from './anchors';
import { resolveLexical, splitClauses } from './lexicalResolver';

describe('anchors', () => {
  it('every operation has aliases and at least 5 phrases, and nothing extra', () => {
    expect(Object.keys(ANCHORS).sort()).toEqual(Object.keys(OPERATIONS).sort());
    for (const [op, a] of Object.entries(ANCHORS)) {
      expect(a.aliases.length, op).toBeGreaterThan(0);
      expect(a.phrases.length, op).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('lexical resolver', () => {
  const t = (s: string) => resolveLexical(s).targets;

  it('the spec examples', () => {
    expect(t('Can you pls convert it to 1NF')).toEqual(['1NF']);
    expect(t('give me 3NF')).toEqual(['3NF']);
    expect(t('generate the SQL')).toEqual(['SQL Generator']);
    expect(t('load and clean the file')).toEqual(['CSV Data Loader', 'Data Cleaner']);
    expect(t('full report')).toEqual(['Report Generator']);
  });

  it('negation excludes', () => {
    const r = resolveLexical("normalize to BCNF but don't classify entities");
    expect(r.targets).toEqual(['BCNF']);
    expect(r.excluded).toEqual(['Column Classifier']);
  });

  it('acronyms and forms', () => {
    expect(t('bring it to boyce-codd')).toEqual(['BCNF']);
    expect(t('make the ERD')).toEqual(['ERD Generator']);
    expect(t('find fds')).toEqual(['FD Miner']);
    expect(t('first normal form please')).toEqual(['1NF']);
    expect(t('2 nf')).toEqual(['2NF']);
  });

  it('compound requests keep every target', () => {
    expect(t('normalize to 3NF and generate SQL')).toEqual(['3NF', 'SQL Generator']);
    expect(t('check lossless join, then dependency preservation')).toEqual(['Lossless Check', 'Dependency Preservation']);
  });

  it('options', () => {
    expect(resolveLexical('generate postgres sql and run it').options).toEqual({ run: true, dialect: 'postgresql' });
  });

  it('generic "normalize" is medium confidence 3NF; junk is none', () => {
    const r = resolveLexical('please normalize my data');
    expect(r.targets).toEqual(['3NF']);
    expect(r.confidence).toBe('medium');
    expect(resolveLexical('what is the weather like today').confidence).toBe('none');
  });

  it('keeps unmatched content clauses for embeddings', () => {
    const r = resolveLexical('make every cell hold a single value');
    expect(r.pending.length + r.targets.length).toBeGreaterThan(0);
  });

  it('splits clauses', () => {
    expect(splitClauses('a, b and c; d then e')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  describe('"run everything"', () => {
    const all = Object.keys(OPERATIONS);
    it.each([
      'Run all steps', 'run all the steps', 'run every step', 'execute all operations', 'use all the options',
      'run everything', 'do it all', 'everything', 'run the whole pipeline', 'full pipeline', 'complete analysis',
      'end to end', 'run each step', 'include every operation and run it',
    ])('%j selects every operation in the sidebar', q => {
      expect([...t(q)].sort()).toEqual([...all].sort());
    });

    it('honours "skip" and drops what needs the skipped step', () => {
      expect(t('run everything except the report')).not.toContain('Report Generator');
      expect(t('run everything except the report')).toHaveLength(all.length - 1);
      const noBcnf = t('run all steps but skip BCNF');
      expect(noBcnf).not.toContain('BCNF');
      expect(noBcnf).toContain('3NF');
      const no3nf = t('run all steps without 3NF');
      // BCNF, Relation Generator (and so SQL Generator) need 3NF; Lossless Check needs only 2NF.
      for (const gone of ['3NF', 'BCNF', 'Relation Generator', 'SQL Generator']) expect(no3nf).not.toContain(gone);
      expect(no3nf).toContain('Lossless Check');
      expect(no3nf).toHaveLength(all.length - 4);
    });

    it('keeps the run flag and the SQL dialect', () => {
      const r = resolveLexical('run everything in postgres');
      expect(r.options).toEqual({ run: true, dialect: 'postgresql' });
      expect(r.confidence).toBe('high');
    });

    it.each([
      ['normalize all tables to 3NF', ['3NF']],
      ['show all functional dependencies', ['FD Miner']],
      ['convert all columns to 1NF', ['1NF']],
      ['give me the full report', ['Report Generator']],
      ['explain each step', []],
    ])('does not read %j as "everything"', (q, expected) => {
      expect(t(q).length).toBeLessThan(all.length);
      if (expected.length) expect(t(q)).toEqual(expected);
    });
  });
});
