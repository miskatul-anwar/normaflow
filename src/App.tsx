import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ReactFlowProvider } from '@xyflow/react';
import type { Node } from '@xyflow/react';

import Heading from './components/heading';
import Console from './components/Console';
import OutputPage from './components/OutputPage';
import { AskAI } from './components/Input';
import { OperationPalette } from './components/workflow/OperationPalette';
import { FlowCanvas } from './components/workflow/FlowCanvas';
import { useNormalization } from './hooks/useNormalization';
import { useOperationValidation } from './hooks/useOperationValidation';
import { useWorkflowGraph, type WorkflowSnapshot } from './hooks/useWorkflowGraph';
import { useOllamaConnection } from './hooks/useOllamaConnection';
import { Logger } from './services/utils/logger';
import { OPERATIONS } from './config/operations';
import { validateSequence } from './utils/workflowValidation';
import { loadCachedResult, saveCachedResult } from './utils/resultCache';
import './styles/App.css';

const logger = new Logger();

type LogLevel = 'info' | 'success' | 'error' | 'warning';

const SAMPLE_CSV = `order_id,customer_id,customer_name,email,product_name,price,order_date
101,1,Alice Smith,alice@example.com,Laptop,1200.00,2025-01-15
102,2,Bob Jones,bob@example.com,Mouse,25.00,2025-01-16
103,1,Alice Smith,alice@example.com,Keyboard,75.00,2025-01-17
104,3,Charlie Brown,charlie@example.com,Monitor,300.00,2025-01-18`;

const createSampleFile = (): File =>
  new File([SAMPLE_CSV], 'sample_orders.csv', { type: 'text/csv' });

const ALL_OPERATIONS = Object.keys(OPERATIONS);

