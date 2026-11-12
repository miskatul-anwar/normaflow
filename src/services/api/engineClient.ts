/**
 * Page-side handle for the engine worker.
 *
 * `runEngine` starts the analysis in a Web Worker so the window stays
 * responsive, and `cancel()` terminates the worker, which stops even a
 * long synchronous step. If workers are unavailable (tests, old webviews) or
 * the result cannot be copied across, the same code runs on the main thread.
 */
import DatabaseService, { type ProcessingResult, type ProcessingState } from './databaseService';
import type { EngineMessage, NameReply } from '../../workers/engine.worker';
import type { NamerFn } from '../naming/applyNames';

export interface EngineRun {
  promise: Promise<ProcessingResult>;
  cancel: () => void;
}

export function runEngine(
  files: File[],
  operations: string[],
  onProgress: (state: ProcessingState) => void,
  allOptions: Record<string, unknown> = {},
): EngineRun {
  // The namer is a function (it talks to the naming worker), so it stays on this side of the worker boundary.
  const { namer, ...options } = allOptions as Record<string, unknown> & { namer?: NamerFn | null };
  const inThread = (): EngineRun => ({
    promise: DatabaseService.processFiles(files, operations, onProgress, { ...options, namer }),
    cancel: () => DatabaseService.cancelProcessing(),
  });

  if (typeof Worker === 'undefined') return inThread();

  let worker: Worker;
  try {
    worker = new Worker(new URL('../../workers/engine.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return inThread();
  }

  let fallback: EngineRun | null = null;
  let settle: { resolve: (r: ProcessingResult) => void; reject: (e: Error) => void } | null = null;
  const promise = new Promise<ProcessingResult>((resolve, reject) => {
    settle = { resolve, reject };
  });

  worker.onmessage = (event: MessageEvent<EngineMessage>) => {
    const msg = event.data;
    if (msg.type === 'progress') onProgress(msg.progress as ProcessingState);
    else if (msg.type === 'name-request') {
      const reply = (r: NameReply) => worker.postMessage(r);
      if (!namer) reply({ type: 'names-error', id: msg.id, message: 'no naming model' });
      else
        namer(msg.items, (done, total) => reply({ type: 'names-progress', id: msg.id, done, total })).then(
          names => reply({ type: 'names', id: msg.id, names }),
          e => reply({ type: 'names-error', id: msg.id, message: (e as Error)?.message ?? String(e) }),
        );
    }
    else if (msg.type === 'done') {
      worker.terminate();
      settle!.resolve(msg.result as ProcessingResult);
    } else if (msg.type === 'error') {
      worker.terminate();
      settle!.reject(new Error(msg.message));
    } else if (msg.type === 'clone-error') {
      worker.terminate();
      fallback = inThread();
      fallback.promise.then(settle!.resolve, settle!.reject);
    }
  };
  worker.onerror = event => {
    worker.terminate();
    // Worker failed to start or crashed: run on the main thread instead.
    fallback = inThread();
    fallback.promise.then(settle!.resolve, settle!.reject);
    event.preventDefault();
  };

  worker.postMessage({ files, operations, options, canName: !!namer });

  return {
    promise,
    cancel: () => {
      if (fallback) fallback.cancel();
      else worker.terminate();
      settle?.reject(new Error('Processing was cancelled.'));
    },
  };
}
