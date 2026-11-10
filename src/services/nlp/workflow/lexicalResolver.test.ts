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
    expect(r.excluded).toEqual(['NER Classifier']);
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
});
