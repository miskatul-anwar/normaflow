"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { PlaceholdersAndVanishInput } from "./ui/placeholders-and-vanish-input";
import { toast } from 'sonner';
import { OllamaWrapper } from '../services/ollama-wrapper';

const OPERATIONS = {
    'CSV Data Loader': { phase: 'PREP', id: 'csv-loader', order: 1 },
    'Data Cleaner': { phase: 'PREP', id: 'data-cleaner', order: 2 },
    'Atomicity Checker': { phase: 'PREP', id: 'atomicity-checker', order: 3 },
    'Data Type Profiler': { phase: 'PREP', id: 'data-profiler', order: 4 },
    'FD Miner': { phase: 'ANALYZE', id: 'fd-miner', order: 5 },
    'Key Discovery': { phase: 'ANALYZE', id: 'key-discovery', order: 6 },
    'Cardinality Analyzer': { phase: 'ANALYZE', id: 'cardinality-analyzer', order: 7 },
    '1NF': { phase: 'NORMAL', id: '1nf', order: 8 },
    '2NF': { phase: 'NORMAL', id: '2nf', order: 9 },
    '3NF': { phase: 'NORMAL', id: '3nf', order: 10 },
    'Lossless Check': { phase: 'NORMAL', id: 'lossless-check', order: 11 },
    'Dependency Preservation': { phase: 'NORMAL', id: 'dependency-preservation', order: 12 },
    'ERD Generator': { phase: 'OUTPUT', id: 'erd-generator', order: 13 },
    'Relation Generator': { phase: 'OUTPUT', id: 'relation-generator', order: 14 },
    'SQL Generator': { phase: 'OUTPUT', id: 'sql-generator', order: 15 },
    'Report Generator': { phase: 'OUTPUT', id: 'report-generator', order: 16 },
};

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
    onLoadState,
    currentNodes = [],
    onLog
}: AskAIProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [ollamaReady, setOllamaReady] = useState<boolean | null>(null);
    const [ollamaWrapper, setOllamaWrapper] = useState<OllamaWrapper | null>(null);

    const placeholders = [
        "Find the functional dependencies",
        "Normalize the data to 3NF",
        "Generate a complete ERD workflow",
        "Add all preparation steps",
        "Create a workflow for 2NF normalization",
        "Add missing dependencies for 3NF",
        "Build complete normalization pipeline"
    ];

    const logToConsole = useCallback((message: string, force: boolean = false) => {
        if (force) {
            console.log(`[AI-AGENT] ${message}`);
            if (onLog) {
                onLog(`[AI-AGENT] ${message}`);
            }
        }
    }, [onLog]);

    const logToast = useCallback((type: 'info' | 'success' | 'error' | 'warning', message: string) => {
        toast[type](`AI: ${message}`, {
            position: "bottom-right",
            style: { fontFamily: "'CMU Serif Roman', serif" },
            duration: type === 'error' ? 6000 : 4000,
        });
    }, []);

    useEffect(() => {
        const initializeOllama = async () => {
            try {
                logToConsole("Initializing Ollama connection...", true);
                const wrapper = new OllamaWrapper();

                // Wait a moment for initialization
                await new Promise(resolve => setTimeout(resolve, 1000));

                if (wrapper.isServiceAvailable()) {
                    // Test with a simple chat
                    const response = await wrapper.chat({
                        model: 'llama3.2:3b',
                        messages: [{ role: 'user', content: 'test' }],
                        options: { temperature: 0.1 }
                    });

                    if (response && response.message) {
                        setOllamaWrapper(wrapper);
                        setOllamaReady(true);
                        logToConsole("Ollama connected successfully", true);
                        logToast('success', "Local AI model ready");
                    } else {
                        throw new Error("No valid response from Ollama");
                    }
                } else {
                    throw new Error("Ollama service not available");
                }
            } catch (error: any) {
                logToConsole(`Ollama connection failed: ${error?.message || 'Unknown error'}`, true);
                logToast('error', "Ollama connection failed. Make sure Ollama is running and llama3.2:3b is available");
                setOllamaReady(false);
            }
        };

        initializeOllama();
    }, [logToConsole, logToast]);

    const getSystemPrompt = () => {
        const currentWorkflow = currentNodes.map(n => n.data?.label || 'Start').join(' -> ');
        return `You are NormaFlow AI Assistant for database normalization workflow automation.

CURRENT WORKFLOW: ${currentWorkflow}

AVAILABLE OPERATIONS:
CSV Data Loader, Data Cleaner, Atomicity Checker, Data Type Profiler, 1NF, FD Miner, Key Discovery, Cardinality Analyzer, 2NF, 3NF, Lossless Check, Dependency Preservation, ERD Generator, Relation Generator, SQL Generator, Report Generator

OPERATION ORDER RULES:
1. Data preparation: CSV Data Loader → Data Cleaner → Atomicity Checker → Data Type Profiler
2. Normalization: 1NF → FD Miner → Key Discovery → 2NF → 3NF
3. Validation: Lossless Check → Dependency Preservation  
4. Output: ERD Generator → Relation Generator → SQL Generator → Report Generator

RESPONSE FORMAT:
For adding operations, respond with: OPERATIONS: [operation1, operation2, ...]
For recommendations, respond with: RECOMMEND: explanation
For JSON loading, respond with: LOAD_STATE: {json}

Examples:
User: "Find functional dependencies" → OPERATIONS: ["CSV Data Loader", "Data Cleaner", "Atomicity Checker", "Data Type Profiler", "1NF", "FD Miner"]
User: "Normalize to 3NF" → OPERATIONS: ["CSV Data Loader", "Data Cleaner", "Atomicity Checker", "Data Type Profiler", "1NF", "FD Miner", "Key Discovery", "2NF", "3NF"]

Analyze the user request and provide appropriate response.`;
    };

    const processAICommand = useCallback(async (userInput: string) => {
        if (!ollamaWrapper || ollamaReady === false) {
            logToast('error', "Local AI model not available");
            return;
        }

        if (!userInput.trim()) {
            logToast('warning', "Please enter a command");
            return;
        }

        setIsProcessing(true);
        logToast('info', "AI is thinking...");

        try {
            const startTime = Date.now();

            const response = await ollamaWrapper.chat({
                model: 'llama3.2:3b',
                messages: [
                    { role: 'system', content: getSystemPrompt() },
                    { role: 'user', content: userInput }
                ],
                options: {
                    temperature: 0.1,
                    top_p: 0.9,
                }
            });

            const duration = Date.now() - startTime;
            const aiResponse = response.message.content;

            logToConsole(`AI response received (${duration}ms): ${aiResponse}`, true);

            // Parse AI response
            if (aiResponse.includes("OPERATIONS:")) {
                const operationsMatch = aiResponse.match(/OPERATIONS:\s*\[(.*?)\]/);
                if (operationsMatch) {
                    const operationsStr = operationsMatch[1];
                    const operations = operationsStr
                        .split(',')
                        .map(op => op.trim().replace(/['"]/g, ''))
                        .filter(op => op && OPERATIONS[op as keyof typeof OPERATIONS]);
                    if (operations.length > 0) {
                        logToConsole(`Passing operations to parent: ${operations.join(', ')}`, true);
                        if (onAddOperations) {
                            onAddOperations(operations);
                        } else if (onAddNode) {
                            // fallback, add one by one (legacy support)
                            operations.forEach((operation) => onAddNode(operation));
                        }
                        setTimeout(() => {
                            logToast('success', `Added ${operations.length} operations`);
                        }, operations.length * 300 + 100);
                    } else {
                        logToast('warning', "No valid operations found");
                    }
                } else {
                    logToast('error', "Could not parse operations");
                }
            } else if (aiResponse.includes("LOAD_STATE:")) {
                const stateMatch = aiResponse.match(/LOAD_STATE:\s*({.*})/);
                if (stateMatch && onLoadState) {
                    try {
                        const stateData = JSON.parse(stateMatch[1]);
                        onLoadState(stateData);
                        logToast('success', "State loaded successfully");
                    } catch (error) {
                        logToast('error', "Invalid JSON state");
                    }
                } else {
                    logToast('error', "Could not load state");
                }
            } else if (aiResponse.includes("RECOMMEND:")) {
                const recommendMatch = aiResponse.match(/RECOMMEND:\s*(.*)/);
                if (recommendMatch) {
                    logToast('info', recommendMatch[1].trim());
                }
            } else {
                // Handle JSON input directly from user
                if (userInput.includes('{') && userInput.includes('}')) {
                    const jsonMatch = userInput.match(/{.*}/s);
                    if (jsonMatch && onLoadState) {
                        try {
                            const stateData = JSON.parse(jsonMatch[0]);
                            onLoadState(stateData);
                            logToast('success', "JSON state loaded");
                        } catch (error) {
                            logToast('error', "Invalid JSON format");
                        }
                    }
                } else {
                    // General AI response
                    logToast('info', aiResponse.substring(0, 100) + (aiResponse.length > 100 ? '...' : ''));
                }
            }

        } catch (error: any) {
            logToConsole(`AI processing error: ${error?.message}`, true);
            logToast('error', "AI processing failed");

            // Try to reconnect
            if (ollamaWrapper) {
                const reconnected = await ollamaWrapper.reconnect();
                if (reconnected) {
                    setOllamaReady(true);
                    logToast('info', "Reconnected to Ollama");
                }
            }
        } finally {
            setIsProcessing(false);
        }
    }, [ollamaWrapper, ollamaReady, onAddNode, onAddOperations, onLoadState, currentNodes, logToConsole, logToast]);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const userInput = formData.get('input') as string;
        if (!userInput?.trim()) {
            logToast('warning', "Please enter a command");
            return;
        }
        if (isProcessing) {
            logToast('warning', "AI is currently processing. Please wait...");
            return;
        }
        processAICommand(userInput);
        (e.target as HTMLFormElement).reset();
    };

    const getStatusIndicator = () => {
        if (ollamaReady === false) return "Ollama Error";
        if (isProcessing) return "AI Thinking...";
        if (ollamaReady === true) return "AI Ready";
        return "Connecting...";
    };

    return (
        <div className="h-[8rem] flex flex-col justify-center items-center px-4">
            <PlaceholdersAndVanishInput
                placeholders={placeholders}
                onChange={() => { }}
                onSubmit={onSubmit}
            />
            <div className="mt-2 flex items-center justify-between w-full max-w-4xl">
                {isProcessing && (
                    <div className="text-sm text-gray-600 flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                        Local AI is processing...
                    </div>
                )}
                <div className="text-xs text-gray-500 ml-auto">
                    {getStatusIndicator()}
                </div>
            </div>
        </div>
    );
}