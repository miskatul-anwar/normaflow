import React, { useState, useCallback } from 'react';
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
  Handle,
  Position,
  NodeProps,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  Edge,
  getBezierPath,
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

// Create global logger instance
const logger = new Logger();

// Operation definitions with phases, order, and dependencies
const OPERATIONS = {
  'CSV Data Loader': {
    phase: 'PREP',
    id: 'csv-loader',
    order: 1,
    dependencies: [],
    description: 'Loads CSV data for processing'
  },
  'Data Cleaner': {
    phase: 'PREP',
    id: 'data-cleaner',
    order: 2,
    dependencies: ['CSV Data Loader'],
    description: 'Cleans and preprocesses raw data'
  },
  'Atomicity Checker': {
    phase: 'PREP',
    id: 'atomicity-checker',
    order: 3,
    dependencies: ['Data Cleaner'],
    description: 'Checks data for atomic values'
  },
  'Data Type Profiler': {
    phase: 'PREP',
    id: 'data-profiler',
    order: 4,
    dependencies: ['Atomicity Checker'],
    description: 'Profiles data types and structure'
  },
  'FD Miner': {
    phase: 'ANALYZE',
    id: 'fd-miner',
    order: 5,
    dependencies: ['1NF'],
    description: 'Discovers functional dependencies'
  },
  'Key Discovery': {
    phase: 'ANALYZE',
    id: 'key-discovery',
    order: 6,
    dependencies: ['FD Miner'],
    description: 'Identifies candidate and primary keys'
  },
  'Cardinality Analyzer': {
    phase: 'ANALYZE',
    id: 'cardinality-analyzer',
    order: 7,
    dependencies: ['Key Discovery'],
    description: 'Analyzes relationship cardinalities'
  },
  '1NF': {
    phase: 'NORMAL',
    id: '1nf',
    order: 8,
    dependencies: ['Data Type Profiler'],
    description: 'Applies First Normal Form'
  },
  '2NF': {
    phase: 'NORMAL',
    id: '2nf',
    order: 9,
    dependencies: ['1NF', 'FD Miner'],
    description: 'Applies Second Normal Form'
  },
  '3NF': {
    phase: 'NORMAL',
    id: '3nf',
    order: 10,
    dependencies: ['2NF'],
    description: 'Applies Third Normal Form'
  },
  'Lossless Check': {
    phase: 'NORMAL',
    id: 'lossless-check',
    order: 11,
    dependencies: ['2NF'],
    description: 'Verifies decomposition is lossless'
  },
  'Dependency Preservation': {
    phase: 'NORMAL',
    id: 'dependency-preservation',
    order: 12,
    dependencies: ['2NF', 'FD Miner'],
    description: 'Checks functional dependency preservation'
  },
  'ERD Generator': {
    phase: 'OUTPUT',
    id: 'erd-generator',
    order: 13,
    dependencies: ['Key Discovery'],
    description: 'Generates Entity-Relationship Diagram'
  },
  'Relation Generator': {
    phase: 'OUTPUT',
    id: 'relation-generator',
    order: 14,
    dependencies: ['3NF'],
    description: 'Generates normalized relation schemas'
  },
  'SQL Generator': {
    phase: 'OUTPUT',
    id: 'sql-generator',
    order: 15,
    dependencies: ['Relation Generator'],
    description: 'Generates SQL DDL statements'
  },
  'Report Generator': {
    phase: 'OUTPUT',
    id: 'report-generator',
    order: 16,
    dependencies: ['Lossless Check', 'Dependency Preservation'],
    description: 'Generates comprehensive normalization report'
  },
};

const proOptions = { hideAttribution: true };

