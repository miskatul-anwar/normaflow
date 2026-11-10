import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { nodeLocalProvider } from '../../../eval/nodeExtractor';
import { resolve } from './resolver';

/** Exercises the real model that ships in the installer (runs offline from public/models). */
describe('bundled embedding model', () => {
  it('is the pinned file', () => {
    const f = 'public/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx';
    expect(existsSync(f)).toBe(true);
    expect(createHash('sha256').update(readFileSync(f)).digest('hex')).toBe('afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1');
  });

  it('is ready and 384-dimensional', async () => {
    const s = await nodeLocalProvider().status();
    expect(s.ready).toBe(true);
    expect(s.dimension).toBe(384);
  }, 60_000);

  it('resolves paraphrases the keywords miss, and rejects junk', async () => {
    const provider = nodeLocalProvider();
    const a = await resolve('show me the schema as a picture', provider);
    expect(a.targets).toContain('ERD Generator');
    const b = await resolve('which columns determine which other columns', provider);
    expect(b.targets).toEqual(['FD Miner']);
    expect(b.source).toBe('embedding');
    const junk = await resolve('what is the weather like today', provider);
    expect(junk.plan).toEqual([]);
  }, 60_000);
});
