/**
 * useOllamaConnection — detects and manages the local Ollama connection:
 * availability, installed models and the active model selection.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { OllamaWrapper } from '../services/ollama-wrapper';

export type ConnectionState = 'checking' | 'online' | 'offline';

export interface OllamaConnection {
  status: ConnectionState;
  wrapper: OllamaWrapper | null;
  models: string[];
  selectedModel: string;
  selectModel: (model: string) => void;
  refresh: () => Promise<void>;
}

export function useOllamaConnection(
  log?: (level: 'info' | 'success' | 'error' | 'warning', message: string) => void,
): OllamaConnection {
  const [status, setStatus] = useState<ConnectionState>('checking');
  const [wrapper, setWrapper] = useState<OllamaWrapper | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const candidate = new OllamaWrapper();
      const connected = await candidate.initializeOllama();
      if (!mountedRef.current) return;

      if (connected) {
        setWrapper(candidate);
        setStatus('online');
        setModels(candidate.getModels());
        setSelectedModel(candidate.getSelectedModel());
        log?.('success', `Ollama connected — ${candidate.getModels().length} model(s) available`);
      } else {
        setWrapper(null);
        setStatus('offline');
        setModels([]);
        setSelectedModel('');
        log?.('info', 'Ollama offline — built-in rule engine active');
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setWrapper(null);
      setStatus('offline');
      log?.('warning', `Ollama connection error: ${(error as Error).message}`);
    }
  }, [log]);

  useEffect(() => {
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  const selectModel = useCallback(
    (model: string) => {
      setSelectedModel(model);
      wrapper?.setSelectedModel(model);
      log?.('info', `Active AI model switched to: ${model}`);
    },
    [wrapper, log],
  );

  return { status, wrapper, models, selectedModel, selectModel, refresh };
}
