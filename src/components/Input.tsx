import { useState, useCallback, useEffect } from 'react';
import { PlaceholdersAndVanishInput } from "./ui/placeholders-and-vanish-input";
import { toast } from 'sonner';
import { OllamaWrapper } from '../services/ollama-wrapper';
import { generateFlowFromNaturalLanguage } from '../utils/aiFlowGenerator';

interface AskAIProps {
  onAddNode?: (label: string) => void;
  onAddOperations?: (labels: string[]) => void;
  onLoadState?: (stateData: any) => void;
  currentNodes?: any[];
  availableOperations?: string[];
  onLog?: (message: string) => void;
  ollamaWrapper?: OllamaWrapper | null;
  selectedModel?: string;
  ollamaReady?: boolean | null;
}

export function AskAI({
  onAddNode,
  onAddOperations,
  onLog,
  ollamaWrapper: externalWrapper,
  selectedModel: externalSelectedModel,
}: AskAIProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [internalWrapper, setInternalWrapper] = useState<OllamaWrapper | null>(null);
  const [internalModel, setInternalModel] = useState<string>('');

  const placeholders = [
    "Normalize to 3NF",
    "Discover FDs and candidate keys",
    "Clean CSV and check atomicity",
    "Generate ERD and SQL schema",
    "Build full normalization pipeline",
    "Apply 1NF and 2NF",
    "Generate normalization report"
  ];

  const activeWrapper = externalWrapper !== undefined ? externalWrapper : internalWrapper;
  const activeModel = externalSelectedModel !== undefined ? externalSelectedModel : internalModel;

  const logToConsole = useCallback((message: string) => {
    console.log(`[AI-AGENT] ${message}`);
    if (onLog) {
      onLog(message);
    }
  }, [onLog]);

  const logToast = useCallback((type: 'info' | 'success' | 'error' | 'warning', message: string) => {
    toast[type](`AI: ${message}`, {
      position: "bottom-right",
      style: { fontFamily: "'CMU Serif Roman', serif" },
      duration: type === 'error' ? 5000 : 3000,
    });
  }, []);

  useEffect(() => {
    if (externalWrapper !== undefined) return;

    const initializeOllama = async () => {
      try {
        logToConsole("Connecting to Ollama...");
        const wrapper = new OllamaWrapper();
        const connected = await wrapper.initializeOllama();

        if (connected) {
          setInternalWrapper(wrapper);
          const modelName = wrapper.getSelectedModel();
          setInternalModel(modelName);
          logToConsole(`Ollama connected (${modelName})`);
        } else {
          logToConsole("Ollama offline — Rule Engine Active");
        }
      } catch (error: any) {
        logToConsole(`Ollama error: ${error?.message || 'Error'}`);
      }
    };

    initializeOllama();
  }, [externalWrapper, logToConsole]);

  const processAICommand = useCallback(async (userInput: string) => {
    if (!userInput.trim()) {
      logToast('warning', "Enter an instruction");
      return;
    }

    setIsProcessing(true);
    logToConsole(`Processing: "${userInput}" [Model: ${activeModel || 'Rules'}]`);
    logToast('info', "Generating workflow...");

    try {
      const startTime = Date.now();
      if (activeWrapper && activeModel) {
        activeWrapper.setSelectedModel(activeModel);
      }
      const result = await generateFlowFromNaturalLanguage(userInput, activeWrapper);
      const duration = Date.now() - startTime;

      logToConsole(`Generated in ${duration}ms [${result.source}]`);

      if (result.operations.length > 0) {
        if (onAddOperations) {
          onAddOperations(result.operations);
        } else if (onAddNode) {
          result.operations.forEach(op => onAddNode(op));
        }

        logToast('success', `Added ${result.operations.length} operations`);
        logToConsole(`Pipeline: ${result.operations.join(' → ')}`);
      } else {
        logToast('warning', "No matching operations found");
      }
    } catch (error: any) {
      logToConsole(`AI error: ${error?.message}`);
      logToast('error', "Generation failed");
    } finally {
      setIsProcessing(false);
    }
  }, [activeWrapper, activeModel, onAddNode, onAddOperations, logToConsole, logToast]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const userInput = formData.get('input') as string;

    if (!userInput?.trim()) {
      logToast('warning', "Enter a command");
      return;
    }
    if (isProcessing) {
      logToast('warning', "Processing...");
      return;
    }

    processAICommand(userInput);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="flex flex-col justify-center items-center px-4 w-full">
      <PlaceholdersAndVanishInput
        placeholders={placeholders}
        onChange={() => { }}
        onSubmit={onSubmit}
      />
    </div>
  );
}