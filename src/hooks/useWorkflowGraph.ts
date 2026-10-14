/**
 * useWorkflowGraph — owns the React Flow node/edge state for the pipeline
 * canvas.
 *
 * Design notes:
 * - All state updater functions are **pure**. Logging, id counters and other
 *   side effects happen outside the updaters. The previous implementation
 *   called `setId`/`setEdges`/`logMessage` from inside a `setNodes` updater,
 *   which React StrictMode double-invokes — silently duplicating nodes and
 *   edges in development.
 * - A ref mirrors the latest nodes so edge construction never depends on a
 *   stale closure.
 * - Workflow snapshots are versioned; the legacy magic-key format
 *   (`"06062003": true`) is still accepted on load.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import { OPERATIONS } from '../config/operations';
import { topologicalSortWorkflow, validateSequence } from '../utils/workflowValidation';
import { validateEdgeConnection } from '../utils/edgeRules';
import { ValidationResult } from '../types';

export const START_NODE_ID = '0';
const NODE_SPACING = 300;
const INITIAL_X = 100;
const INITIAL_Y = 400;

export const SNAPSHOT_FORMAT = 'normaflow-workflow';
export const SNAPSHOT_VERSION = 2;

export interface WorkflowSnapshot {
  format?: string;
  version: number;
  timestamp: string;
  nodes: Node[];
  edges: Edge[];
  nextId: number;
  operationCount: number;
}

function createStartNode(): Node {
  return {
    id: START_NODE_ID,
    position: { x: INITIAL_X, y: INITIAL_Y },
    data: { label: 'Start' },
    type: 'startNode',
    draggable: false,
    selectable: false,
  };
}

function createOperationNode(id: string, label: string, index: number): Node {
  const operation = OPERATIONS[label];
  return {
    id,
    position: { x: INITIAL_X + (index + 1) * NODE_SPACING, y: INITIAL_Y },
    data: {
      label,
      phase: operation?.phase ?? 'PREP',
      operationId: operation?.id ?? label.toLowerCase(),
      order: operation?.order ?? index + 1,
    },
    type: 'tealNode',
  };
}

function buildEdge(source: Node, target: Node): Edge {
  return {
    id: `e${source.id}-${target.id}`,
    source: source.id,
    target: target.id,
    sourceHandle: 'b',
    targetHandle: 't',
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#0d9488' },
    style: { strokeWidth: 2.5 },
    type: 'flow',
  };
}

/** Rebuild sequential edges for the full chain (used after batch mutations). */
export function buildChainEdges(nodes: Node[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 1; i < nodes.length; i++) {
    edges.push(buildEdge(nodes[i - 1], nodes[i]));
  }
  return edges;
}

/** Accept both the current and legacy snapshot formats. */
function isSupportedSnapshot(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  if (record.format === SNAPSHOT_FORMAT) return true;
  // Legacy v1 marker.
  return record['06062003'] === true && Array.isArray(record.nodes) && Array.isArray(record.edges);
}

export interface UseWorkflowGraphOptions {
  /** Receives validation errors/warnings and success messages. */
  log?: (level: 'info' | 'success' | 'error' | 'warning', message: string) => void;
}

