import type { Edge, Node } from '@xyflow/react';
import { OPERATIONS } from '../config/operations';
import { ValidationResult } from '../types';

export const START_NODE_ID = '0';

export interface TopologicalSortResult {
  sortedNodes: Node[];
  sortedLabels: string[];
  operationLabels: string[];
  hasCycle: boolean;
  cycleNodes?: string[];
  cycleNodeLabels: string[];
  unreachableNodeLabels: string[];
  errors: string[];
  errorMessage?: string;
}

/**
 * Topologically sort React Flow workflow nodes based on edge dependencies
 * using Kahn's algorithm with deterministic tie-breaking and cycle detection.
 */
export function topologicalSortWorkflow(
  nodes: Node[],
  edges: Edge[] = [],
  startNodeId = START_NODE_ID
): TopologicalSortResult {
  const operationNodes = (nodes || []).filter(n => n.id !== startNodeId);

  if (!nodes || nodes.length === 0 || operationNodes.length === 0) {
    return {
      sortedNodes: [],
      sortedLabels: [],
      operationLabels: [],
      hasCycle: false,
      cycleNodes: [],
      cycleNodeLabels: [],
      unreachableNodeLabels: [],
      errors: [],
    };
  }

  // If no edges provided, fall back to node array order
  if (!edges || edges.length === 0) {
    const labels = operationNodes.map(n => String(n.data?.label ?? ''));
    return {
      sortedNodes: operationNodes,
      sortedLabels: labels,
      operationLabels: labels,
      hasCycle: false,
      cycleNodes: [],
      cycleNodeLabels: [],
      unreachableNodeLabels: [],
      errors: [],
    };
  }

  const nodeMap = new Map<string, Node>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // Filter edges to only those connecting existing nodes
  const validEdges = edges.filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));

  // Check for direct self-loops
  const selfLoopEdge = validEdges.find(e => e.source === e.target);
  if (selfLoopEdge) {
    const loopNode = nodeMap.get(selfLoopEdge.source);
    const label = String(loopNode?.data?.label ?? selfLoopEdge.source);
    const errorMsg = `Cyclic dependency detected: node '${label}' connects to itself`;
    return {
      sortedNodes: [],
      sortedLabels: [],
      operationLabels: [],
      hasCycle: true,
      cycleNodes: [label],
      cycleNodeLabels: [label],
      unreachableNodeLabels: [],
      errors: [errorMsg],
      errorMessage: errorMsg,
    };
  }

  // Build adjacency list and in-degree map for all nodes
  const adj = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  nodes.forEach(n => {
    adj.set(n.id, new Set());
    inDegree.set(n.id, 0);
  });

  validEdges.forEach(e => {
    if (!adj.get(e.source)!.has(e.target)) {
      adj.get(e.source)!.add(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  });

  // Priority scoring for deterministic execution order
  const getPriority = (nodeId: string): number => {
    if (nodeId === startNodeId) return -1;
    const node = nodeMap.get(nodeId);
    if (!node) return 999;
    const label = String(node.data?.label ?? '');
    const configOrder = OPERATIONS[label]?.order ?? Number(node.data?.order ?? 99);
    const posX = typeof node.position?.x === 'number' ? node.position.x : 0;
    return configOrder * 10000 + posX;
  };

  // Find all nodes with in-degree 0
  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const sortedIds: string[] = [];

  while (queue.length > 0) {
    queue.sort((a, b) => getPriority(a) - getPriority(b));
    const currId = queue.shift()!;
    sortedIds.push(currId);

    const neighbors = adj.get(currId) || new Set();
    neighbors.forEach(neighborId => {
      const newDeg = (inDegree.get(neighborId) || 0) - 1;
      inDegree.set(neighborId, newDeg);
      if (newDeg === 0) {
        queue.push(neighborId);
      }
    });
  }

  // Cycle Detection
  if (sortedIds.length < nodes.length) {
    const cycleNodeIds = nodes.filter(n => (inDegree.get(n.id) || 0) > 0).map(n => n.id);
    const cycleLabels = cycleNodeIds.map(id => String(nodeMap.get(id)?.data?.label ?? id));
    const errorMsg = `Workflow contains cyclic dependency involving: ${cycleLabels.join(', ')}`;
    return {
      sortedNodes: [],
      sortedLabels: [],
      operationLabels: [],
      hasCycle: true,
      cycleNodes: cycleLabels,
      cycleNodeLabels: cycleLabels,
      unreachableNodeLabels: [],
      errors: [errorMsg],
      errorMessage: errorMsg,
    };
  }

  // Reachability analysis from Start node (if Start node exists)
  const reachableFromStart = new Set<string>();
  if (nodeMap.has(startNodeId)) {
    const reachQueue = [startNodeId];
    reachableFromStart.add(startNodeId);
    while (reachQueue.length > 0) {
      const curr = reachQueue.shift()!;
      (adj.get(curr) || new Set()).forEach(next => {
        if (!reachableFromStart.has(next)) {
          reachableFromStart.add(next);
          reachQueue.push(next);
        }
      });
    }
  } else {
    sortedIds.forEach(id => reachableFromStart.add(id));
  }

  const unreachableNodeLabels = nodes
    .filter(n => n.id !== startNodeId && !reachableFromStart.has(n.id))
    .map(n => String(n.data?.label ?? n.id));

  const orderedNodes = sortedIds
    .filter(id => id !== startNodeId && reachableFromStart.has(id))
    .map(id => nodeMap.get(id)!);

  const operationLabels = orderedNodes.map(n => String(n.data?.label ?? ''));

  return {
    sortedNodes: orderedNodes,
    sortedLabels: operationLabels,
    operationLabels,
    hasCycle: false,
    cycleNodes: [],
    cycleNodeLabels: [],
    unreachableNodeLabels,
    errors: [],
  };
}

/**
 * Alias for getTopologicalOrder compatible with both test suites and internal callers
 */
export const getTopologicalOrder = topologicalSortWorkflow;

export function validateSequence(nodes: Node[], edges?: Edge[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (!nodes || nodes.length <= 1) {
    return result;
  }

  let operationLabels: string[] = [];

  if (edges !== undefined) {
    const topo = topologicalSortWorkflow(nodes, edges);
    if (topo.hasCycle) {
      result.isValid = false;
      result.errors.push(...topo.errors);
      return result;
    }
    if (topo.unreachableNodeLabels.length > 0) {
      result.warnings.push(
        `Operation(s) not connected to Start: ${topo.unreachableNodeLabels.join(', ')} (will not execute)`
      );
    }
    operationLabels = topo.operationLabels;
  } else {
    operationLabels = nodes.slice(1).map(node => String(node.data?.label || ''));
  }

  const operationConfigs = operationLabels.map(label => OPERATIONS[label]);

  // Check for undefined operations
  operationConfigs.forEach((config, index) => {
    if (!config) {
      result.isValid = false;
      result.errors.push(`Unknown operation: ${operationLabels[index]}`);
    }
  });

  if (!result.isValid) return result;

  // Check dependencies are met in execution order
  for (let i = 0; i < operationLabels.length; i++) {
    const currentOp = operationLabels[i];
    const currentConfig = OPERATIONS[currentOp];
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
      result.warnings.push(`Phase ordering warning: ${config.phase} operation after ${phases[lastPhaseIndex]} phase`);
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
