import { useState, useCallback } from 'react';
import DatabaseService, { ProcessingResult, ProcessingState } from '../services/api/databaseService';

export interface UseNormalizationReturn {
  isProcessing: boolean;
  progress: ProcessingState | null;
  results: ProcessingResult | null;
  error: string | null;
  processFile: (file: File, operations: string[]) => Promise<ProcessingResult>;
  cancelProcessing: () => void;
  downloadFile: (file: any) => Promise<void>;
  reset: () => void;
}

export const useNormalization = (): UseNormalizationReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingState | null>(null);
  const [results, setResults] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File, operations: string[]): Promise<ProcessingResult> => {
    setIsProcessing(true);
    setError(null);
    setResults(null);
    setProgress({ phase: 'PREP', operation: 'csv-loader', progress: 0, message: 'Starting...' });

    try {
      const result = await DatabaseService.processFile(
        file,
        operations,
        setProgress,
        { maxLhsSize: 4, maxSampleSize: 100, timeout: 30000 }
      );

      setResults(result);
      if (!result.success) {
        setError(result.error || 'Processing failed');
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
      setIsProcessing(false);
      setProgress(null);
    }
  }, []);

  const cancelProcessing = useCallback(() => {
    DatabaseService.cancelProcessing();
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
    cancelProcessing,
    downloadFile,
    reset
  };
};