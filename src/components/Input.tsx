import { useState, useCallback } from 'react';
import { PlaceholdersAndVanishInput } from "./ui/placeholders-and-vanish-input";
import { toast } from 'sonner';
import { generateFlowFromNaturalLanguage } from '../utils/aiFlowGenerator';

interface AskAIProps {
  onAddNode?: (label: string) => void;
  onAddOperations?: (labels: string[]) => void;
  onLoadState?: (stateData: any) => void;
  currentNodes?: any[];
  availableOperations?: string[];
  onLog?: (message: string) => void;
}

export function AskAI({
  onAddNode,
  onAddOperations,
  onLog,
}: AskAIProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const placeholders = [
    "Normalize to 3NF",
    "Discover FDs and candidate keys",
    "Clean CSV and check atomicity",
    "Generate ERD and SQL schema",
    "Build full normalization pipeline",
    "Apply 1NF and 2NF",
    "Generate normalization report"
  ];

  const logToConsole = useCallback((message: string) => {
    console.log(`[AI-AGENT] ${message}`);
    if (onLog) {
      onLog(message);
    }
  }, [onLog]);

  const logToast = useCallback((type: 'info' | 'success' | 'error' | 'warning', message: string) => {
    toast[type](`AI: ${message}`, {
      position: "bottom-right",
      style: { fontFamily: "'Inter', sans-serif" },
      duration: type === 'error' ? 5000 : 3000,
    });
  }, []);

  const processAICommand = useCallback(async (userInput: string) => {
    if (!userInput.trim()) {
      logToast('warning', "Enter an instruction");
      return;
    }

    setIsProcessing(true);
    logToConsole(`Processing: "${userInput}"`);
    logToast('info', "Generating workflow...");

    try {
      const startTime = Date.now();
      const result = await generateFlowFromNaturalLanguage(userInput);
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
  }, [onAddNode, onAddOperations, logToConsole, logToast]);

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