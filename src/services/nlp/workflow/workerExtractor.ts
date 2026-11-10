/** Page-side client for `embed.worker.ts`, plus the provider the app uses. */
import type { EmbedRequest, EmbedResponse } from '../../../workers/embed.worker';
import { NullProvider, type EmbeddingProvider } from './embeddingProvider';
import { LocalModelProvider, type Extractor } from './localModelProvider';

export function workerExtractor(): Extractor {
  let worker: Worker | null = null;
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>();

  const failAll = (message: string) => {
    for (const p of pending.values()) p.reject(new Error(message));
    pending.clear();
    worker?.terminate();
    worker = null;
  };

  const start = (): Worker => {
    const w = new Worker(new URL('../../../workers/embed.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<EmbedResponse>) => {
      const entry = pending.get(e.data.id);
      if (!entry) return;
      pending.delete(e.data.id);
      if ('error' in e.data) entry.reject(new Error(e.data.error));
      else entry.resolve(e.data.vectors);
    };
    w.onerror = ev => failAll(ev.message || 'embedding worker failed');
    return w;
  };

  return texts =>
    new Promise((resolve, reject) => {
      try {
        worker ??= start();
        const id = nextId++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, texts } satisfies EmbedRequest);
      } catch (e) {
        reject(e as Error);
      }
    });
}

/** The app's provider: the bundled model in a worker, or keywords only where workers do not exist. */
export function createAppProvider(): EmbeddingProvider {
  if (typeof Worker === 'undefined') return new NullProvider();
  return new LocalModelProvider(workerExtractor());
}
