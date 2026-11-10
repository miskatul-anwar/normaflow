import { describe, it, expect } from 'vitest';
import { resolve } from './resolver';
import { NullProvider, FakeEmbeddingProvider, EmbeddingUnavailableError, type EmbeddingProvider } from './embeddingProvider';
import { OllamaProvider, isLoopbackUrl } from './ollamaProvider';
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
    expect(ok.plan).not.toContain('NER Classifier');
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
    const failing = new OllamaProvider({ transport: async () => { throw new Error('connection refused'); } });
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

describe('ollama provider', () => {
  it('only accepts loopback URLs', () => {
    for (const ok of ['http://127.0.0.1:11434', 'http://localhost:11434', 'http://[::1]:11434']) expect(isLoopbackUrl(ok), ok).toBe(true);
    for (const bad of ['http://example.com', 'https://localhost', 'http://10.0.0.5:11434', 'http://localhost.evil.com', 'http://u:p@localhost']) expect(isLoopbackUrl(bad), bad).toBe(false);
    expect(() => new OllamaProvider({ transport: async () => [], baseUrl: 'http://example.com' })).toThrow();
  });

  it('falls back to the second model, normalises vectors, and prefixes inputs', async () => {
    const calls: Array<[string, string[]]> = [];
    const p = new OllamaProvider({
      models: ['new-model', 'old-model'],
      transport: async (_u, model, inputs) => {
        calls.push([model, inputs]);
        if (model === 'new-model') throw new Error('model not found');
        return inputs.map(() => [3, 4]);
      },
    });
    const [v] = await p.embed(['hello'], 'query');
    expect(v).toEqual([0.6, 0.8]);
    expect(calls.map(c => c[0])).toEqual(['new-model', 'old-model']);
    expect(calls[1][1][0]).toBe('task: classification | query: hello');
    await p.embed(['again'], 'query');
    expect(calls[calls.length - 1][0]).toBe('old-model');
  });

  it('turns transport failures into EmbeddingUnavailableError', async () => {
    const p = new OllamaProvider({ transport: async () => { throw new Error('boom'); } });
    await expect(p.embed(['x'], 'query')).rejects.toBeInstanceOf(EmbeddingUnavailableError);
    expect((await p.status()).ready).toBe(false);
  });
});
