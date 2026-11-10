/// <reference lib="webworker" />
/**
 * Runs the normalization engine off the UI thread. The page sends the files
 * and selected operations; progress and the final result come back as
 * messages. Cancelling is done by terminating this worker from the page.
 */
import DatabaseService from '../services/api/databaseService';

export type EngineRequest = {
  files: File[];
  operations: string[];
  options: Record<string, unknown>;
};

export type EngineMessage =
  | { type: 'progress'; progress: unknown }
  | { type: 'done'; result: unknown }
  | { type: 'error'; message: string }
  /** The result could not be copied to the page; the page re-runs on the main thread. */
  | { type: 'clone-error' };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<EngineRequest>) => {
  const { files, operations, options } = event.data;
  try {
    const result = await DatabaseService.processFiles(
      files,
      operations,
      progress => ctx.postMessage({ type: 'progress', progress } satisfies EngineMessage),
      options,
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
