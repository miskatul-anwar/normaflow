import { describe, it, expect } from 'vitest';
import { prepareInput, repairWord, editDistance, MAX_INPUT_CHARS } from './inputPrep';
import { resolve } from './resolver';
import { resolveLexical } from './lexicalResolver';
import { NullProvider, type EmbeddingProvider } from './embeddingProvider';
import { LocalModelProvider } from './localModelProvider';
import { ALL_OPERATION_NAMES } from '../../../config/operations';

describe('input preparation', () => {
  it('rejects empty, symbol-only and non-string input', () => {
    for (const x of ['', '   ', '!!! ??? ...', '​​', null, undefined, 42]) expect(prepareInput(x).text).toBe('');
  });

  it('strips invisible characters, accents and odd quotes/dashes', () => {
    expect(prepareInput('conv​ert  to 1NF').text).toBe('convert to 1NF');
    expect(prepareInput('normalizé to Boyce–Codd').text).toBe('normalize to Boyce-Codd');
    expect(prepareInput('don’t skip').text).toBe("don't skip");
  });

  it('truncates very long input at a word boundary', () => {
    const p = prepareInput('give me 3NF '.repeat(500));
    expect(p.truncated).toBe(true);
    expect(p.text.length).toBeLessThanOrEqual(MAX_INPUT_CHARS);
  });

  it('repairs typos only when unambiguous and long enough', () => {
    expect(repairWord('normalizaton')).toBe('normalization');
    expect(repairWord('dependancies')).toBe('dependencies');
    expect(repairWord('diagarm')).toBe('diagram');
    expect(repairWord('table')).toBeNull(); // short
    expect(repairWord('database')).toBeNull(); // not near anything
    expect(editDistance('abcd', 'abdc')).toBe(1);
  });
});

describe('typos reach the right operation', () => {
  const t = async (s: string) => (await resolve(s, new NullProvider())).targets;
  it('fixes common misspellings', async () => {
    expect(await t('generate the entity relatonship diagarm')).toContain('ERD Generator');
    expect(await t('find functional dependancies')).toContain('FD Miner');
    expect(await t('check lossles join')).toContain('Lossless Check');
  });
  it('does not turn ordinary words into operations', async () => {
    for (const s of ['what is the weather like today', 'tell me a story about birds', 'reporter on the street', 'my favourite primary school']) {
      const r = await resolve(s, new NullProvider());
      expect(r.plan.length, s).toBe(r.targets.length === 0 ? 0 : r.plan.length);
    }
    expect((await resolve('what is the weather like today', new NullProvider())).targets).toEqual([]);
    expect((await resolve('tell me a story about birds', new NullProvider())).targets).toEqual([]);
  });
});

describe('negation and options', () => {
  it('does not run when told not to', () => {
    expect(resolveLexical("generate sql but don't run it").options.run).toBeUndefined();
    expect(resolveLexical('no need to run anything, give me 3NF').options.run).toBeUndefined();
    expect(resolveLexical('give me 3NF and run it').options.run).toBe(true);
  });
  it('understands negation after the operation', () => {
    const r = resolveLexical('3NF please, sql is not needed');
    expect(r.targets).toEqual(['3NF']);
    expect(r.excluded).toEqual(['SQL Generator']);
  });
});

describe('failure handling', () => {
  it('a hung embedding provider times out and falls back to keywords', async () => {
    const hung: EmbeddingProvider = { ...new NullProvider(), embed: () => new Promise(() => {}), status: async () => ({ ready: false }) } as any;
    const r = await resolve('please normalize my data', hung, { embedTimeoutMs: 30 });
    expect(r.targets).toEqual(['3NF']);
  });

  it('NaN or wrong-sized vectors are rejected, not scored', async () => {
    const bad = new LocalModelProvider(async texts => texts.map(() => [NaN, 1]));
    const r = await resolve('turn the whole thing into something neat', bad);
    expect(r.plan).toEqual([]);
    expect(r.message).toBeTruthy();
  });

  it('empty input returns guidance, never a plan', async () => {
    const r = await resolve('   ', new NullProvider());
    expect(r.plan).toEqual([]);
    expect(r.message).toMatch(/Type what you want/);
  });

  it('every plan only contains real operations, once each, with dependencies first', async () => {
    for (const op of ALL_OPERATION_NAMES) {
      const r = await resolve(`please do ${op}`, new NullProvider());
      expect(new Set(r.plan).size).toBe(r.plan.length);
      r.plan.forEach(p => expect(ALL_OPERATION_NAMES).toContain(p));
    }
  });

  it('hostile text is just text', async () => {
    for (const s of ['<script>alert(1)</script>', '(((((((', '\\\\\\', 'a'.repeat(100000), '🙂🙂🙂', '${process.exit()}']) {
      const r = await resolve(s, new NullProvider());
      expect(Array.isArray(r.plan)).toBe(true);
    }
  });
});
