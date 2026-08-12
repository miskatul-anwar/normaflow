import { useState, useCallback, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  addEdge,
  Connection,
  Node,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  Edge,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './styles/App.css';

import SideBar from './components/SideBar';
import Heading from './components/heading';
import Console from './components/Console';
import OutputPage from './components/OutputPage';
import { AskAI } from './components/Input';
import { useNormalization } from './hooks/useNormalization';
import { useOperationValidation } from './hooks/useOperationValidation';
import { toast } from 'sonner';
import { Logger } from './services/utils/logger';
import { OPERATIONS } from './config/operations';
import { validateSequence } from './utils/workflowValidation';
import { CustomBezierEdge } from './components/flow/CustomBezierEdge';
import { StartNode, TealNode } from './components/flow/CustomNodes';
import { OllamaWrapper } from './services/ollama-wrapper';

// Global logger instance
const logger = new Logger();

const proOptions = { hideAttribution: true };

function getNodeColor(node: Node): string {
  const label = String(node.data?.label || '').toLowerCase();
  if (label === 'start') {
    return '#2dd4bf';
  }
  return '#ccfbf1';
}

const initialX = 100;
const initialY = 400;
const nodeSpacing = 200;

const initialStartNode: Node = {
  id: "0",
  position: { x: initialX, y: initialY },
  data: { label: "Start" },
  type: "startNode",
  draggable: false,
  selectable: false,
};

const nodeTypes = {
  startNode: StartNode,
  tealNode: TealNode,
};

const edgeTypes = {
  default: CustomBezierEdge,
};

const createDefaultSampleFile = (): File => {
  const csvData = `order_id,customer_id,customer_name,email,product_name,price,order_date
101,1,Alice Smith,alice@example.com,Laptop,1200.00,2025-01-15
102,2,Bob Jones,bob@example.com,Mouse,25.00,2025-01-16
103,1,Alice Smith,alice@example.com,Keyboard,75.00,2025-01-17
104,3,Charlie Brown,charlie@example.com,Monitor,300.00,2025-01-18`;
  return new File([csvData], "sample_orders.csv", { type: "text/csv" });
};

function MainAppContent() {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([initialStartNode]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [id, setId] = useState(1);
  const [redoStack, setRedoStack] = useState<Node[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>(() => [createDefaultSampleFile()]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [processedResults, setProcessedResults] = useState<any>(() => {
    try {
      const cached = sessionStorage.getItem('normaflow_latest_results');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.success) return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Ollama Model Selection State
  const [ollamaWrapper, setOllamaWrapper] = useState<OllamaWrapper | null>(null);
  const [ollamaReady, setOllamaReady] = useState<boolean | null>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  const {
    isProcessing,
    progress,
    processFiles,
  } = useNormalization();

  const validation = useOperationValidation({
    completedOperations: progress ? [progress.operation] : [],
    currentNormalForm: progress?.phase || null,
    uploadedFile: uploadedFiles[0] || null,
    processedResults,
    nodes
  });

  const logMessage = useCallback((
    type: 'info' | 'success' | 'error' | 'warning',
    message: string,
    category?: string
  ) => {
    if (type === 'info') {
      logger.info(message, undefined, category);
    } else if (type === 'success') {
      logger.success(message, undefined, category);
    } else if (type === 'error') {
      logger.error(message, undefined, category);
    } else if (type === 'warning') {
      logger.info(`[WARNING] ${message}`, undefined, category);
    }

    const timestamp = new Date().toLocaleTimeString();
    const categoryTag = category ? `[${category}]` : '';
    const logEntry = `[${timestamp}] ${categoryTag} ${message}`;
    setConsoleLogs(prev => [...prev, logEntry]);

    toast.dismiss();
    toast[type](message, {
      position: "bottom-right",
      style: { fontFamily: "'CMU Serif Roman', serif" },
      duration: type === 'error' ? 6000 : 4000,
    });
  }, []);

  const refreshOllamaModels = useCallback(async () => {
    try {
      const wrapper = new OllamaWrapper();
      const connected = await wrapper.initializeOllama();
      if (connected) {
        setOllamaWrapper(wrapper);
        setOllamaReady(true);
        const models = wrapper.getModels();
        const active = wrapper.getSelectedModel();
        setInstalledModels(models);
        setSelectedModel(active);
        logMessage('success', `Ollama Connected (${models.length} model${models.length > 1 ? 's' : ''} available)`, 'OLLAMA');
      } else {
        setOllamaReady(false);
        setInstalledModels([]);
        setSelectedModel('');
        logMessage('info', 'Ollama offline — Rule Synthesizer Active', 'OLLAMA');
      }
    } catch (err) {
      setOllamaReady(false);
      logMessage('warning', `Ollama connection error: ${(err as Error).message}`, 'OLLAMA');
    }
  }, [logMessage]);

  useEffect(() => {
    refreshOllamaModels();
  }, [refreshOllamaModels]);

  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model);
    if (ollamaWrapper) {
      ollamaWrapper.setSelectedModel(model);
      logMessage('info', `Switched active AI model to: ${model}`, 'OLLAMA');
    }
  }, [ollamaWrapper, logMessage]);

  const handleAILog = useCallback((message: string) => {
    logMessage('info', message, 'AI-AGENT');
  }, [logMessage]);

  const addNode = useCallback((label: string) => {
    logMessage('info', `Attempting to add operation: ${label}`, 'VALIDATION');

    const operation = OPERATIONS[label];
    if (!operation) {
      logMessage('error', `Unknown operation: ${label}`, 'VALIDATION');
      return;
    }

    const currentOperations = nodes.slice(1).map(node => String(node.data?.label || ''));
    const missingDependencies = operation.dependencies.filter(dep => !currentOperations.includes(dep));

    if (missingDependencies.length > 0) {
      logMessage('error', `Cannot add ${label}. Missing dependencies: ${missingDependencies.join(', ')}`, 'VALIDATION');
      return;
    }

    if (operation.phase === 'PREP' && label === 'CSV Data Loader' && uploadedFiles.length === 0) {
      logMessage('warning', `${label} added, but CSV file(s) should be uploaded first`, 'VALIDATION');
    }

    const validationResult = validation.validateOperation(label);
    if (!validationResult.isValid) {
      logMessage('error', `Validation failed for ${label}: ${validationResult.errors[0]}`, 'VALIDATION');
      return;
    }

    const testOperations = [...currentOperations, label];
    const mockNodes: Node[] = [
      initialStartNode,
      ...testOperations.map((op, idx) => ({
        id: `${idx + 1}`,
        position: { x: 0, y: 0 },
        data: { label: op },
        type: "tealNode"
      }))
    ];

    const sequenceValidation = validateSequence(mockNodes);
    if (!sequenceValidation.isValid) {
      logMessage('error', `Sequence validation failed: ${sequenceValidation.errors[0]}`, 'VALIDATION');
      return;
    }

    sequenceValidation.warnings.forEach(warning => {
      logMessage('warning', warning, 'VALIDATION');
    });

    setNodes(nds => {
      const newNode: Node = {
        id: `${id}`,
        position: { x: initialX + nds.length * nodeSpacing, y: initialY },
        data: {
          label,
          phase: operation.phase,
          operationId: operation.id,
          order: operation.order
        },
        type: "tealNode",
      };
      const newNodes = [...nds, newNode];
      setId(i => i + 1);
      setRedoStack([]);

      setEdges(eds => {
        if (nds.length > 0) {
          const prevNode = nds[nds.length - 1];
          const newEdge: Edge = {
            id: `e${prevNode.id}-${newNode.id}`,
            source: prevNode.id,
            target: newNode.id,
            sourceHandle: 'b',
            targetHandle: 't',
            markerEnd: {
              type: MarkerType.Arrow,
              width: 20,
              height: 20,
              color: '#115e59'
            },
            type: 'default',
          };
          return [...eds, newEdge];
        }
        return eds;
      });

      logMessage('success', `Successfully added: ${label} (${operation.description})`, 'WORKFLOW');
      logMessage('info', `Current workflow: ${newNodes.slice(1).map(n => n.data.label).join(' → ')}`, 'WORKFLOW');
      return newNodes;
    });
  }, [id, logMessage, validation, nodes, uploadedFiles]);

  const addOperationsBatch = useCallback((labels: string[]) => {
    if (!labels || !labels.length) {
      logMessage('warning', 'No operations provided for batch add', 'AI-AGENT');
      return;
    }

    logMessage('info', `AI generating pipeline sequence: ${labels.join(' → ')}`, 'AI-AGENT');

    setNodes(prevNodes => {
      const existingOps = new Set(prevNodes.slice(1).map(n => String(n.data?.label || '')));
      const newOpsToAdd = labels.filter(op => !existingOps.has(op) && OPERATIONS[op]);

      if (newOpsToAdd.length === 0) {
        logMessage('info', 'Operations already present in flow graph.', 'AI-AGENT');
        return prevNodes;
      }

      const updatedNodes = [...prevNodes];
      const updatedEdges: Edge[] = [];

      newOpsToAdd.forEach((opLabel) => {
        const opConfig = OPERATIONS[opLabel];
        const nextId = updatedNodes.length;
        const newNode: Node = {
          id: `${nextId}`,
          position: { x: initialX + nextId * nodeSpacing, y: initialY },
          data: {
            label: opLabel,
            phase: opConfig?.phase || 'PREP',
            operationId: opConfig?.id || opLabel.toLowerCase(),
            order: opConfig?.order || nextId
          },
          type: "tealNode"
        };
        updatedNodes.push(newNode);
      });

      // Rebuild edges sequentially across all nodes
      for (let i = 1; i < updatedNodes.length; i++) {
        const prevNode = updatedNodes[i - 1];
        const currNode = updatedNodes[i];
        updatedEdges.push({
          id: `e${prevNode.id}-${currNode.id}`,
          source: prevNode.id,
          target: currNode.id,
          sourceHandle: 'b',
          targetHandle: 't',
          markerEnd: {
            type: MarkerType.Arrow,
            width: 20,
            height: 20,
            color: '#115e59'
          },
          type: 'default'
        });
      }

      setEdges(updatedEdges);
      setId(updatedNodes.length);
      logMessage('success', `Added ${newOpsToAdd.length} operations to workflow graph!`, 'WORKFLOW');
      return updatedNodes;
    });
  }, [logMessage]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        markerEnd: {
          type: MarkerType.Arrow,
          width: 20,
          height: 20,
          color: '#115e59'
        },
        type: 'default',
      };
      setEdges(edgesSnapshot => addEdge(newEdge, edgesSnapshot));
      logMessage('info', `Connected nodes: ${params.source} → ${params.target}`, 'WORKFLOW');
    },
    [logMessage]
  );

  const handleUndo = useCallback(() => {
    setNodes(nds => {
      if (nds.length <= 1) {
        logMessage('warning', 'Cannot undo: Already at initial state', 'WORKFLOW');
        return nds;
      }
      const removedNode = nds[nds.length - 1];
      setRedoStack(prev => [removedNode, ...prev]);
      setEdges(eds => eds.filter(e => e.target !== removedNode.id));
      logMessage('info', `Removed operation: ${removedNode.data?.label}`, 'WORKFLOW');
      return nds.slice(0, nds.length - 1);
    });
  }, [logMessage]);

  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) {
        logMessage('warning', 'Cannot redo: No operations to restore', 'WORKFLOW');
        return prev;
      }
      const [nodeToReadd, ...rest] = prev;
      setNodes(nds => {
        const newNodes = [...nds, nodeToReadd];
        setEdges(eds => {
          if (nds.length > 0) {
            const prevNode = nds[nds.length - 1];
            const newEdge: Edge = {
              id: `e${prevNode.id}-${nodeToReadd.id}`,
              source: prevNode.id,
              target: nodeToReadd.id,
              sourceHandle: 'b',
              targetHandle: 't',
              markerEnd: {
                type: MarkerType.Arrow,
                width: 20,
                height: 20,
                color: '#115e59'
              },
              type: 'default',
            };
            return [...eds, newEdge];
          }
          return eds;
        });
        logMessage('success', `Restored operation: ${nodeToReadd.data?.label}`, 'WORKFLOW');
        return newNodes;
      });
      return rest;
    });
  }, [logMessage]);

  const handleFileUpload = useCallback((files: File[]) => {
    logMessage('info', `Multi-CSV upload attempt: ${files.length} file(s)`, 'FILE');
    const validCsvs = files.filter(f => f.name.toLowerCase().endsWith('.csv') || f.name.toLowerCase().endsWith('.xlsx') || f.type === 'text/csv');

    if (validCsvs.length > 0) {
      logMessage('success', `Uploaded ${validCsvs.length} dataset file(s): ${validCsvs.map(f => f.name).join(', ')}`, 'FILE');
      setUploadedFiles(validCsvs);
    } else {
      logMessage('error', `No valid CSV files provided. Received: ${files.map(f => f.name).join(', ')}`, 'FILE');
      setUploadedFiles([]);
    }
  }, [logMessage]);

  const handleSaveState = useCallback(() => {
    try {
      logMessage('info', 'Saving workflow state...', 'FILE');
      const stateData = {
        "06062003": true,
        timestamp: new Date().toISOString(),
        nodes,
        edges,
        nextId: id,
        version: "1.0",
        operationCount: nodes.length - 1
      };

      const dataBlob = new Blob([JSON.stringify(stateData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `normaflow-state-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      logMessage('success', `State saved: ${stateData.operationCount} operations, ${edges.length} connections`, 'FILE');
    } catch (error) {
      logMessage('error', `Save failed: ${(error as Error).message}`, 'FILE');
    }
  }, [nodes, edges, id, logMessage]);

  const handleLoadState = useCallback((file: File) => {
    logMessage('info', `Loading state from: ${file.name}`, 'FILE');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const stateData = JSON.parse(content);

        if (!stateData["06062003"] || !Array.isArray(stateData.nodes) || !Array.isArray(stateData.edges)) {
          logMessage('error', "Invalid state file format", 'FILE');
          return;
        }

        const seqValidation = validateSequence(stateData.nodes);
        if (!seqValidation.isValid) {
          logMessage('error', `Loaded state has validation errors: ${seqValidation.errors.join(', ')}`, 'FILE');
          return;
        }

        setNodes(stateData.nodes);
        setEdges(stateData.edges);
        setId(stateData.nextId || 1);
        setRedoStack([]);

        logMessage('success', `State loaded: ${stateData.nodes.length - 1} operations`, 'FILE');
      } catch (error) {
        logMessage('error', `Load failed: ${(error as Error).message}`, 'FILE');
      }
    };
    reader.readAsText(file);
  }, [logMessage]);

  const handleLoadStateFromAI = useCallback((stateData: any) => {
    try {
      if (stateData.nodes && stateData.edges) {
        const seqVal = validateSequence(stateData.nodes);
        if (!seqVal.isValid) {
          logMessage('error', `AI state validation failed: ${seqVal.errors.join(', ')}`, 'AI-AGENT');
          return;
        }

        setNodes(stateData.nodes);
        setEdges(stateData.edges);
        setId(stateData.nextId || 1);
        setRedoStack([]);
        logMessage('success', `AI loaded complete workflow state`, 'AI-AGENT');
        return;
      }

      if (Array.isArray(stateData)) {
        setNodes([initialStartNode]);
        setEdges([]);
        setId(1);
        setRedoStack([]);

        stateData.forEach(operation => addNode(operation));
        logMessage('success', `AI initiated batch loading: ${stateData.length} operations`, 'AI-AGENT');
      }
    } catch (error) {
      logMessage('error', `AI state load failed: ${(error as Error).message}`, 'AI-AGENT');
    }
  }, [logMessage, addNode]);

  const handleRun = useCallback(async () => {
    logMessage('info', 'Initiating workflow execution...', 'EXECUTION');

    if (uploadedFiles.length === 0) {
      logMessage('error', "No CSV file uploaded. Please upload 1 or more CSV files before execution.", 'EXECUTION');
      return;
    }

    if (nodes.length <= 1) {
      logMessage('error', "Empty workflow. Please add operations before execution.", 'EXECUTION');
      return;
    }

    const selectedOperations = nodes.slice(1).map(node => String(node.data?.label || ''));
    logMessage('info', `Executing workflow for ${uploadedFiles.length} file(s): ${selectedOperations.join(' → ')}`, 'EXECUTION');

    const sequenceValidation = validateSequence(nodes);
    if (!sequenceValidation.isValid) {
      logMessage('error', `Workflow validation failed: ${sequenceValidation.errors.join(', ')}`, 'EXECUTION');
      return;
    }

    const hookValidation = validation.validateSequence(selectedOperations);
    if (!hookValidation.isValid) {
      logMessage('error', `Hook validation failed: ${hookValidation.errors[0]}`, 'EXECUTION');
      return;
    }

    logMessage('success', `Starting multi-CSV normalization process (${uploadedFiles.length} tables)...`, 'EXECUTION');

    try {
      const result = await processFiles(uploadedFiles, selectedOperations);
      if (result && result.success) {
        setProcessedResults(result);
        try {
          sessionStorage.setItem('normaflow_latest_results', JSON.stringify(result));
        } catch {
          // ignore
        }
        logMessage('success', `Normalization completed successfully for ${uploadedFiles.length} table(s)!`, 'EXECUTION');
      } else {
        logMessage('error', `Processing failed: ${result?.error || 'Unknown error'}`, 'EXECUTION');
      }
    } catch (err) {
      logMessage('error', `Fatal execution error: ${(err as Error).message}`, 'EXECUTION');
    }
  }, [nodes, uploadedFiles, logMessage, processFiles, validation]);

  const handleRunAll = useCallback(async () => {
    logMessage('info', 'Initiating complete multi-CSV normalization pipeline...', 'EXECUTION');

    const filesToRun = uploadedFiles.length > 0 ? uploadedFiles : [createDefaultSampleFile()];

    const allOperations = [
      'CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler', 'NER Classifier',
      '1NF', 'FD Miner', 'Key Discovery', 'Relation Detector', 'Ollama AI Analyst', 'Cardinality Analyzer',
      '2NF', '3NF', 'Lossless Check', 'Dependency Preservation',
      'ERD Generator', 'Relation Generator', 'SQL Generator', 'Report Generator'
    ];

    const allNodes: Node[] = [initialStartNode];
    const allEdges: Edge[] = [];
    let currentId = 1;

    for (let i = 0; i < allOperations.length; i++) {
      const op = allOperations[i];
      const config = OPERATIONS[op];

      const newNode: Node = {
        id: `${currentId}`,
        position: { x: initialX + currentId * nodeSpacing, y: initialY },
        data: {
          label: op,
          phase: config?.phase || 'PREP',
          operationId: config?.id || op.toLowerCase(),
          order: config?.order || i + 1
        },
        type: "tealNode",
      };

      allNodes.push(newNode);
      const prevNode = allNodes[allNodes.length - 2];
      allEdges.push({
        id: `e${prevNode.id}-${newNode.id}`,
        source: prevNode.id,
        target: newNode.id,
        sourceHandle: 'b',
        targetHandle: 't',
        markerEnd: {
          type: MarkerType.Arrow,
          width: 20,
          height: 20,
          color: '#115e59'
        },
        type: 'default',
      });
      currentId++;
    }

    setNodes(allNodes);
    setEdges(allEdges);
    setId(currentId);

    try {
      const result = await processFiles(filesToRun, allOperations);
      if (result && result.success) {
        setProcessedResults(result);
        try {
          sessionStorage.setItem('normaflow_latest_results', JSON.stringify(result));
        } catch {
          // ignore
        }
        logMessage('success', `Complete multi-CSV normalization pipeline finished for ${filesToRun.length} table(s)!`, 'EXECUTION');
        return result;
      } else {
        logMessage('error', `Pipeline processing failed: ${result?.error || 'Unknown error'}`, 'EXECUTION');
        return result;
      }
    } catch (err) {
      logMessage('error', `Pipeline error: ${(err as Error).message}`, 'EXECUTION');
      return null;
    }
  }, [uploadedFiles, logMessage, processFiles]);

  const handleViewOutput = useCallback(async () => {
    let activeResults = processedResults;
    if (!activeResults || !activeResults.success) {
      try {
        const cached = sessionStorage.getItem('normaflow_latest_results');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.success) activeResults = parsed;
        }
      } catch {
        // ignore
      }
    }

    if (!activeResults || !activeResults.success) {
      logMessage('info', 'Executing automatic workflow to generate outputs...', 'NAVIGATION');
      const freshResult = await handleRunAll();
      if (freshResult && freshResult.success) {
        activeResults = freshResult;
      } else {
        try {
          const cached = sessionStorage.getItem('normaflow_latest_results');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.success) activeResults = parsed;
          }
        } catch {
          // ignore
        }
      }
    }

    if (activeResults && activeResults.success) {
      navigate('/output', {
        state: {
          results: activeResults,
          outputFiles: activeResults.outputFiles,
          logs: [...consoleLogs, ...(activeResults.logs || [])],
          selectedOperations: nodes.slice(1).map(node => String(node.data?.label || ''))
        }
      });
    } else {
      logMessage('error', 'Failed to generate output results.', 'NAVIGATION');
    }
  }, [processedResults, navigate, consoleLogs, nodes, logMessage, handleRunAll]);

  const availableOperationKeys = useMemo(() => Object.keys(OPERATIONS), []);

  return (
    <div className="bg-gray-200 overflow-hidden h-screen">
      <div className="grid grid-cols-[68px_1fr_480px] grid-rows-[56px_1fr] h-full p-3 gap-3">
        <header className="col-span-3 bg-gray-200/90 flex items-center border-b border-gray-300 px-2 rounded-xl">
          <Heading
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={nodes.length > 1}
            canRedo={redoStack.length > 0}
            onRun={handleRun}
            onRunAll={handleRunAll}
            onFileUpload={handleFileUpload}
            uploadedFileCount={uploadedFiles.length}
            onViewOutput={handleViewOutput}
            onSaveState={handleSaveState}
            onLoadState={handleLoadState}
            isRunning={isProcessing}
            isOutputReady={processedResults?.success || false}
            selectedModel={selectedModel}
            installedModels={installedModels}
            ollamaReady={ollamaReady}
            onModelSelect={handleModelSelect}
            onRefreshModels={refreshOllamaModels}
          />
        </header>

        <aside className="bg-gray-200 text-gray-600 p-2 overflow-hidden">
          <SideBar onAddNode={addNode} />
        </aside>

        <main className="bg-white rounded-xl p-6 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 mb-6">
            <ReactFlow
              nodes={nodes}
              proOptions={proOptions}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={changes => setNodes(nds => applyNodeChanges(changes, nds))}
              onEdgesChange={changes => setEdges(eds => applyEdgeChanges(changes, eds))}
              onConnect={onConnect}
              fitView
              className="h-full w-full"
            >
              <Controls className="!top-4 !right-4 !left-auto !bottom-auto" />
              <MiniMap
                nodeColor={getNodeColor}
                maskColor="rgba(255, 255, 255, 0.8)"
                pannable
                zoomable
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Background gap={12} size={1} />
            </ReactFlow>
          </div>

          <div className="flex-shrink-0 h-20 border-t border-gray-200 py-2 px-2 flex items-center justify-center relative">
            <div className="w-full max-w-4xl">
              <AskAI
                onAddNode={addNode}
                onAddOperations={addOperationsBatch}
                onLoadState={handleLoadStateFromAI}
                currentNodes={nodes}
                availableOperations={availableOperationKeys}
                onLog={handleAILog}
                ollamaWrapper={ollamaWrapper}
                selectedModel={selectedModel}
                ollamaReady={ollamaReady}
              />
            </div>
          </div>
        </main>

        <aside className="overflow-hidden">
          <Console
            currentPhase={progress?.phase || 'PREP'}
            completedOperations={progress ? [progress.operation] : []}
            activeOperation={progress?.operation || ''}
            logs={consoleLogs}
            processedResults={processedResults}
            onExecuteCommand={(cmd) => logMessage('info', cmd, 'COMMAND')}
            onClearLogs={() => setConsoleLogs([])}
            onPauseLogs={() => logMessage('info', 'Console logging paused', 'CONSOLE')}
            isPaused={false}
            onAddNode={addNode}
            onRunOperation={handleRun}
            onRunAll={handleRunAll}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={nodes.length > 1}
            canRedo={redoStack.length > 0}
            validationResults={validation.validationResults}
            blockedOperations={validation.blockedOperations}
            availableOperations={validation.availableOperations}
            nextRecommended={validation.nextRecommended}
            validateOperation={validation.validateOperation}
            getBlockingReason={validation.getBlockingReason}
            getOperationDependencies={validation.getOperationDependencies}
            canGenerateOutputs={validation.canGenerateOutputs}
            normalizationProgress={validation.normalizationProgress}
            currentNormalForm={progress?.phase || null}
            uploadedFile={uploadedFiles[0] || null}
            nodes={nodes}
          />
        </aside>
      </div>
    </div>
  );
}

function MainApp() {
  return (
    <ReactFlowProvider>
      <MainAppContent />
    </ReactFlowProvider>
  );
}

function App() {
  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path="/output" element={<OutputPage />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}

export default App;