// Strict validation function with comprehensive checks
function validateSequence(nodes: Node[]): { isValid: boolean; errors: string[]; warnings: string[] } {
  const result = {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[]
  };

  if (nodes.length <= 1) {
    return result;
  }

  const operationLabels = nodes.slice(1).map(node => node.data.label);
  const operationConfigs = operationLabels.map(label => OPERATIONS[label as keyof typeof OPERATIONS]);

  // Check for undefined operations
  operationConfigs.forEach((config, index) => {
    if (!config) {
      result.isValid = false;
      result.errors.push(`Unknown operation: ${operationLabels[index]}`);
    }
  });

  if (!result.isValid) return result;

  // Check dependencies are met
  for (let i = 0; i < operationLabels.length; i++) {
    const currentOp = operationLabels[i];
    const currentConfig = OPERATIONS[currentOp as keyof typeof OPERATIONS];
    const previousOps = operationLabels.slice(0, i);

    for (const dependency of currentConfig.dependencies) {
      if (!previousOps.includes(dependency)) {
        result.isValid = false;
        result.errors.push(`${currentOp} requires ${dependency} to be executed first`);
      }
    }
  }

  // Check normalization form order
  const nfOperations = ['1NF', '2NF', '3NF'];
  const nfIndices = nfOperations.map(nf => operationLabels.indexOf(nf)).filter(idx => idx !== -1);

  for (let i = 1; i < nfIndices.length; i++) {
    if (nfIndices[i] < nfIndices[i - 1]) {
      result.isValid = false;
      result.errors.push(`Normalization forms must be applied in order: 1NF → 2NF → 3NF`);
      break;
    }
  }

  // Check phase ordering
  const phases = ['PREP', 'ANALYZE', 'NORMAL', 'OUTPUT'];
  let lastPhaseIndex = -1;

  for (const config of operationConfigs) {
    const currentPhaseIndex = phases.indexOf(config.phase);
    if (currentPhaseIndex < lastPhaseIndex) {
      result.warnings.push(`Phase ordering violation: ${config.phase} operation after ${phases[lastPhaseIndex]} phase`);
    }
    lastPhaseIndex = Math.max(lastPhaseIndex, currentPhaseIndex);
  }

  // Specific validation rules
  const fdIndex = operationLabels.indexOf('FD Miner');
  const oneNFIndex = operationLabels.indexOf('1NF');

  if (fdIndex !== -1 && oneNFIndex !== -1 && fdIndex < oneNFIndex) {
    result.isValid = false;
    result.errors.push("FD Miner must come after 1NF normalization");
  }

  // Check for missing essential operations
  if (operationLabels.includes('2NF') && !operationLabels.includes('1NF')) {
    result.isValid = false;
    result.errors.push("2NF requires 1NF to be applied first");
  }

  if (operationLabels.includes('3NF') && !operationLabels.includes('2NF')) {
    result.isValid = false;
    result.errors.push("3NF requires 2NF to be applied first");
  }

  // Check output generation prerequisites
  if (operationLabels.includes('SQL Generator') && !operationLabels.includes('Relation Generator')) {
    result.isValid = false;
    result.errors.push("SQL Generator requires Relation Generator");
  }

  if (operationLabels.includes('Report Generator')) {
    const requiredForReport = ['Lossless Check', 'Dependency Preservation'];
    const missingForReport = requiredForReport.filter(req => !operationLabels.includes(req));
    if (missingForReport.length > 0) {
      result.warnings.push(`Report Generator recommended after: ${missingForReport.join(', ')}`);
    }
  }

  return result;
}

// Custom Bezier Edge Component
function CustomBezierEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: any) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <path
      id={id}
      style={{
        stroke: '#115e59',
        strokeWidth: 1,
        fill: 'none',
        ...style,
      }}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
    />
  );
}

// Simple utility for node style
function getNodeStyle(label: string): React.CSSProperties {
  const L = label.toLowerCase();
  const baseStyle: React.CSSProperties = {
    fontWeight: "bold",
    fontFamily: "'CMU Serif Bold', serif",
    border: "none",
    outline: "none",
    minWidth: 90,
    minHeight: 38,
    padding: "0.5rem 1.5rem",
    boxSizing: "border-box",
  };
  if (L === "start") {
    return {
      ...baseStyle,
      background: "#2dd4bf",
      color: "#134e4a",
    };
  }
  return {
    ...baseStyle,
    background: "#ccfbf1",
    color: "#115e59",
  };
}

// Node color function for MiniMap
function getNodeColor(node: Node): string {
  const label = String(node.data.label).toLowerCase();
  if (label === "start") {
    return "#2dd4bf";
  }
  return "#ccfbf1";
}

// Simple Custom Node Components
function StartNode({ data, isConnectable }: NodeProps) {
  return (
    <div
      style={getNodeStyle(String(data.label))}
      className="rounded-lg flex justify-center items-center relative"
    >
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        style={{
          background: "#134e4a",
          width: 12,
          height: 12,
          border: "2px solid #2dd4bf",
        }}
        isConnectable={isConnectable}
      />
      <span style={{ fontFamily: "'CMU Serif Bold', serif" }}>
        {String(data.label)}
      </span>
    </div>
  );
}

