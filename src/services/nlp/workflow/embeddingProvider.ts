/**
 * Embedding providers for natural-language matching.
 *
 * Only the user's command text and the static anchor phrases are ever passed to
 * a provider. Never pass CSV contents, headers or file names.
 */

export type EmbedKind = 'query' | 'anchor';
export type Framing = 'classification' | 'retrieval';

export class EmbeddingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingUnavailableError';
  }
}

export interface ProviderStatus {
  ready: boolean;
  model?: string;
  dimension?: number;
  detail?: string;
}

export interface EmbeddingProvider {
  readonly name: string;
  /** Identifies model + prompt framing; part of the anchor cache key. */
  readonly cacheKey: string;
  /** L2-normalised vectors, one per text. Throws `EmbeddingUnavailableError`. */
  embed(texts: string[], kind: EmbedKind): Promise<number[][]>;
  status(): Promise<ProviderStatus>;
}

/** Task prefixes for models that expect them (not used by the bundled MiniLM, kept for swappable providers). */
export function formatInput(text: string, kind: EmbedKind, framing: Framing): string {
  if (framing === 'classification') return `task: classification | query: ${text}`;
  return kind === 'query' ? `task: search result | query: ${text}` : `title: none | text: ${text}`;
}

export function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map(x => x / norm);
}

/** Cosine similarity of two L2-normalised vectors. */
export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** No model available: the resolver uses keywords only. */
export class NullProvider implements EmbeddingProvider {
  readonly name = 'none';
  readonly cacheKey = 'none';
  async embed(): Promise<number[][]> {
    throw new EmbeddingUnavailableError('Embeddings are disabled');
  }
  async status(): Promise<ProviderStatus> {
    return { ready: false, detail: 'Embeddings are disabled' };
  }
}

/** Deterministic hashed bag-of-words vectors for offline tests and evals. */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'fake';
  readonly cacheKey = 'fake-bow';
  constructor(private readonly dim = 256) {}

  private vector(text: string): number[] {
    const v = new Array<number>(this.dim).fill(0);
    const words = text.toLowerCase().replace(/^task:[^|]*\| query: /, '').split(/[^a-z0-9]+/).filter(Boolean);
    for (const w of words) {
      for (const token of [w, ...(w.length > 4 ? [w.slice(0, 4)] : [])]) {
        let h = 2166136261;
        for (let i = 0; i < token.length; i++) h = Math.imul(h ^ token.charCodeAt(i), 16777619);
        v[(h >>> 0) % this.dim] += 1;
      }
    }
    return l2normalize(v);
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(t => this.vector(t));
  }
  async status(): Promise<ProviderStatus> {
    return { ready: true, model: 'fake-bow', dimension: this.dim };
  }
}
