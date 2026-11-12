/** Page-side client for `naming.worker.ts`. Answers are raw model text by key; `cleanModelName` decides whether they are used. */
import type { NamingRequest, NamingResponse } from '../../workers/naming.worker';

export type RawNames = Record<string, string>;
export type Namer = (
  items: Array<{ key: string; columns: string[] }>,
  onProgress?: (done: number, total: number) => void,
) => Promise<RawNames>;

let worker: Worker | null = null;
let nextId = 1;

/** The app's namer, or null where workers do not exist. The worker (and the model) is created on first use and kept. */
export function createWorkerNamer(): Namer | null {
  if (typeof Worker === 'undefined') return null;
  return (items, onProgress) =>
    new Promise<RawNames>((resolve, reject) => {
      const id = nextId++;
      const names: RawNames = {};
      try {
        worker ??= new Worker(new URL('../../workers/naming.worker.ts', import.meta.url), { type: 'module' });
      } catch (e) {
        reject(e as Error);
        return;
      }
      const w = worker;
      const fail = (message: string) => {
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
        w.terminate();
        if (worker === w) worker = null;
        reject(new Error(message));
      };
      const onMessage = (e: MessageEvent<NamingResponse>) => {
        const m = e.data;
        if (m.id !== id) return;
        if ('error' in m) return fail(m.error);
        if ('done' in m) {
          w.removeEventListener('message', onMessage);
          w.removeEventListener('error', onError);
          return resolve(names);
        }
        names[m.key] = m.text;
        onProgress?.(Object.keys(names).length, items.length);
      };
      const onError = (ev: ErrorEvent) => fail(ev.message || 'naming worker failed');
      w.addEventListener('message', onMessage);
      w.addEventListener('error', onError);
      w.postMessage({ id, items } satisfies NamingRequest);
    });
}
