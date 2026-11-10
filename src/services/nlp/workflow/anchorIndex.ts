/**
 * Embeds every anchor phrase once and keeps the vectors: in memory, and in
 * IndexedDB (best effort) keyed by provider + hash of the anchors, so a model
 * or anchor change invalidates the cache.
 */
import { ANCHORS } from './anchors';
import { dot, type EmbeddingProvider } from './embeddingProvider';

export interface AnchorIndex {
  /** Parallel arrays: phrase i belongs to operation `owners[i]`. */
  owners: string[];
  vectors: number[][];
}

const memory = new Map<string, AnchorIndex>();

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

export function anchorsHash(): string {
  return hash(JSON.stringify(Object.entries(ANCHORS).map(([k, v]) => [k, v.phrases])));
}

const DB = 'normaflow-nl';
const STORE = 'anchors';

function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(undefined);
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        try {
          const req = fn(open.result.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      };
    } catch {
      resolve(undefined);
    }
  });
}

export async function getAnchorIndex(provider: EmbeddingProvider): Promise<AnchorIndex> {
  // Embed first so `cacheKey` reflects the model that actually answered.
  const owners: string[] = [];
  const phrases: string[] = [];
  for (const [op, a] of Object.entries(ANCHORS)) {
    for (const p of a.phrases) {
      owners.push(op);
      phrases.push(p);
    }
  }

  const peek = `${provider.cacheKey}|${anchorsHash()}`;
  const hit = memory.get(peek);
  if (hit) return hit;
  const stored = await withStore<AnchorIndex>('readonly', s => s.get(peek));
  if (stored && stored.vectors?.length === phrases.length) {
    memory.set(peek, stored);
    return stored;
  }

  const vectors = await provider.embed(phrases, 'anchor');
  const index: AnchorIndex = { owners, vectors };
  memory.set(`${provider.cacheKey}|${anchorsHash()}`, index);
  void withStore('readwrite', s => s.put(index, `${provider.cacheKey}|${anchorsHash()}`));
  return index;
}

export function clearAnchorMemoryCache(): void {
  memory.clear();
}

/** Score per operation = best cosine over that operation's anchors, sorted descending. */
export function scoreOperations(query: number[], index: AnchorIndex): Array<{ operation: string; score: number }> {
  const best = new Map<string, number>();
  index.vectors.forEach((v, i) => {
    const s = dot(query, v);
    const op = index.owners[i];
    if (s > (best.get(op) ?? -Infinity)) best.set(op, s);
  });
  return [...best.entries()].map(([operation, score]) => ({ operation, score })).sort((a, b) => b.score - a.score);
}