function downloadJson(snapshot: WorkflowSnapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `normaflow-workflow-${snapshot.timestamp.slice(0, 19).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Main workspace: palette + canvas + console. */
function Workspace() {
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>(() => [createSampleFile()]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [processedResults, setProcessedResults] = useState<any>(() => loadCachedResult());

  const { isProcessing, progress, processFiles } = useNormalization();

  // ----- logging -------------------------------------------------------------

  const logMessage = useCallback((level: LogLevel, message: string, category?: string) => {
    if (level === 'success') logger.success(message, undefined, category);
    else if (level === 'error') logger.error(message, undefined, category);
    else logger.info(level === 'warning' ? `[WARNING] ${message}` : message, undefined, category);

    const timestamp = new Date().toLocaleTimeString();
    const tag = category ? `[${category}] ` : '';
    setConsoleLogs(prev => [...prev.slice(-500), `[${timestamp}] ${tag}${message}`]);
  }, []);

  // ----- workflow graph & ollama ---------------------------------------------

  const graph = useWorkflowGraph({ log: logMessage });
  const ollama = useOllamaConnection(logMessage);

  const validation = useOperationValidation({
    completedOperations: progress ? [progress.operation] : [],
    currentNormalForm: progress?.phase || null,
    uploadedFile: uploadedFiles[0] || null,
    processedResults,
    nodes: graph.nodes,
  });

  // ----- file handling -------------------------------------------------------

  const handleFileUpload = useCallback(
    (files: File[]) => {
      const valid = files.filter(
        f => f.name.toLowerCase().endsWith('.csv') || f.name.toLowerCase().endsWith('.xlsx') || f.type === 'text/csv',
      );
      if (valid.length > 0) {
        setUploadedFiles(valid);
        logMessage('success', `Loaded ${valid.length} dataset file(s): ${valid.map(f => f.name).join(', ')}`, 'FILE');
      } else {
        logMessage('error', `No valid CSV/XLSX files among: ${files.map(f => f.name).join(', ')}`, 'FILE');
      }
    },
    [logMessage],
  );

  // ----- execution -----------------------------------------------------------

  const executePipeline = useCallback(
    async (files: File[], operations: string[]) => {
      try {
        const result = await processFiles(files, operations);
        if (result?.success) {
          setProcessedResults(result);
          saveCachedResult(result);
          logMessage('success', `Pipeline finished for ${files.length} table(s)`, 'EXECUTION');
        } else {
          logMessage('error', `Processing failed: ${result?.error ?? 'unknown error'}`, 'EXECUTION');
        }
        return result;
      } catch (err) {
        logMessage('error', `Execution error: ${(err as Error).message}`, 'EXECUTION');
        return null;
      }
    },
    [logMessage, processFiles],
  );

  const hasFiles = uploadedFiles.length > 0;
  const operationCount = Math.max(0, graph.nodes.length - 1);

  const handleRun = useCallback(() => {
    if (!hasFiles) {
      logMessage('error', 'Upload at least one CSV file before executing.', 'EXECUTION');
      return;
    }
    if (operationCount === 0) {
      logMessage('error', 'Workflow is empty — add operations first.', 'EXECUTION');
      return;
    }
    void executePipeline(uploadedFiles, graph.operationLabels);
  }, [executePipeline, graph.operationLabels, hasFiles, logMessage, operationCount, uploadedFiles]);

  const handleRunAll = useCallback(async () => {
    const files = hasFiles ? uploadedFiles : [createSampleFile()];
    if (!hasFiles) {
      logMessage('info', 'No files uploaded — running with the bundled sample dataset.', 'EXECUTION');
    }

    // Build the canonical full pipeline on the canvas.
    const start = graph.nodes[0];
    const builtNodes: Node[] = [start, ...ALL_OPERATIONS.map((label, index) => ({
      id: String(index + 1),
      position: { x: 100 + (index + 1) * 220, y: 400 },
      data: {
        label,
        phase: OPERATIONS[label]?.phase ?? 'PREP',
        operationId: OPERATIONS[label]?.id ?? label.toLowerCase(),
        order: OPERATIONS[label]?.order ?? index + 1,
      },
      type: 'tealNode' as const,
    }))];

    const sequenceResult = validateSequence(builtNodes);
    if (!sequenceResult.isValid) {
      logMessage('error', `Built pipeline failed validation: ${sequenceResult.errors.join(', ')}`, 'EXECUTION');
      return null;
    }

    graph.replaceGraph(builtNodes, []);
    return executePipeline(files, ALL_OPERATIONS);
  }, [executePipeline, graph, hasFiles, logMessage, uploadedFiles]);

  // ----- output navigation ---------------------------------------------------

  const navigateToOutput = useCallback(
    (results: any) => {
      navigate('/output', {
        state: {
          results,
          outputFiles: results.outputFiles,
          logs: [...consoleLogs, ...(results.logs ?? [])],
          selectedOperations: graph.operationLabels,
        },
      });
    },
    [consoleLogs, graph.operationLabels, navigate],
  );

  const handleViewOutput = useCallback(async () => {
    let active = processedResults;
    if (!active) active = loadCachedResult();
    if (active?.success || active?.tables) {
      navigateToOutput(active);
      return;
    }
    logMessage('info', 'No results yet — running the full pipeline…', 'NAVIGATION');
    const fresh = await handleRunAll();
    if (fresh?.success) navigateToOutput(fresh);
    else logMessage('error', 'Could not generate outputs.', 'NAVIGATION');
  }, [handleRunAll, logMessage, navigateToOutput, processedResults]);

  // ----- snapshot save/load ----------------------------------------------------

  const handleSaveState = useCallback(() => {
    try {
      downloadJson(graph.serializeSnapshot());
      logMessage('success', `Workflow saved (${operationCount} operations)`, 'FILE');
    } catch (error) {
      logMessage('error', `Save failed: ${(error as Error).message}`, 'FILE');
    }
  }, [graph, logMessage, operationCount]);

  const handleLoadState = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = event => graph.loadSnapshot(String(event.target?.result ?? ''));
      reader.onerror = () => logMessage('error', `Could not read ${file.name}`, 'FILE');
      reader.readAsText(file);
    },
    [graph, logMessage],
  );

  // ----- render ----------------------------------------------------------------

  const availableOperations = useMemo(() => ALL_OPERATIONS, []);

  return (
    <div className="nf-shell">
      <header className="nf-header">
        <Heading
          onUndo={graph.undo}
          onRedo={graph.redo}
          canUndo={graph.canUndo}
          canRedo={graph.canRedo}
          onRun={handleRun}
          onRunAll={() => void handleRunAll()}
          onFileUpload={handleFileUpload}
          uploadedFileCount={uploadedFiles.length}
          onViewOutput={() => void handleViewOutput()}
          onSaveState={handleSaveState}
          onLoadState={handleLoadState}
          isRunning={isProcessing}
          isOutputReady={Boolean(processedResults?.success)}
          selectedModel={ollama.selectedModel}
          installedModels={ollama.models}
          ollamaReady={ollama.status === 'online'}
          onModelSelect={ollama.selectModel}
          onRefreshModels={() => void ollama.refresh()}
        />
      </header>

      <aside className="nf-palette" aria-label="Operation palette">
        <OperationPalette activeOperations={graph.operationLabels} onAdd={graph.tryAddOperation} />
      </aside>

      <main className="nf-canvas-panel">
        <div className="nf-canvas">
          <FlowCanvas
            nodes={graph.nodes}
            edges={graph.edges}
            onNodesChange={graph.onNodesChange}
            onEdgesChange={graph.onEdgesChange}
            onConnect={graph.onConnect}
            onDropOperation={label => {
              logMessage('info', `Dropped "${label}" onto canvas`, 'WORKFLOW');
              return graph.tryAddOperation(label);
            }}
          />
        </div>

        <div className="nf-askai">
          <AskAI
            onAddNode={graph.tryAddOperation}
            onAddOperations={graph.addOperationsBatch}
            onLoadState={stateData => graph.loadSnapshot(stateData)}
            currentNodes={graph.nodes}
            availableOperations={availableOperations}
            onLog={(message: string) => logMessage('info', message, 'AI-AGENT')}
            ollamaWrapper={ollama.wrapper}
            selectedModel={ollama.selectedModel}
            ollamaReady={ollama.status === 'online'}
          />
        </div>
      </main>

      <aside className={`nf-console ${consoleOpen ? '' : 'nf-console--closed'}`} aria-label="Console panel">
        <button
          type="button"
          className="nf-console-toggle"
          onClick={() => setConsoleOpen(open => !open)}
          aria-expanded={consoleOpen}
        >
          {consoleOpen ? 'Hide console ›' : '‹ Show console'}
        </button>
        {consoleOpen && (
          <Console
            currentPhase={progress?.phase ?? 'PREP'}
            completedOperations={progress ? [progress.operation] : []}
            activeOperation={progress?.operation ?? ''}
            logs={consoleLogs}
            processedResults={processedResults}
            onExecuteCommand={cmd => logMessage('info', cmd, 'COMMAND')}
            onClearLogs={() => setConsoleLogs([])}
            onPauseLogs={() => logMessage('info', 'Console logging paused', 'CONSOLE')}
            isPaused={false}
            onAddNode={graph.tryAddOperation}
            onRunOperation={handleRun}
            onRunAll={() => void handleRunAll()}
            onUndo={graph.undo}
            onRedo={graph.redo}
            canUndo={graph.canUndo}
            canRedo={graph.canRedo}
            validationResults={validation.validationResults}
            blockedOperations={validation.blockedOperations}
            availableOperations={validation.availableOperations}
            nextRecommended={validation.nextRecommended}
            validateOperation={validation.validateOperation}
            getBlockingReason={validation.getBlockingReason}
            getOperationDependencies={validation.getOperationDependencies}
            canGenerateOutputs={validation.canGenerateOutputs}
            normalizationProgress={validation.normalizationProgress}
            currentNormalForm={progress?.phase ?? null}
            uploadedFile={uploadedFiles[0] || null}
            nodes={graph.nodes}
          />
        )}
      </aside>
    </div>
  );
}

export default function App() {
  // Warm up the native database (best-effort; history is optional).
  useEffect(() => {
    import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('init_database').catch(() => undefined))
      .catch(() => undefined);
  }, []);

  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          <Route
            path="/"
            element={
              <ReactFlowProvider>
                <Workspace />
              </ReactFlowProvider>
            }
          />
          <Route path="/output" element={<OutputPage />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}
