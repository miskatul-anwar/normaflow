import { motion, AnimatePresence } from "framer-motion";
import { Download, Terminal, Play, Pause, Trash2, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { FaRegCopy, FaScroll, FaTerminal } from "react-icons/fa";
import { useState, useRef, useEffect } from "react";
import { BsTerminal } from "react-icons/bs";
import { ValidationResult } from '../utils/CompatibilityChecker';

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

export default function Console({
    currentPhase = "PREP",
    completedOperations = [],
    activeOperation = "",
    logs = [],
    processedResults = null,
    onExecuteCommand,
    onClearLogs,
    onPauseLogs,
    isPaused = false,
    onAddNode,
    onRunOperation,
    onRunAll,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    blockedOperations = new Set(),
    availableOperations = [],
    nextRecommended = [],
    validateOperation,
    getBlockingReason,
    getOperationDependencies,
    canGenerateOutputs = false,
    normalizationProgress,
    currentNormalForm,
    uploadedFile,
    nodes = []
}: ConsoleProps) {
    const [commandInput, setCommandInput] = useState("");
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isMinimized, setIsMinimized] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState<'all' | 'error' | 'success' | 'warning'>('all');

    const logsEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Available operations for command completion
    const availableOperationsData = [
        'CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler',
        'FD Miner', 'Key Discovery', 'Cardinality Analyzer',
        '1NF', '2NF', '3NF', 'Lossless Check', 'Dependency Preservation',
        'ERD Generator', 'Relation Generator', 'SQL Generator', 'Report Generator'
    ];

    // Available commands
    const availableCommands = [
        'help', 'status', 'clear', 'run', 'run-all', 'pause', 'resume',
        'undo', 'redo', 'add', 'remove', 'list', 'phase', 'export-logs',
        'validate', 'check-dependencies', 'show-requirements', 'normalization-status',
        'next-steps', 'recommend-operations'
    ];

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const executeCommand = (command: string) => {
        const trimmedCommand = command.trim().toLowerCase();
        const parts = trimmedCommand.split(' ');
        const mainCommand = parts[0];
        const args = parts.slice(1);

        // Add command to console logs
        const commandLog = `$ ${command}`;
        if (onExecuteCommand) {
            onExecuteCommand(commandLog);
        }

        switch (mainCommand) {
            case 'help':
                const helpText = [
                    'Available Commands:',
                    '',
                    'Operation Commands:',
                    '  add <operation>     - Add operation to workflow',
                    '  run                 - Execute current workflow',
                    '  run-all             - Execute complete pipeline',
                    '  undo                - Remove last operation',
                    '  redo                - Restore last undone operation',
                    '',
                    'Validation Commands:',
                    '  validate [operation] - Check operation validity',
                    '  check-dependencies <op> - Show operation dependencies',
                    '  show-requirements <op>  - Show detailed requirements',
                    '  normalization-status    - Show current NF progress',
                    '  next-steps             - Show recommended operations',
                    '',
                    'Status Commands:',
                    '  status              - Show current status',
                    '  phase               - Show current phase',
                    '  list                - List all operations',
                    '',
                    'Control Commands:',
                    '  clear               - Clear console logs',
                    '  pause               - Pause log updates',
                    '  resume              - Resume log updates',
                    '  export-logs         - Download console logs',
                    '',
                    'Examples:',
                    '  add "CSV Data Loader"',
                    '  validate "ERD Generator"',
                    '  check-dependencies "2NF"',
                    '  run'
                ];
                helpText.forEach(line => {
                    if (onExecuteCommand) onExecuteCommand(line);
                });
                break;

            case 'validate':
                if (args.length === 0) {
                    if (onExecuteCommand) onExecuteCommand('Validation Status:');

                    availableOperations.forEach(op => {
                        if (onExecuteCommand) onExecuteCommand(`✓ ${op} - Ready to execute`);
                    });

                    Array.from(blockedOperations).forEach(op => {
                        const reason = getBlockingReason ? getBlockingReason(op) : { errors: ['Unknown error'] };
                        if (onExecuteCommand) onExecuteCommand(`✗ ${op} - Blocked: ${reason.errors[0]}`);
                    });
                } else {
                    const operationName = args.join(' ');
                    const validation = validateOperation ? validateOperation(operationName) : { isValid: false, errors: ['Validation unavailable'], recommendations: [], missingOperations: [] };

                    if (validation.isValid) {
                        if (onExecuteCommand) onExecuteCommand(`✓ ${operationName} is ready to execute`);
                    } else {
                        if (onExecuteCommand) onExecuteCommand(`✗ ${operationName} is blocked:`);
                        validation.errors.forEach(error => {
                            if (onExecuteCommand) onExecuteCommand(`   • ${error}`);
                        });
                        if (validation.recommendations.length > 0) {
                            if (onExecuteCommand) onExecuteCommand(`Recommendations:`);
                            validation.recommendations.forEach(rec => {
                                if (onExecuteCommand) onExecuteCommand(`   • ${rec}`);
                            });
                        }
                    }
                }
                break;

            case 'check-dependencies':
                if (args.length === 0) {
                    if (onExecuteCommand) onExecuteCommand('Usage: check-dependencies <operation_name>');
                } else {
                    const operationName = args.join(' ');
                    const deps = getOperationDependencies ? getOperationDependencies(operationName) : [];

                    if (deps.length === 0) {
                        if (onExecuteCommand) onExecuteCommand(`✓ ${operationName} has no dependencies`);
                    } else {
                        if (onExecuteCommand) onExecuteCommand(`Dependencies for ${operationName}:`);
                        deps.forEach(dep => {
                            const nodeOperations = nodes?.slice(1).map(node => node.data.label) || [];
                            const isCompleted = nodeOperations.includes(dep);
                            const status = isCompleted ? '✓' : '✗';
                            if (onExecuteCommand) onExecuteCommand(`   ${status} ${dep}`);
                        });
                    }
                }
                break;

            case 'show-requirements':
                if (args.length === 0) {
                    if (onExecuteCommand) onExecuteCommand('Usage: show-requirements <operation_name>');
                } else {
                    const operationName = args.join(' ');
                    const validation = validateOperation ? validateOperation(operationName) : {
                        isValid: false,
                        errors: ['Validation unavailable'],
                        recommendations: [],
                        missingOperations: [],
                        requiredNormalForm: undefined
                    };

                    if (onExecuteCommand) onExecuteCommand(`Requirements for ${operationName}:`);

                    if (validation.requiredNormalForm) {
                        const hasNF = currentNormalForm === validation.requiredNormalForm ||
                            (validation.requiredNormalForm === '1NF' && (currentNormalForm === '2NF' || currentNormalForm === '3NF')) ||
                            (validation.requiredNormalForm === '2NF' && currentNormalForm === '3NF');
                        const nfStatus = hasNF ? '✓' : '✗';
                        if (onExecuteCommand) onExecuteCommand(`   ${nfStatus} Normalization: ${validation.requiredNormalForm} (Current: ${currentNormalForm || 'None'})`);
                    }

                    if (validation.missingOperations.length > 0) {
                        if (onExecuteCommand) onExecuteCommand(`   ✗ Missing operations:`);
                        validation.missingOperations.forEach(op => {
                            if (onExecuteCommand) onExecuteCommand(`      • ${op}`);
                        });
                    }

                    if (validation.isValid) {
                        if (onExecuteCommand) onExecuteCommand(`   ✓ All requirements satisfied`);
                    }
                }
                break;

            case 'normalization-status':
                if (onExecuteCommand) onExecuteCommand(`Normalization Status:`);
                if (onExecuteCommand) onExecuteCommand(`   Current Form: ${currentNormalForm || 'None'}`);
                if (normalizationProgress) {
                    if (onExecuteCommand) onExecuteCommand(`   Progress: ${normalizationProgress.progress}/${normalizationProgress.total} (${normalizationProgress.percentage.toFixed(1)}%)`);

                    if (normalizationProgress.canProceed && normalizationProgress.nextNF) {
                        if (onExecuteCommand) onExecuteCommand(`   Next Step: ${normalizationProgress.nextNF}`);
                    } else if (normalizationProgress.progress === 3) {
                        if (onExecuteCommand) onExecuteCommand(`   Complete! You can now generate all outputs.`);
                    }
                }
                break;

            case 'next-steps':
                if (nextRecommended.length === 0) {
                    if (onExecuteCommand) onExecuteCommand(`No operations currently available. Check requirements with 'validate'.`);
                } else {
                    if (onExecuteCommand) onExecuteCommand(`Recommended next operations:`);
                    nextRecommended.slice(0, 3).forEach((op, index) => {
                        if (onExecuteCommand) onExecuteCommand(`   ${index + 1}. ${op}`);
                    });
                }
                break;

            case 'recommend-operations':
                if (onExecuteCommand) onExecuteCommand(`Smart Recommendations:`);

                if (!currentNormalForm) {
                    if (onExecuteCommand) onExecuteCommand(`   Start with: CSV Data Loader → Data Cleaner → Atomicity Checker → 1NF`);
                } else if (currentNormalForm === '1NF') {
                    if (onExecuteCommand) onExecuteCommand(`   Continue with: FD Miner → Key Discovery → 2NF`);
                } else if (currentNormalForm === '2NF') {
                    if (onExecuteCommand) onExecuteCommand(`   Complete normalization: 3NF`);
                    if (onExecuteCommand) onExecuteCommand(`   Or generate intermediate outputs: Relation Generator, Report Generator`);
                } else if (currentNormalForm === '3NF') {
                    if (onExecuteCommand) onExecuteCommand(`   Generate final outputs: ERD Generator, SQL Generator`);
                }

                if (canGenerateOutputs) {
                    if (onExecuteCommand) onExecuteCommand(`   Available outputs: ${availableOperations.filter(op =>
                        ['ERD Generator', 'SQL Generator', 'Relation Generator', 'Report Generator'].includes(op)
                    ).join(', ')}`);
                }
                break;

            case 'status':
                const statusInfo = [
                    `Current Status:`,
                    `Phase: ${currentPhase}`,
                    `Active Operation: ${activeOperation || 'None'}`,
                    `Completed Operations: ${completedOperations.length}/16`,
                    `Logs: ${logs.length} entries`,
                    `Console State: ${isPaused ? 'Paused' : 'Live'}`,
                    `File: ${uploadedFile ? uploadedFile.name : 'None uploaded'}`
                ];
                statusInfo.forEach(line => {
                    if (onExecuteCommand) onExecuteCommand(line);
                });
                break;

            case 'clear':
                if (onClearLogs) {
                    onClearLogs();
                    if (onExecuteCommand) onExecuteCommand('Console cleared');
                }
                break;

            case 'run':
                if (onRunOperation) {
                    onRunOperation();
                    if (onExecuteCommand) onExecuteCommand('Starting workflow execution...');
                } else {
                    if (onExecuteCommand) onExecuteCommand('Run function not available');
                }
                break;

            case 'run-all':
                if (onRunAll) {
                    onRunAll();
                    if (onExecuteCommand) onExecuteCommand('Starting complete pipeline execution...');
                } else {
                    if (onExecuteCommand) onExecuteCommand('Run-all function not available');
                }
                break;

            case 'pause':
                if (onPauseLogs) {
                    onPauseLogs();
                    if (onExecuteCommand) onExecuteCommand('Console logging paused');
                }
                break;

            case 'resume':
                if (onPauseLogs && isPaused) {
                    onPauseLogs();
                    if (onExecuteCommand) onExecuteCommand('Console logging resumed');
                }
                break;

            case 'undo':
                if (onUndo && canUndo) {
                    onUndo();
                    if (onExecuteCommand) onExecuteCommand('Last operation undone');
                } else {
                    if (onExecuteCommand) onExecuteCommand('Nothing to undo');
                }
                break;

            case 'redo':
                if (onRedo && canRedo) {
                    onRedo();
                    if (onExecuteCommand) onExecuteCommand('Operation redone');
                } else {
                    if (onExecuteCommand) onExecuteCommand('Nothing to redo');
                }
                break;

            case 'add':
                if (args.length === 0) {
                    if (onExecuteCommand) onExecuteCommand('Usage: add <operation_name>');
                    if (onExecuteCommand) onExecuteCommand('Available operations: ' + availableOperationsData.join(', '));
                } else {
                    const operationName = args.join(' ');
                    const matchedOperation = availableOperationsData.find(op =>
                        op.toLowerCase().includes(operationName.toLowerCase()) ||
                        operationName.toLowerCase().includes(op.toLowerCase())
                    );

                    if (matchedOperation) {
                        if (onAddNode) {
                            onAddNode(matchedOperation);
                            if (onExecuteCommand) onExecuteCommand(`Added operation: ${matchedOperation}`);
                        }
                    } else {
                        if (onExecuteCommand) onExecuteCommand(`Unknown operation: ${operationName}`);
                        if (onExecuteCommand) onExecuteCommand('Available operations: ' + availableOperationsData.join(', '));
                    }
                }
                break;

            case 'list':
                if (onExecuteCommand) onExecuteCommand('Available Operations:');
                availableOperationsData.forEach((op, index) => {
                    if (onExecuteCommand) onExecuteCommand(`  ${index + 1}. ${op}`);
                });
                break;

            case 'phase':
                if (onExecuteCommand) onExecuteCommand(`Current Phase: ${currentPhase}`);
                break;

            case 'export-logs':
                downloadLogs();
                if (onExecuteCommand) onExecuteCommand('Logs exported to file');
                break;

            default:
                if (onExecuteCommand) onExecuteCommand(`Unknown command: ${mainCommand}`);
                if (onExecuteCommand) onExecuteCommand('Type "help" for available commands');
                break;
        }
    };

    const handleCommandSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commandInput.trim()) return;

        const newHistory = [...commandHistory, commandInput];
        setCommandHistory(newHistory);
        setHistoryIndex(-1);

        executeCommand(commandInput);
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
            case 'success': return 'text-green-300';
            case 'error': return 'text-red-400';
            case 'warning': return 'text-orange-400';
            default: return 'text-green-400';
        }
    };

    const filteredLogs = logs
        .map(log => log.replace(/\[.*?\]/g, '').trim())
        .filter(log => {
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
        <motion.div
            className="bg-gray-900 rounded-xl border border-gray-700 shadow-2xl overflow-hidden"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Console Header - Row 1 */}
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300 ">
                        <Terminal className="w-4 h-4" />
                        <span className="text-sm font-medium">Console</span>
                        <div className="text-xs bg-gray-700 px-2 py-1 rounded">
                            Phase: {currentPhase}
                        </div>
                    </div>
                </div>
            </div>

            {/* Console Header - Row 2 (Controls) */}
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 mr-2">Log Controls:</span>

                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded border border-gray-600"
                        aria-label="Filter logs"
                        title="Filter logs"
                    >
                        <option value="all">All</option>
                        <option value="error">Errors</option>
                        <option value="warning">Warnings</option>
                        <option value="success">Success</option>
                    </select>

                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`p-1 px-2 rounded text-xs ${autoScroll ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                        title="Auto-scroll"
                    >
                        <FaScroll className="inline-block ml-1 w-3 h-3" />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onPauseLogs}
                        className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                        title={isPaused ? "Resume" : "Pause"}
                    >
                        {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    </button>

                    <button
                        onClick={copyLogsToClipboard}
                        className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                        title="Copy logs"
                    >
                        <Copy className="w-3 h-3" />
                    </button>

                    <button
                        onClick={downloadLogs}
                        className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                        title="Download logs"
                    >
                        <Download className="w-3 h-3" />
                    </button>

                    <button
                        onClick={onClearLogs}
                        className="p-1 rounded bg-gray-700 text-red-400 hover:bg-gray-600"
                        title="Clear logs"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                    >
                        {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Status Bar */}
                    <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4">
                            <span className="text-gray-400">
                                Progress: {completedOperations.length}/16
                            </span>
                            {activeOperation && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                    <span className="text-blue-400">Running: {activeOperation}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-4 text-gray-400">
                            <span>Lines: {filteredLogs.length}</span>
                            <span>{isPaused ? "Paused" : "Live"}</span>
                        </div>
                    </div>

                    {/* Logs Display */}
                    <div className="bg-black p-4 h-85 overflow-y-auto text-xs leading-relaxed">
                        <AnimatePresence>
                            {filteredLogs.length === 0 ? (
                                <div className="text-gray-500 text-center py-8 text-2xl">
                                    <div className="flex justify-center mb-2">
                                        <BsTerminal className="mb-2 w-6 h-6 text-gray-400" />
                                    </div>
                                    Console ready.<br /> Type "help" for available commands.
                                </div>
                            ) : (
                                filteredLogs.map((log, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`mb-1 ${getLogColor(log)} hover:bg-gray-900 px-2 py-0.5 rounded group`}
                                    >
                                        <span className="text-gray-500 text-[10px] mr-2">
                                            [{new Date().toLocaleTimeString()}]
                                        </span>
                                        <span className="font-mono">{log}</span>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(log)}
                                            className="ml-2 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-400"
                                        >
                                            <FaRegCopy className="inline-block w-3 h-3" />
                                        </button>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                        <div ref={logsEndRef} />
                    </div>

                    {/* Command Input */}
                    <div className="bg-gray-800 border-t border-gray-700 p-3">
                        <form onSubmit={handleCommandSubmit} className="flex items-center gap-2">
                            <span className="text-green-400 font-bold">$</span>
                            <input
                                ref={inputRef}
                                type="text"
                                value={commandInput}
                                onChange={(e) => setCommandInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter command"
                                className="flex-1 bg-transparent text-green-400 placeholder-gray-500 outline-none font-mono"
                                autoComplete="off"
                            />
                            <button
                                type="submit"
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium"
                            >
                                <FaTerminal className="inline mr-1" />
                                Execute
                            </button>
                        </form>

                        {commandHistory.length > 0 && (
                            <div className="mt-2 text-[10px] text-gray-500">
                                History: Use ↑/↓ arrows to navigate • Tab for auto-complete • ({commandHistory.length} commands)
                            </div>
                        )}
                    </div>

                    {/* Results Panel */}
                    {processedResults && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-gray-800 border-t border-gray-700 p-4"
                        >
                            <div className="text-xs text-gray-400 mb-2">Processed Results:</div>
                            <div className="bg-black rounded p-3 text-xs text-green-400 max-h-32 overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4 text-[10px]">
                                    <div>
                                        <div className="text-blue-400 font-semibold mb-1">Statistics:</div>
                                        <div>Duration: {processedResults.duration}</div>
                                        <div>Files: {processedResults.outputFiles?.length || 0}</div>
                                        <div>Relations: {processedResults.stats?.relations3NF || 0}</div>
                                    </div>
                                    <div>
                                        <div className="text-yellow-400 font-semibold mb-1">Dependencies:</div>
                                        <div>FDs: {processedResults.stats?.functionalDependencies || 0}</div>
                                        <div>Keys: {processedResults.stats?.candidateKeys || 0}</div>
                                        <div>Status: {processedResults.success ? 'Success' : 'Failed'}</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </>
            )}
        </motion.div>
    );
}