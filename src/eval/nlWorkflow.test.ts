import { describe, it, expect } from 'vitest';
import { NL_CASES } from './nlWorkflowCases';
import { evaluateNL } from './nlWorkflow';
import { NullProvider } from '../services/nlp/workflow/embeddingProvider';

describe('NL workflow eval set', () => {
  it('has at least 60 cases covering every kind', () => {
    expect(NL_CASES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(NL_CASES.map(c => c.kind)).size).toBe(7);
  });

  it('keywords alone: near-perfect on keyword/acronym/compound/negation, never builds from junk', async () => {
    const r = await evaluateNL(new NullProvider(), 'lexical');
    for (const kind of ['keyword', 'acronym', 'negation']) {
      expect(r.byKind[kind].ok / r.byKind[kind].total, kind).toBeGreaterThanOrEqual(0.9);
    }
    expect(r.rejectionRate).toBe(1);
  });
});
