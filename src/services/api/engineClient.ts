/**
 * Page-side handle for the engine worker.
 *
 * `runEngine` starts the analysis in a Web Worker so the window stays
 * responsive, and `cancel()` terminates the worker, which stops even a
 * long synchronous step. If workers are unavailable (tests, old webviews) or
 * the result cannot be copied across, the same code runs on the main thread.
 */
import DatabaseService, { type ProcessingResult, type ProcessingState } from './databaseService';
import type { EngineMessage } from '../../workers/engine.worker';

export interface EngineRun {
  promise: Promise<ProcessingResult>;
  cancel: () => void;
}

export function runEngine(
  files: File[],
  operations: string[],
  onProgress: (state: ProcessingState) => void,
  options: Record<string, unknown> = {},
): EngineRun {
  const inThread = (): EngineRun => ({
    promise: DatabaseService.processFiles(files, operations, onProgress, options),
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

  worker.postMessage({ files, operations, options });

  return {
    promise,
    cancel: () => {
      if (fallback) fallback.cancel();
      else worker.terminate();
      settle?.reject(new Error('Processing was cancelled.'));
    },
  };
}
