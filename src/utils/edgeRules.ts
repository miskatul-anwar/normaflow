import type { Connection, Edge, Node } from '@xyflow/react';
import { OPERATIONS } from '../config/operations';
import { START_NODE_ID, topologicalSortWorkflow } from './workflowValidation';

export interface EdgeValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

export const TERMINAL_OPERATIONS = new Set<string>([
  'Report Generator',
]);

const NORMALIZATION_NODES = new Set<string>(['1NF', '2NF', '3NF']);

export type EdgeConnectionCandidate =
  | Connection
  | Edge
  | { source: string | null; target: string | null; [key: string]: any };

/**
 * Validates whether an incoming -> outgoing edge connection between two nodes
 * satisfies all NormaFlow pipeline rules.
 */
export function validateEdgeConnection(
  connection: EdgeConnectionCandidate,
  nodes: Node[],
  existingEdges: Edge[]
): EdgeValidationResult {
  const { source, target } = connection;

  // 1. Incomplete connection check
  if (!source || !target) {
    return { isValid: false, error: 'Connection must specify both a source and a target.' };
  }

  // 2. Self-loop rule: A node cannot connect to itself
  if (source === target) {
    return { isValid: false, error: 'Cannot connect a node to itself.' };
  }

  // 3. Node resolution
  const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));
  const sourceNode = nodeMap.get(source);
  const targetNode = nodeMap.get(target);

  if (!sourceNode || !targetNode) {
    return { isValid: false, error: 'Source or target node does not exist in the workflow.' };
  }

  const sourceLabel = String(sourceNode.data?.label || (source === START_NODE_ID ? 'Start' : source));
  const targetLabel = String(targetNode.data?.label || (target === START_NODE_ID ? 'Start' : target));
  const isSourceStart = source === START_NODE_ID || sourceLabel.toLowerCase() === 'start';
  const isTargetStart = target === START_NODE_ID || targetLabel.toLowerCase() === 'start';

  // 4. Start node rules
  // Rule: Start node CANNOT have incoming edges
  if (isTargetStart) {
    return {
      isValid: false,
      error: 'The Start node cannot have incoming connections. It is the initial data source.',
    };
  }

  // Rule: Start node can only connect to initial preparation operations
  if (isSourceStart) {
    const targetConfig = OPERATIONS[targetLabel];
    const targetPhase = String(targetNode.data?.phase || targetConfig?.phase || '');
    if (targetPhase && targetPhase !== 'PREP') {
      return {
        isValid: false,
        error: `Start node can only connect to Data Preparation operations (e.g. 'CSV Data Loader'), not directly to '${targetLabel}' (${targetPhase}).`,
      };
    }
  }

  // Rule: Only Start node can connect to CSV Data Loader (CSV Data Loader should not have other incoming edges)
  if (targetLabel === 'CSV Data Loader' && !isSourceStart) {
    return {
      isValid: false,
      error: `'CSV Data Loader' is the entry point for dataset ingestion and can only receive incoming connections from the Start node.`,
    };
  }

  // 5. Terminal node rules: Operations like Report Generator cannot have outgoing connections
  if (TERMINAL_OPERATIONS.has(sourceLabel)) {
    return {
      isValid: false,
      error: `'${sourceLabel}' is a terminal output operation and cannot have outgoing connections.`,
    };
  }

  // 6. Duplicate edge check
  const duplicate = existingEdges.some(
    e => e.source === source && e.target === target && e.id !== (connection as Edge).id
  );
  if (duplicate) {
    return {
      isValid: false,
      error: `A connection already exists from '${sourceLabel}' to '${targetLabel}'.`,
    };
  }

  // 7. Pipeline Ordering & Forward Dataflow Rule
  if (!isSourceStart && !isTargetStart) {
    const sourceConfig = OPERATIONS[sourceLabel];
    const targetConfig = OPERATIONS[targetLabel];

    const sourceOrder = sourceConfig?.order ?? Number(sourceNode.data?.order ?? 0);
    const targetOrder = targetConfig?.order ?? Number(targetNode.data?.order ?? 0);

    if (sourceOrder > 0 && targetOrder > 0) {
      if (sourceOrder >= targetOrder) {
        if (NORMALIZATION_NODES.has(sourceLabel) && NORMALIZATION_NODES.has(targetLabel)) {
          return {
            isValid: false,
            error: `Normalization forms must proceed in forward order: 1NF → 2NF → 3NF (cannot connect '${sourceLabel}' backwards to '${targetLabel}').`,
          };
        }
        return {
          isValid: false,
          error: `Pipeline connections must flow forward: cannot connect '${sourceLabel}' (step ${sourceOrder}) backwards to '${targetLabel}' (step ${targetOrder}).`,
        };
      }
    }

    // Output phase cannot connect back to non-output operations
    const sourcePhase = String(sourceNode.data?.phase || sourceConfig?.phase || '');
    const targetPhase = String(targetNode.data?.phase || targetConfig?.phase || '');
    if (sourcePhase === 'OUTPUT' && targetPhase !== 'OUTPUT') {
      return {
        isValid: false,
        error: `Output phase operations cannot connect back into ${targetPhase} stage '${targetLabel}'.`,
      };
    }
  }

  // 8. Specific prerequisite / dependency rules
  if (targetLabel === 'SQL Generator') {
    if (sourceLabel !== 'Relation Generator' && sourceLabel !== '3NF') {
      return {
        isValid: false,
        error: `'SQL Generator' must receive input from 'Relation Generator' or '3NF'.`,
      };
    }
  }

  if (targetLabel === '3NF') {
    if (sourceLabel !== '2NF') {
      return {
        isValid: false,
        error: `'3NF' requires direct input from '2NF'.`,
      };
    }
  }

  // 9. Acyclicity (DAG Rule): Adding this edge must not introduce a cycle
  const candidateEdge: Edge = {
    id: `temp-${source}-${target}`,
    source,
    target,
  };
  const testEdges = [...existingEdges.filter(e => e.id !== candidateEdge.id), candidateEdge];
  const topo = topologicalSortWorkflow(nodes, testEdges);
  if (topo.hasCycle) {
    const cycleNodes = topo.cycleNodeLabels.length > 0 ? topo.cycleNodeLabels.join(' ↔ ') : `${sourceLabel} ↔ ${targetLabel}`;
    return {
      isValid: false,
      error: `Cannot connect: this connection creates a cyclic dependency (${cycleNodes}). Workflows must be directed acyclic graphs (DAGs).`,
    };
  }

  return { isValid: true };
}

/**
 * Boolean helper for React Flow's isValidConnection prop.
 */
export function isValidEdgeConnection(
  connection: EdgeConnectionCandidate,
  nodes: Node[],
  existingEdges: Edge[]
): boolean {
  return validateEdgeConnection(connection, nodes, existingEdges).isValid;
}
