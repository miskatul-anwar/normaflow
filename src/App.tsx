import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import type { Node } from '@xyflow/react';

import { PanelLeftOpen } from 'lucide-react';
import Heading from './components/heading';
import OutputPage from './components/OutputPage';
import { OperationPalette } from './components/workflow/OperationPalette';
import { FlowCanvas } from './components/workflow/FlowCanvas';
import { useNormalization } from './hooks/useNormalization';
import { useNLWorkflow } from './hooks/useNLWorkflow';
import { NLCommandBar } from './components/nl/NLCommandBar';
import { WorkspaceTabBar } from './components/workflow/WorkspaceTabBar';
import { useWorkspaceTabs, type TabStatus } from './hooks/useWorkspaceTabs';
import { activeSurface } from './utils/tabColors';
import { usePaletteResize } from './hooks/usePaletteResize';
import { useWorkflowGraph, type WorkflowSnapshot, buildChainEdges } from './hooks/useWorkflowGraph';
import { Logger } from './services/utils/logger';
import { OPERATIONS } from './config/operations';
import { validateSequence } from './utils/workflowValidation';
import { clearCachedResult, loadCachedResult, saveCachedResult } from './utils/resultCache';
import { ErrorBoundary } from './components/common/ErrorBoundary';
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

interface WorkspaceProps {
  tabId: string;
  /** False while another tab (or the output page) is showing; the workspace stays mounted. */
  active: boolean;
  onStatus: (id: string, status: TabStatus) => void;
  onSuggestTitle: (id: string, title: string) => void;
}

