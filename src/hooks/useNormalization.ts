import { useState, useCallback, useRef } from 'react';
import { runEngine, type EngineRun } from '../services/api/engineClient';
import { createWorkerNamer } from '../services/naming/workerNamer';
import { loadUserNames, modelNamingEnabled } from '../services/naming/userNames';
import DatabaseService, { ProcessingResult, ProcessingState } from '../services/api/databaseService';

export interface UseNormalizationReturn {
  isProcessing: boolean;
  progress: ProcessingState | null;
  results: ProcessingResult | null;
  error: string | null;
  processFile: (file: File, operations: string[]) => Promise<ProcessingResult>;
  processFiles: (files: File[], operations: string[]) => Promise<ProcessingResult>;
  cancelProcessing: () => void;
  downloadFile: (file: any) => Promise<void>;
  reset: () => void;
}

export const useNormalization = (): UseNormalizationReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingState | null>(null);
  const [results, setResults] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<EngineRun | null>(null);

  const processFiles = useCallback(async (files: File[], operations: string[]): Promise<ProcessingResult> => {
    setIsProcessing(true);
    setError(null);
    setResults(null);
    setProgress({ phase: 'PREP', operation: 'csv-loader', progress: 0, message: `Starting multi-CSV pipeline for ${files.length} files...` });

    try {
      const run = runEngine(files, operations, setProgress, {
        maxLhsSize: 4,
        userNames: loadUserNames(),
        namer: modelNamingEnabled() ? createWorkerNamer() : null,
      });
      runRef.current = run;
      const result = await run.promise;

      setResults(result);
      if (!result.success) {
        setError(result.error || 'Multi-CSV processing failed');
      }

      return result;
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);

      const failedResult: ProcessingResult = {
        success: false,
        error: errorMessage,
        stats: {},
        outputFiles: [],
        logs: [`Error: ${errorMessage}`],
        duration: '0s',
        selectedOperations: operations
      };

      setResults(failedResult);
      return failedResult;
    } finally {
      runRef.current = null;
      setIsProcessing(false);
      setProgress(null);
    }
  }, []);

  const processFile = useCallback(async (file: File, operations: string[]): Promise<ProcessingResult> => {
    return processFiles([file], operations);
  }, [processFiles]);

  const cancelProcessing = useCallback(() => {
    runRef.current?.cancel();
    setIsProcessing(false);
    setProgress(null);
  }, []);

  const downloadFile = useCallback(async (file: any) => {
    await DatabaseService.downloadFile(file);
  }, []);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setProgress(null);
    setResults(null);
    setError(null);
  }, []);

  return {
    isProcessing,
    progress,
    results,
    error,
    processFile,
    processFiles,
    cancelProcessing,
    downloadFile,
    reset
  };
};