/// <reference lib="webworker" />
/**
 * Runs the normalization engine off the UI thread. The page sends the files
 * and selected operations; progress and the final result come back as
 * messages. Cancelling is done by terminating this worker from the page.
 */
import DatabaseService from '../services/api/databaseService';
import type { NamerFn } from '../services/naming/applyNames';

export type EngineRequest = {
  files: File[];
  operations: string[];
  options: Record<string, unknown>;
  /** The page can write relation names (it hosts the naming model); the worker asks it through `name-request`. */
  canName?: boolean;
};

/** Page -> worker, answering a `name-request`. */
export type NameReply =
  | { type: 'names-progress'; id: number; done: number; total: number }
  | { type: 'names'; id: number; names: Record<string, string> }
  | { type: 'names-error'; id: number; message: string };

export type EngineMessage =
  | { type: 'progress'; progress: unknown }
  | { type: 'done'; result: unknown }
  | { type: 'name-request'; id: number; items: Array<{ key: string; columns: string[] }> }
  | { type: 'error'; message: string }
  /** The result could not be copied to the page; the page re-runs on the main thread. */
  | { type: 'clone-error' };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let nextNameId = 1;
const waiting = new Map<number, { resolve: (n: Record<string, string>) => void; reject: (e: Error) => void; onProgress?: (d: number, t: number) => void }>();

/** Asks the page to name relations; resolves with raw model text by key. */
const askPageToName: NamerFn = (items, onProgress) =>
  new Promise((resolve, reject) => {
    const id = nextNameId++;
    waiting.set(id, { resolve, reject, onProgress });
    ctx.postMessage({ type: 'name-request', id, items } satisfies EngineMessage);
  });

ctx.onmessage = async (event: MessageEvent<EngineRequest | NameReply>) => {
  const data = event.data;
  if ('type' in data) {
    const w = waiting.get(data.id);
    if (!w) return;
    if (data.type === 'names-progress') w.onProgress?.(data.done, data.total);
    else {
      waiting.delete(data.id);
      if (data.type === 'names') w.resolve(data.names);
      else w.reject(new Error(data.message));
    }
    return;
  }
  const { files, operations, options, canName } = data;
  try {
    const result = await DatabaseService.processFiles(
      files,
      operations,
      progress => ctx.postMessage({ type: 'progress', progress } satisfies EngineMessage),
      canName ? { ...options, namer: askPageToName } : options,
    );
    try {
      ctx.postMessage({ type: 'done', result } satisfies EngineMessage);
    } catch {
      ctx.postMessage({ type: 'clone-error' } satisfies EngineMessage);
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', message: (err as Error)?.message ?? String(err) } satisfies EngineMessage);
  }
};