function TealNode({ data, isConnectable }: NodeProps) {
  return (
    <div
      style={getNodeStyle(String(data.label))}
      className="rounded-lg flex justify-center items-center relative"
    >
      <Handle
        type="target"
        position={Position.Left}
        id="t"
        style={{
          background: "#115e59",
          width: 12,
          height: 12,
          border: "2px solid #ccfbf1",
        }}
        isConnectable={isConnectable}
      />
      <span style={{ fontFamily: "'CMU Serif Bold', serif" }}>
        {String(data.label)}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        style={{
          background: "#115e59",
          width: 12,
          height: 12,
          border: "2px solid #ccfbf1",
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
}

// Initial positioning
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

function MainAppContent() {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([initialStartNode]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [id, setId] = useState(1);
  const [redoStack, setRedoStack] = useState<Node[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [processedResults, setProcessedResults] = useState<any>(null);

  const {
    isProcessing,
    progress,
    processFile,
  } = useNormalization();

  // Add validation hook
  const validation = useOperationValidation({
    completedOperations: progress ? [progress.operation] : [],
    currentNormalForm: progress?.phase || null,
    uploadedFile,
    processedResults,
    nodes
  });

  // Enhanced unified logging function - shows ALL logs in both console and toast
  const logMessage = useCallback((
    type: 'info' | 'success' | 'error' | 'warning',
    message: string,
    category?: string
  ) => {
    // Log to internal logger
    if (type === 'info') {
      logger.info(message, undefined, category);
    } else if (type === 'success') {
      logger.success(message, undefined, category);
    } else if (type === 'error') {
      logger.error(message, undefined, category);
    } else if (type === 'warning') {
      logger.info(`[WARNING] ${message}`, undefined, category);
    }

    // Add to console logs
    const timestamp = new Date().toLocaleTimeString();
    const categoryTag = category ? `[${category}]` : '';
    const logEntry = `[${timestamp}] ${categoryTag} ${message}`;
    setConsoleLogs(prev => [...prev, logEntry]);

    // Show in toast - ALL messages
    toast.dismiss();
    toast[type](message, {
      position: "bottom-right",
      style: { fontFamily: "'CMU Serif Roman', serif" },
      duration: type === 'error' ? 6000 : 4000,
    });
  }, []);

  // Enhanced AI Log Handler
  const handleAILog = useCallback((message: string) => {
    logMessage('info', message, 'AI-AGENT');
  }, [logMessage]);

  // Strict validation for adding nodes
  const addNode = useCallback((label: string) => {
    logMessage('info', `Attempting to add operation: ${label}`, 'VALIDATION');

    const operation = OPERATIONS[label as keyof typeof OPERATIONS];
    if (!operation) {
      logMessage('error', `Unknown operation: ${label}`, 'VALIDATION');
      return;
    }

    // Check dependencies
    const currentOperations = nodes.slice(1).map(node => node.data.label);
    const missingDependencies = operation.dependencies.filter(dep => !currentOperations.includes(dep));

    if (missingDependencies.length > 0) {
      logMessage('error', `Cannot add ${label}. Missing dependencies: ${missingDependencies.join(', ')}`, 'VALIDATION');
      return;
    }

    // Check if file is required for PREP operations
    if (operation.phase === 'PREP' && label === 'CSV Data Loader' && !uploadedFile) {
      logMessage('warning', `${label} added, but CSV file should be uploaded first`, 'VALIDATION');
    }

    // Validate with hook
    const validationResult = validation.validateOperation(label);
    if (!validationResult.isValid) {
      logMessage('error', `Validation failed for ${label}: ${validationResult.errors[0]}`, 'VALIDATION');
      return;
    }

    // Test the sequence with the new operation
    const testOperations = [...currentOperations, label];
    const mockNodes = [
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

    // Show warnings if any
    sequenceValidation.warnings.forEach(warning => {
      logMessage('warning', warning, 'VALIDATION');
    });

    setNodes(nds => {
      const newNode: Node = {
        id: `${id}`,
        position: { x: initialX + (nds.length) * nodeSpacing, y: initialY },
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
  }, [id, logMessage, validation, nodes, uploadedFile]);

  // Batch add operations with strict validation
  const addOperationsBatch = useCallback((labels: string[]) => {
    if (!labels || !labels.length) {
      logMessage('warning', 'No operations provided for batch add', 'AI-AGENT');
      return;
    }

    logMessage('info', `AI requesting batch add: ${labels.join(', ')}`, 'AI-AGENT');

    let delay = 0;
    labels.forEach((label, _idx) => {
      setTimeout(() => {
        addNode(label);
      }, delay);
      delay += 500; // Increased delay for better validation
    });
  }, [addNode, logMessage]);

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

  // Undo function with logging
  const handleUndo = useCallback(() => {
    setNodes(nds => {
      if (nds.length <= 1) {
        logMessage('warning', 'Cannot undo: Already at initial state', 'WORKFLOW');
        return nds;
      }
      const removedNode = nds[nds.length - 1];
      setRedoStack(prev => [removedNode, ...prev]);
      setEdges(eds => eds.filter(e => e.target !== removedNode.id));
      logMessage('info', `Removed operation: ${removedNode.data.label}`, 'WORKFLOW');
      return nds.slice(0, nds.length - 1);
    });
  }, [logMessage]);

  // Redo function with logging
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
        logMessage('success', `Restored operation: ${nodeToReadd.data.label}`, 'WORKFLOW');
        return newNodes;
      });
      return rest;
    });
  }, [logMessage]);

  const handleFileUpload = useCallback((file: File) => {
    logMessage('info', `File upload attempt: ${file.name} (${file.type})`, 'FILE');

    const allowedTypes = ["text/csv"];
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv");

    if (allowedTypes.includes(file.type) || isCSV) {
      logMessage('success', `File uploaded successfully: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`, 'FILE');
      setUploadedFile(file);
    } else {
      logMessage('error', `Invalid file type. Please upload a CSV file. Received: ${file.type}`, 'FILE');
      setUploadedFile(null);
    }
  }, [logMessage]);

  // Save State Function with logging
  const handleSaveState = useCallback(() => {
    try {
      logMessage('info', 'Saving workflow state...', 'FILE');

      const stateData = {
        "06062003": true,
        timestamp: new Date().toISOString(),
        nodes: nodes,
        edges: edges,
        nextId: id,
        version: "1.0",
        user: "miskatul-anwar",
        operationCount: nodes.length - 1
      };

      const dataStr = JSON.stringify(stateData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `normaflow-state-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logMessage('success', `State saved: ${stateData.operationCount} operations, ${edges.length} connections`, 'FILE');
    } catch (error) {
      logMessage('error', `Save failed: ${(error as Error).message}`, 'FILE');
    }
  }, [nodes, edges, id, logMessage]);

  // Load State Function with enhanced validation
  const handleLoadState = useCallback((file: File) => {
    logMessage('info', `Loading state from: ${file.name}`, 'FILE');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const stateData = JSON.parse(content);

        // Validation checks
        if (!stateData["06062003"]) {
          logMessage('error', "Invalid state file: Missing validation signature", 'FILE');
          return;
        }

        if (!stateData.nodes || !Array.isArray(stateData.nodes)) {
          logMessage('error', "Invalid state file: Corrupted nodes data", 'FILE');
          return;
        }

        if (!stateData.edges || !Array.isArray(stateData.edges)) {
          logMessage('error', "Invalid state file: Corrupted edges data", 'FILE');
          return;
        }

        // Validate the loaded sequence
        const validation = validateSequence(stateData.nodes);
        if (!validation.isValid) {
          logMessage('error', `Loaded state has validation errors: ${validation.errors.join(', ')}`, 'FILE');
          return;
        }

        validation.warnings.forEach(warning => {
          logMessage('warning', `Loaded state warning: ${warning}`, 'FILE');
        });

        setNodes(stateData.nodes);
        setEdges(stateData.edges);
        setId(stateData.nextId || 1);
        setRedoStack([]);

        logMessage('success', `State loaded: ${stateData.operationCount || stateData.nodes.length - 1} operations from ${stateData.timestamp || 'unknown time'}`, 'FILE');
      } catch (error) {
        logMessage('error', `Load failed: ${(error as Error).message}`, 'FILE');
      }
    };
    reader.readAsText(file);
  }, [logMessage]);

  // AI Load State Function with validation
  const handleLoadStateFromAI = useCallback((stateData: any) => {
    try {
      logMessage('info', 'AI loading workflow state...', 'AI-AGENT');

      if (stateData.nodes && stateData.edges) {
        // Validate the AI-provided state
        const validation = validateSequence(stateData.nodes);
        if (!validation.isValid) {
          logMessage('error', `AI state validation failed: ${validation.errors.join(', ')}`, 'AI-AGENT');
          return;
        }

        validation.warnings.forEach(warning => {
          logMessage('warning', `AI state warning: ${warning}`, 'AI-AGENT');
        });

        setNodes(stateData.nodes);
        setEdges(stateData.edges);
        setId(stateData.nextId || 1);
        setRedoStack([]);
        logMessage('success', `AI loaded complete workflow state: ${stateData.nodes.length - 1} operations`, 'AI-AGENT');
        return;
      }

      if (Array.isArray(stateData)) {
        logMessage('info', `AI requesting sequential operation add: ${stateData.join(' → ')}`, 'AI-AGENT');

        setNodes([initialStartNode]);
        setEdges([]);
        setId(1);
        setRedoStack([]);

        setTimeout(() => {
          stateData.forEach((operation: string, index: number) => {
            setTimeout(() => {
              addNode(operation);
            }, index * 500); // Increased delay for validation
          });
        }, 100);

        logMessage('success', `AI initiated batch loading: ${stateData.length} operations`, 'AI-AGENT');
        return;
      }

      logMessage('error', 'AI provided invalid state data format', 'AI-AGENT');
    } catch (error) {
      logMessage('error', `AI state load failed: ${(error as Error).message}`, 'AI-AGENT');
    }
  }, [logMessage, addNode]);

  // Enhanced run function with strict validation
  const handleRun = useCallback(async () => {
    logMessage('info', 'Initiating workflow execution...', 'EXECUTION');

    if (!uploadedFile) {
      logMessage('error', "No CSV file uploaded. Please upload a file before execution.", 'EXECUTION');
      return;
    }

    if (nodes.length <= 1) {
      logMessage('error', "Empty workflow. Please add operations before execution.", 'EXECUTION');
      return;
    }

    const selectedOperations = nodes.slice(1).map(node => node.data.label) as string[];
    logMessage('info', `Executing workflow: ${selectedOperations.join(' → ')}`, 'EXECUTION');

    // Strict validation
    const sequenceValidation = validateSequence(nodes);
    if (!sequenceValidation.isValid) {
      logMessage('error', `Workflow validation failed: ${sequenceValidation.errors.join(', ')}`, 'EXECUTION');
      return;
    }

    // Show warnings but continue
    sequenceValidation.warnings.forEach(warning => {
      logMessage('warning', `Execution warning: ${warning}`, 'EXECUTION');
    });

    const hookValidation = validation.validateSequence(selectedOperations);
    if (!hookValidation.isValid) {
      logMessage('error', `Hook validation failed: ${hookValidation.errors[0]}`, 'EXECUTION');
      return;
    }

    logMessage('success', 'All validations passed. Starting normalization process...', 'EXECUTION');

    try {
      const result = await processFile(uploadedFile, selectedOperations);
      if (result && result.success) {
        setProcessedResults(result);
        logMessage('success', `Normalization completed successfully! Processed ${selectedOperations.length} operations`, 'EXECUTION');
        logMessage('info', `Generated outputs: ${result.outputFiles?.length || 0} files`, 'EXECUTION');
      } else {
        logMessage('error', `Processing failed: ${result?.error || 'Unknown error'}`, 'EXECUTION');
      }
    } catch (err) {
      logMessage('error', `Fatal execution error: ${(err as Error).message}`, 'EXECUTION');
    }
  }, [nodes, uploadedFile, logMessage, processFile, validation]);

  // Premium "Run All" function with validation
  const handleRunAll = useCallback(async () => {
    logMessage('info', 'PREMIUM: Initiating complete normalization pipeline...', 'EXECUTION');

    if (!uploadedFile) {
      logMessage('error', "No CSV file uploaded for premium processing.", 'EXECUTION');
      return;
    }

    const allOperations = [
      'CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler',
      '1NF', 'FD Miner', 'Key Discovery', 'Cardinality Analyzer',
      '2NF', '3NF', 'Lossless Check', 'Dependency Preservation',
      'ERD Generator', 'Relation Generator', 'SQL Generator', 'Report Generator'
    ];

    logMessage('info', `PREMIUM: Building complete pipeline with ${allOperations.length} operations`, 'EXECUTION');

    setNodes([initialStartNode]);
    setEdges([]);
    setId(1);
    setRedoStack([]);

    const allNodes: Node[] = [initialStartNode];
    const allEdges: Edge[] = [];
    let currentId = 1;

    for (let i = 0; i < allOperations.length; i++) {
      const operation = allOperations[i];
      const operationConfig = OPERATIONS[operation as keyof typeof OPERATIONS];

      const newNode: Node = {
        id: `${currentId}`,
        position: { x: initialX + currentId * nodeSpacing, y: initialY },
        data: {
          label: operation,
          phase: operationConfig?.phase || 'PREP',
          operationId: operationConfig?.id || operation.toLowerCase(),
          order: operationConfig?.order || i + 1
        },
        type: "tealNode",
      };

      allNodes.push(newNode);

      const prevNode = allNodes[allNodes.length - 2];
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
      allEdges.push(newEdge);

      currentId++;
      logMessage('info', `PREMIUM: Added ${operation} to pipeline`, 'EXECUTION');
    }

    setNodes(allNodes);
    setEdges(allEdges);
    setId(currentId);

    // Validate complete pipeline
    const validation = validateSequence(allNodes);
    if (!validation.isValid) {
      logMessage('error', `PREMIUM pipeline validation failed: ${validation.errors.join(', ')}`, 'EXECUTION');
      return;
    }

    validation.warnings.forEach(warning => {
      logMessage('warning', `PREMIUM warning: ${warning}`, 'EXECUTION');
    });

    logMessage('success', 'PREMIUM: Complete pipeline validated and built. Starting execution...', 'EXECUTION');

    try {
      const result = await processFile(uploadedFile, allOperations);
      if (result && result.success) {
        setProcessedResults(result);
        logMessage('success', `PREMIUM: Complete normalization pipeline finished! All ${allOperations.length} operations executed`, 'EXECUTION');
        logMessage('info', `PREMIUM: Generated comprehensive outputs: ${result.outputFiles?.length || 0} files`, 'EXECUTION');
      } else {
        logMessage('error', `PREMIUM processing failed: ${result?.error || 'Unknown error'}`, 'EXECUTION');
      }
    } catch (err) {
      logMessage('error', `PREMIUM processing error: ${(err as Error).message}`, 'EXECUTION');
    }
  }, [uploadedFile, logMessage, processFile]);

  // Navigate to output with logging
  const handleViewOutput = useCallback(() => {
    if (!processedResults || !processedResults.success) {
      logMessage('error', 'No results available. Please run the workflow first!', 'NAVIGATION');
      return;
    }

    logMessage('info', 'Navigating to output page...', 'NAVIGATION');
    navigate('/output', {
      state: {
        results: processedResults,
        outputFiles: processedResults.outputFiles,
        logs: [...consoleLogs, ...(processedResults.logs || [])],
        selectedOperations: nodes.slice(1).map(node => node.data.label)
      }
    });
  }, [processedResults, navigate, consoleLogs, nodes, logMessage]);

  return (
    <div className="bg-gray-200 overflow-hidden h-screen">
      <div className="grid grid-cols-[150px_1fr_480px] grid-rows-[60px_1fr] h-full p-4 gap-4">
        <header className="col-span-3 bg-gray-200 p-2 border-b-2 border-b-gray-300">
          <Heading
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={nodes.length > 1}
            canRedo={redoStack.length > 0}
            onRun={handleRun}
            onRunAll={handleRunAll}
            onFileUpload={handleFileUpload}
            onViewOutput={handleViewOutput}
            onSaveState={handleSaveState}
            onLoadState={handleLoadState}
            isRunning={isProcessing}
            isOutputReady={processedResults?.success || false}
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
              onNodesChange={changes => {
                const updatedNodes = applyNodeChanges(changes, nodes);
                setNodes(updatedNodes);
              }}
              onEdgesChange={changes =>
                setEdges(eds => applyEdgeChanges(changes, eds))
              }
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

          {/* Local AI Component with Ollama */}
          <div className="flex-shrink-0 h-20 border-t border-gray-200 pt-10 px-2 flex items-center justify-center">
            <div className="w-full max-w-4xl">
              <AskAI
                onAddNode={addNode}
                onAddOperations={addOperationsBatch}
                onLoadState={handleLoadStateFromAI}
                currentNodes={nodes}
                availableOperations={Object.keys(OPERATIONS)}
                onLog={handleAILog}
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
            onExecuteCommand={(command) => logMessage('info', `Command executed: ${command}`, 'COMMAND')}
            onClearLogs={() => {
              setConsoleLogs([]);
              logMessage('info', 'Console logs cleared', 'CONSOLE');
            }}
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
            uploadedFile={uploadedFile}
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