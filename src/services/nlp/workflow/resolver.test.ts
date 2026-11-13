import { describe, it, expect } from 'vitest';
import { resolve } from './resolver';
import { NullProvider, FakeEmbeddingProvider, EmbeddingUnavailableError, type EmbeddingProvider } from './embeddingProvider';
import { LocalModelProvider } from './localModelProvider';
import { clearAnchorMemoryCache } from './anchorIndex';

describe('hybrid resolver', () => {
  it('the headline example builds exactly the five-step pipeline', async () => {
    const r = await resolve('Can you pls convert it to 1NF', new NullProvider());
    expect(r.plan).toEqual(['CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler', '1NF']);
    expect(r.addedAsDependencies).toEqual(['CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler']);
    expect(r.confidence).toBe('high');
  });

  it('does not call the provider when keywords are enough', async () => {
    const spy: EmbeddingProvider = { ...new NullProvider(), embed: async () => { throw new Error('should not be called'); } } as any;
    const r = await resolve('give me 3NF', spy);
    expect(r.targets).toEqual(['3NF']);
  });

  it('negation keeps the excluded op out and an excluded dependency is a conflict, not a silent add', async () => {
    const ok = await resolve("normalize to BCNF but don't classify entities", new NullProvider());
    expect(ok.plan).not.toContain('Column Classifier');
    const bad = await resolve('give me BCNF but skip 3NF', new NullProvider());
    expect(bad.plan).toEqual([]);
    expect(bad.message).toMatch(/needs 3NF/);
  });

  it('degrades to keywords when the provider is offline, with a note, never throwing', async () => {
    const r = await resolve('turn the whole thing into something neat', new NullProvider());
    expect(r.confidence).toBe('none');
    expect(r.message).toBeTruthy();
  });

  it('a failing provider does not break a keyword result', async () => {
    const failing = new LocalModelProvider(async () => { throw new Error('worker failed to start'); });
    const r = await resolve('please normalize my data', failing);
    expect(r.targets).toEqual(['3NF']);
    expect(r.plan.length).toBeGreaterThan(0);
  });

  it('uses embeddings for paraphrases (fake provider)', async () => {
    clearAnchorMemoryCache();
    const r = await resolve('visualise the tables and links', new FakeEmbeddingProvider(), {
      thresholds: { accept: 0.3, margin: 0.0, floor: 0.2 },
    });
    expect(r.targets).toContain('ERD Generator');
    expect(['embedding', 'mixed']).toContain(r.source);
  });

  it('parses dialect and run options', async () => {
    const r = await resolve('generate postgres sql and run it', new NullProvider());
    expect(r.options).toEqual({ run: true, dialect: 'postgresql' });
  });
});

describe('local model provider', () => {
  it('normalises vectors', async () => {
    const p = new LocalModelProvider(async texts => texts.map(() => [3, 4]));
    expect(await p.embed(['hello'], 'query')).toEqual([[0.6, 0.8]]);
    expect((await p.status()).ready).toBe(true);
  });

  it('turns extractor failures into EmbeddingUnavailableError and an offline status', async () => {
    const p = new LocalModelProvider(async () => { throw new Error('boom'); });
    await expect(p.embed(['x'], 'query')).rejects.toBeInstanceOf(EmbeddingUnavailableError);
    expect((await p.status()).ready).toBe(false);
  });

  it('rejects a mismatched number of vectors', async () => {
    const p = new LocalModelProvider(async () => [[1, 0]]);
    await expect(p.embed(['a', 'b'], 'query')).rejects.toBeInstanceOf(EmbeddingUnavailableError);
  });
});