export function useWorkflowGraph({ log }: UseWorkflowGraphOptions = {}) {
  const [nodes, setNodes] = useState<Node[]>(() => [createStartNode()]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [redoStack, setRedoStack] = useState<Node[]>([]);
  const nextIdRef = useRef(1);
  const lastValidationErrorRef = useRef<string | null>(null);

  // Eager mirrors — mutated synchronously alongside setState so consecutive
  // calls in one tick (e.g. batch adds) always observe fresh state.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const redoStackRef = useRef(redoStack);

  const commitNodes = useCallback((updater: (current: Node[]) => Node[]) => {
    nodesRef.current = updater(nodesRef.current);
    setNodes(nodesRef.current);
  }, []);

  const commitRedoStack = useCallback((next: Node[]) => {
    redoStackRef.current = next;
    setRedoStack(next);
  }, []);

  // Keep mirrors aligned with drag/selection changes flowing through React Flow.
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const getExecutionPlan = useCallback(() => {
    return topologicalSortWorkflow(nodesRef.current, edgesRef.current);
  }, []);

  const operationLabels = useCallback((): string[] => {
    const topo = getExecutionPlan();
    if (topo.hasCycle) {
      return [];
    }
    return topo.operationLabels;
  }, [getExecutionPlan]);

  const validateWorkflow = useCallback((): ValidationResult => {
    return validateSequence(nodesRef.current, edgesRef.current);
  }, []);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof applyNodeChanges>[0]) => setNodes(current => applyNodeChanges(changes, current)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof applyEdgeChanges>[0]) => setEdges(current => applyEdgeChanges(changes, current)),
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const result = validateEdgeConnection(connection, nodesRef.current, edgesRef.current);
      if (!result.isValid) {
        log?.('error', result.error || 'Invalid connection');
        return;
      }

      const nodeMap = new Map<string, Node>(nodesRef.current.map(n => [n.id, n]));
      const sourceNode = nodeMap.get(connection.source || '');
      const targetNode = nodeMap.get(connection.target || '');
      const sourceLabel = String(sourceNode?.data?.label || (connection.source === START_NODE_ID ? 'Start' : connection.source));
      const targetLabel = String(targetNode?.data?.label || (connection.target === START_NODE_ID ? 'Start' : connection.target));

      setEdges(current =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#0d9488' },
            style: { strokeWidth: 2.5 },
            type: 'flow',
          },
          current,
        ),
      );
      log?.('success', `Connected: ${sourceLabel} → ${targetLabel}`);
    },
    [log],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge): boolean => {
      const result = validateEdgeConnection(connection, nodesRef.current, edgesRef.current);
      if (!result.isValid && result.error) {
        lastValidationErrorRef.current = result.error;
      }
      return result.isValid;
    },
    [],
  );

  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, connectionState: any) => {
      if (connectionState?.toNode && connectionState?.isValid === false) {
        if (lastValidationErrorRef.current) {
          log?.('error', lastValidationErrorRef.current);
        }
      }
    },
    [log],
  );

  const placedOperationLabels = useCallback((): string[] => {
    return nodesRef.current
      .filter(n => n.id !== START_NODE_ID)
      .map(n => String(n.data?.label || ''));
  }, []);

  /**
   * Append one operation node to canvas WITHOUT automatically creating edges.
   * The user explicitly draws edges between handles according to pipeline rules.
   */
  const tryAddOperation = useCallback(
    (label: string): boolean => {
      const operation = OPERATIONS[label];
      if (!operation) {
        log?.('error', `Unknown operation: ${label}`);
        return false;
      }

      const currentPlaced = placedOperationLabels();
      if (currentPlaced.includes(label)) {
        log?.('warning', `'${label}' is already on the canvas`);
        return false;
      }

      const index = currentPlaced.length;
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = INITIAL_X + (col + 1) * NODE_SPACING;
      const y = INITIAL_Y + row * 130;

      const id = String(nextIdRef.current++);
      const newNode = createOperationNode(id, label, index);
      newNode.position = { x, y };

      commitNodes(current => [...current, newNode]);
      commitRedoStack([]);

      // Intentionally do NOT auto-generate edges: user wires nodes manually.
      log?.('info', `Added '${label}' to canvas. Connect handles to wire it into the pipeline.`);
      return true;
    },
    [log, placedOperationLabels, commitNodes, commitRedoStack],
  );

  /** Append multiple operations, skipping duplicates/unknowns. */
  const addOperationsBatch = useCallback(
    (labels: string[]): void => {
      if (!labels?.length) {
        log?.('warning', 'No operations provided');
        return;
      }
      for (const label of labels) {
        if (OPERATIONS[label]) {
          tryAddOperation(label);
        } else if (label?.trim()) {
          log?.('warning', `Skipping unknown operation: ${label}`);
        }
      }
    },
    [tryAddOperation, log],
  );

  const undo = useCallback(() => {
    const current = nodesRef.current;
    if (current.length <= 1) {
      log?.('warning', 'Cannot undo: already at initial state');
      return;
    }
    const removed = current[current.length - 1];
    commitNodes(currentNodes => currentNodes.slice(0, -1));
    setEdges(current => current.filter(edge => edge.target !== removed.id && edge.source !== removed.id));
    commitRedoStack([removed, ...redoStackRef.current]);
    log?.('info', `Removed operation: ${removed.data?.label}`);
  }, [commitNodes, commitRedoStack, log]);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) {
      log?.('warning', 'Cannot redo: nothing to restore');
      return;
    }
    const [node, ...rest] = stack;

    const current = nodesRef.current;
    const reattached: Node = {
      ...node,
      position: { x: INITIAL_X + current.length * NODE_SPACING, y: INITIAL_Y },
    };
    commitNodes(currentNodes => [...currentNodes, reattached]);
    commitRedoStack(rest);
    log?.('success', `Restored operation: ${node.data?.label}`);
  }, [commitNodes, commitRedoStack, log]);

  const clearGraph = useCallback(() => {
    commitNodes(() => [createStartNode()]);
    setEdges([]);
    commitRedoStack([]);
    nextIdRef.current = 1;
  }, [commitNodes, commitRedoStack]);

  const replaceGraph = useCallback((nextNodes: Node[], nextEdges?: Edge[], nextId?: number) => {
    const normalized = nextNodes.length > 0 ? nextNodes : [createStartNode()];
    nodesRef.current = normalized;
    setNodes(normalized);
    setEdges(nextEdges ?? []);
    nextIdRef.current = nextId ?? Math.max(normalized.length + 1, 1);
    commitRedoStack([]);
  }, [commitRedoStack]);

  const serializeSnapshot = useCallback((): WorkflowSnapshot => {
    const current = nodesRef.current;
    return {
      format: SNAPSHOT_FORMAT,
      version: SNAPSHOT_VERSION,
      timestamp: new Date().toISOString(),
      nodes: current,
      edges,
      nextId: nextIdRef.current,
      operationCount: Math.max(0, current.length - 1),
    };
  }, [edges]);

  const loadSnapshot = useCallback(
    (raw: string | object): boolean => {
      try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!isSupportedSnapshot(data)) {
          log?.('error', 'Invalid workflow file format');
          return false;
        }
        const incoming = data as Record<string, unknown>;
        const loadedNodes = incoming.nodes as Node[];
        const loadedEdges = (incoming.edges as Edge[]) ?? [];

        const seq = validateSequence(loadedNodes);
        if (!seq.isValid) {
          log?.('error', `Workflow file has invalid sequence: ${seq.errors.join(', ')}`);
          return false;
        }

        replaceGraph(loadedNodes, loadedEdges, Number(incoming.nextId) || loadedNodes.length + 1);
        log?.('success', `Loaded workflow with ${Math.max(0, loadedNodes.length - 1)} operation(s)`);
        return true;
      } catch (error) {
        log?.('error', `Load failed: ${(error as Error).message}`);
        return false;
      }
    },
    [log, replaceGraph],
  );

  return {
    nodes,
    edges,
    canUndo: nodes.length > 1,
    canRedo: redoStack.length > 0,
    operationLabels: operationLabels(),
    placedOperationLabels: placedOperationLabels(),
    validateWorkflow,
    getExecutionPlan,
    tryAddOperation,
    addOperationsBatch,
    undo,
    redo,
    clearGraph,
    replaceGraph,
    serializeSnapshot,
    loadSnapshot,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onConnectEnd,
    isValidConnection,
  };
}