/** One workspace tab: operation palette + full-canvas workflow builder, with its own files, graph and results. */
function Workspace({ tabId, active, onStatus, onSuggestTitle }: WorkspaceProps) {
  const navigate = useNavigate();
  const { fitView } = useReactFlow();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>(() => [createSampleFile()]);
  // The bundled sample is preloaded so Run works immediately; it is not an upload and gets no badge.
  const [usingSample, setUsingSample] = useState(true);
  const [processedResults, setProcessedResults] = useState<any>(() => loadCachedResult(tabId));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { isProcessing, processFiles } = useNormalization();

  // ----- logging & status ----------------------------------------------------

  const logMessage = useCallback((level: LogLevel, message: string, category?: string) => {
    if (level === 'success') logger.success(message, undefined, category);
    else if (level === 'error') logger.error(message, undefined, category);
    else logger.info(level === 'warning' ? `[WARNING] ${message}` : message, undefined, category);

    setStatusMessage(message);
    const timer = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timer);
  }, []);

  // ----- workflow graph ------------------------------------------------------

  const graph = useWorkflowGraph({ log: logMessage });

  // ----- file handling -------------------------------------------------------

  const handleFileUpload = useCallback(
    (files: File[]) => {
      const valid = files.filter(
        f => f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv',
      );
      if (valid.length > 0) {
        setUploadedFiles(valid);
        setUsingSample(false);
        onSuggestTitle(tabId, valid[0].name.replace(/\.[^.]+$/, ''));
        logMessage('success', `Loaded ${valid.length} dataset file(s): ${valid.map(f => f.name).join(', ')}`, 'FILE');
      } else {
        logMessage('error', `No valid CSV files among: ${files.map(f => f.name).join(', ')}`, 'FILE');
      }
    },
    [logMessage, onSuggestTitle, tabId],
  );

  // ----- execution -----------------------------------------------------------

  const executePipeline = useCallback(
    async (files: File[], operations: string[]) => {
      try {
        const result = await processFiles(files, operations);
        if (result?.success) {
          setProcessedResults(result);
          saveCachedResult(result, tabId);
          logMessage('success', `Pipeline completed for ${files.length} table(s)`, 'EXECUTION');
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
      logMessage('error', 'Workflow is empty — add operations from the palette.', 'EXECUTION');
      return;
    }

    const validation = validateSequence(graph.nodes, graph.edges);
    if (!validation.isValid) {
      logMessage('error', `Workflow validation failed: ${validation.errors.join('; ')}`, 'EXECUTION');
      return;
    }
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(w => logMessage('warning', w, 'EXECUTION'));
    }

    void executePipeline(uploadedFiles, graph.operationLabels);
  }, [executePipeline, graph.edges, graph.nodes, graph.operationLabels, hasFiles, logMessage, operationCount, uploadedFiles]);

  const handleRunAll = useCallback(async () => {
    const files = hasFiles ? uploadedFiles : [createSampleFile()];
    if (!hasFiles) {
      logMessage('info', 'Running with bundled sample dataset.', 'EXECUTION');
    }

    // Build the canonical full pipeline on the canvas.
    const start = graph.nodes[0];
    const builtNodes: Node[] = [start, ...ALL_OPERATIONS.map((label, index) => ({
      id: String(index + 1),
      position: { x: 100 + (index + 1) * 300, y: 400 },
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
      logMessage('error', `Pipeline validation failed: ${sequenceResult.errors.join(', ')}`, 'EXECUTION');
      return null;
    }

    // replaceGraph derives the sequential chain edges when none are given.
    graph.replaceGraph(builtNodes, buildChainEdges(builtNodes));
    // Frame the freshly built chain once React Flow has laid it out.
    requestAnimationFrame(() => void fitView({ padding: 0.15, duration: 500 }));
    return executePipeline(files, ALL_OPERATIONS);
  }, [executePipeline, fitView, graph, hasFiles, logMessage, uploadedFiles]);

  // ----- output navigation ---------------------------------------------------

  const navigateToOutput = useCallback(
    (results: any) => {
      navigate('/output', {
        state: {
          results,
          tabId,
          outputFiles: results.outputFiles,
          logs: results.logs ?? [],
          selectedOperations: graph.operationLabels,
        },
      });
    },
    [graph.operationLabels, navigate, tabId],
  );

  const handleViewOutput = useCallback(async () => {
    let active = processedResults;
    if (!active) active = loadCachedResult(tabId);
    if (active?.success || active?.tables) {
      navigateToOutput(active);
      return;
    }
    logMessage('info', 'Synthesizing pipeline to generate output…', 'NAVIGATION');
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

  const nl = useNLWorkflow({ graph, run: handleRun, hasFiles });

  // Report running state and step count to the tab bar.
  useEffect(() => {
    onStatus(tabId, { running: isProcessing, operations: operationCount });
  }, [isProcessing, onStatus, operationCount, tabId]);

  const palette = usePaletteResize();

  return (
    <div
      className={`nf-shell${palette.isCollapsed ? ' is-palette-collapsed' : ''}${palette.isDragging ? ' is-dragging' : ''}`}
      style={{
        ['--nf-palette-width' as string]: palette.isCollapsed ? '0px' : `${palette.width}px`,
      }}
    >
      <header className="nf-header">
        <Heading
          onUndo={graph.undo}
          onRedo={graph.redo}
          canUndo={graph.canUndo}
          canRedo={graph.canRedo}
          onRun={handleRun}
          onRunAll={() => void handleRunAll()}
          onFileUpload={handleFileUpload}
          uploadedFileCount={usingSample ? 0 : uploadedFiles.length}
          usingSample={usingSample}
          onViewOutput={() => void handleViewOutput()}
          onSaveState={handleSaveState}
          onLoadState={handleLoadState}
          isRunning={isProcessing}
          isOutputReady={Boolean(processedResults?.success)}
        />
      </header>

      <aside
        className={`nf-palette${palette.isCollapsed ? ' is-collapsed' : ''}`}
        aria-label="Operation palette"
      >
        <OperationPalette
          activeOperations={graph.placedOperationLabels}
          onAdd={graph.tryAddOperation}
          width={palette.width}
          onCollapse={palette.toggleCollapse}
          onResetWidth={palette.resetWidth}
        />
        <div
          className={`nf-palette-resizer${palette.isDragging ? ' is-active' : ''}`}
          onMouseDown={palette.handleResizeStart}
          onDoubleClick={palette.resetWidth}
          title="Drag to resize sidebar (double-click to reset)"
          role="separator"
          aria-orientation="vertical"
        />
      </aside>

      <main className="nf-canvas-panel">
        {palette.isCollapsed && (
          <button
            type="button"
            className="nf-palette-expand-tab"
            onClick={palette.toggleCollapse}
            onMouseDown={e => palette.handleResizeStart(e, true)}
            title="Expand operations sidebar (click or drag to expand)"
            aria-label="Expand operations sidebar"
          >
            <PanelLeftOpen size={15} />
            <span>Operations</span>
          </button>
        )}

        <NLCommandBar nl={nl} active={active} />

        <div className="nf-canvas">
          <FlowCanvas
            flowId={tabId}
            nodes={graph.nodes}
            edges={graph.edges}
            onNodesChange={graph.onNodesChange}
            onEdgesChange={graph.onEdgesChange}
            onConnect={graph.onConnect}
            onConnectEnd={graph.onConnectEnd}
            isValidConnection={graph.isValidConnection}
          />
        </div>

        {statusMessage && (
          <div className="nf-status-toast">
            <span>{statusMessage}</span>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Hosts every workspace tab. Tabs stay mounted (hidden) while inactive or while the
 * output page is open, so their graphs, files, results and running jobs survive switching.
 */
function AppShell() {
  const location = useLocation();
  const onOutput = location.pathname === '/output';
  const tabsApi = useWorkspaceTabs();
  const { tabs, activeId, status, addTab, closeTab, cycleTab } = tabsApi;

  const requestClose = useCallback(
    (id: string) => {
      const tab = tabs.find(t => t.id === id);
      const ops = status[id]?.operations ?? 0;
      if (tab && ops > 0 && !window.confirm(`Close “${tab.title}”? Its ${ops} pipeline step${ops === 1 ? '' : 's'} and results will be lost.`)) return;
      closeTab(id);
      clearCachedResult(id);
    },
    [closeTab, status, tabs],
  );

  useEffect(() => {
    if (onOutput) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        addTab();
      } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        requestClose(activeId);
      } else if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        cycleTab(e.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, addTab, cycleTab, onOutput, requestClose]);

  return (
    <>
      <div
        className={`nf-app${tabs[0]?.id === activeId ? ' is-first-active' : ''}`}
        hidden={onOutput}
        // The header takes the active tab's surface colour so the two read as one piece.
        style={{ ['--nf-chrome-bg' as string]: activeSurface(tabs.find(t => t.id === activeId)?.color ?? null) }}
      >
        <WorkspaceTabBar
          tabs={tabs}
          activeId={activeId}
          status={status}
          onSelect={tabsApi.selectTab}
          onAdd={addTab}
          onClose={requestClose}
          onRename={tabsApi.renameTab}
          onColor={tabsApi.setTabColor}
        />
        {tabs.map(tab => (
          <div key={tab.id} className="nf-tab-pane" role="tabpanel" aria-label={tab.title} hidden={tab.id !== activeId}>
            <ErrorBoundary componentName={`Workspace ${tab.title}`}>
              <ReactFlowProvider>
                <Workspace
                  tabId={tab.id}
                  active={!onOutput && tab.id === activeId}
                  onStatus={tabsApi.setStatus}
                  onSuggestTitle={tabsApi.suggestTitle}
                />
              </ReactFlowProvider>
            </ErrorBoundary>
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={null} />
          <Route path="/output" element={<OutputPage />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary componentName="Application Root">
      <Router>
        <AppShell />
      </Router>
    </ErrorBoundary>
  );
}
