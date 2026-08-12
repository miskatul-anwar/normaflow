import { useState, useRef, useEffect } from "react";
import { Download, Terminal, Trash2, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { ValidationResult } from '../types';
import { executeConsoleCommand } from '../utils/consoleCommands';

interface ConsoleProps {
  currentPhase?: string;
  completedOperations?: string[];
  activeOperation?: string;
  logs?: string[];
  processedResults?: any;
  onExecuteCommand?: (command: string) => void;
  onClearLogs?: () => void;
  onPauseLogs?: () => void;
  isPaused?: boolean;
  onAddNode?: (label: string) => void;
  onRunOperation?: () => void;
  onRunAll?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  validationResults?: Map<string, ValidationResult>;
  blockedOperations?: Set<string>;
  availableOperations?: string[];
  nextRecommended?: string[];
  validateOperation?: (operation: string) => ValidationResult;
  getBlockingReason?: (operation: string) => ValidationResult;
  getOperationDependencies?: (operation: string) => string[];
  canGenerateOutputs?: boolean;
  normalizationProgress?: any;
  currentNormalForm?: string | null;
  uploadedFile?: File | null;
  nodes?: any[];
}

export default function Console(props: ConsoleProps) {
  const {
    currentPhase = "PREP",
    completedOperations = [],
    activeOperation = "",
    logs = [],
    onExecuteCommand,
    onClearLogs,
    onPauseLogs,
    isPaused = false,
    onAddNode,
    onRunOperation,
    onRunAll,
    onUndo,
    onRedo,
    blockedOperations = new Set(),
    availableOperations = [],
    validateOperation,
    getBlockingReason,
    getOperationDependencies,
    currentNormalForm,
    normalizationProgress,
    nodes = []
  } = props;

  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isMinimized, setIsMinimized] = useState(false);
  const [filter, setFilter] = useState<'all' | 'error' | 'success' | 'warning'>('all');

  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableCommands = [
    'help', 'status', 'clear', 'run', 'run-all', 'pause', 'resume',
    'undo', 'redo', 'add', 'list', 'phase', 'export-logs',
    'validate', 'check-dependencies'
  ];

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [logs]);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    setCommandHistory(prev => [...prev, commandInput]);
    setHistoryIndex(-1);

    executeConsoleCommand(commandInput, {
      onExecuteCommand,
      onAddNode,
      onRunOperation,
      onRunAll,
      onUndo,
      onRedo,
      onClearLogs,
      onPauseLogs,
      availableOperations,
      blockedOperations,
      validateOperation,
      getBlockingReason,
      getOperationDependencies,
      currentNormalForm,
      normalizationProgress,
      nodes,
      currentPhase,
      completedOperations,
      logs
    });

    setCommandInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput("");
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const input = commandInput.toLowerCase();
      const matches = availableCommands.filter(cmd => cmd.startsWith(input));
      if (matches.length === 1) {
        setCommandInput(matches[0]);
      } else if (matches.length > 1 && onExecuteCommand) {
        onExecuteCommand(`Possible completions: ${matches.join(', ')}`);
      }
    }
  };

  const getLogType = (log: string) => {
    if (log.includes('✓') || log.includes('SUCCESS') || log.includes('completed successfully') || log.includes('Added operation')) return 'success';
    if (log.includes('✗') || log.includes('Cannot add') || log.includes('Please upload') || log.includes('ERROR') || log.includes('Failed')) return 'error';
    if (log.includes('Warning') || log.includes('Recommendation') || log.includes('should come')) return 'warning';
    return 'info';
  };

  const getLogColor = (log: string) => {
    const type = getLogType(log);
    switch (type) {
      case 'success': return 'text-emerald-300';
      case 'error': return 'text-rose-400';
      case 'warning': return 'text-amber-400';
      default: return 'text-teal-300';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return getLogType(log) === filter;
  });

  const copyLogsToClipboard = () => {
    navigator.clipboard.writeText(logs.join('\n'));
  };

  const downloadLogs = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `normaflow-console-logs-${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      className="bg-gray-950 rounded-xl border border-gray-800 shadow-xl overflow-hidden flex flex-col h-full font-mono text-xs"
      aria-label="Console Diagnostics"
    >
      <header className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button type="button" className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-1 focus:ring-red-400" onClick={onClearLogs} title="Clear Logs" aria-label="Clear Logs" />
            <button type="button" className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-1 focus:ring-yellow-400" onClick={onPauseLogs} title={isPaused ? "Resume Logs" : "Pause Logs"} aria-label="Pause Logs" />
            <button type="button" className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-1 focus:ring-green-400" onClick={() => setIsMinimized(!isMinimized)} title="Toggle Console View" aria-label="Toggle Console View" />
          </div>

          <div className="h-4 w-px bg-gray-800" />

          <div className="flex items-center gap-2 text-gray-200 font-semibold text-xs">
            <Terminal className="w-4 h-4 text-teal-400" />
            <span>Console & Diagnostics</span>
          </div>

          {activeOperation && (
            <span className="bg-teal-950 text-teal-300 text-[11px] px-2 py-0.5 rounded border border-teal-700 animate-pulse">
              Executing: {activeOperation}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-950 p-0.5 rounded border border-gray-800 text-[11px]">
            {(['all', 'error', 'warning', 'success'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-teal-400 ${
                  filter === f ? 'bg-gray-800 text-teal-300 font-semibold' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={copyLogsToClipboard}
            className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-400"
            title="Copy Logs"
            aria-label="Copy Logs"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={downloadLogs}
            className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-400"
            title="Export Logs"
            aria-label="Export Logs"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClearLogs}
            className="p-1.5 text-gray-400 hover:text-rose-400 rounded hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-400"
            title="Clear Logs"
            aria-label="Clear Logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-400"
            title="Toggle Console"
            aria-label="Toggle Console"
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {!isMinimized && (
        <>
          <div className="flex-1 p-3 overflow-y-auto space-y-1 text-[11px] leading-relaxed select-text">
            {filteredLogs.length === 0 ? (
              <div className="text-gray-600 italic py-4 text-center">
                Console ready. Run workflow operations or enter commands.
              </div>
            ) : (
              filteredLogs.map((log, idx) => (
                <div key={idx} className={`${getLogColor(log)} font-mono`}>
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          <form onSubmit={handleCommandSubmit} className="bg-gray-900 px-3 py-1.5 border-t border-gray-800 flex items-center gap-2 flex-shrink-0">
            <span className="text-teal-400 font-bold">$</span>
            <input
              ref={inputRef}
              type="text"
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type command (e.g. 'help', 'add 1NF', 'run-all')..."
              className="flex-1 bg-transparent text-gray-100 text-[11px] font-mono focus:outline-none placeholder-gray-600"
              aria-label="Console command input"
            />
          </form>
        </>
      )}
    </section>
  );
}