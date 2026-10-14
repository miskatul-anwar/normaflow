import { describe, it, expect, vi } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import {
  topologicalSortWorkflow,
  validateSequence,
} from '../utils/workflowValidation';
import { calculatePreservationRate } from '../components/output/QualityAssuranceSection';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

// Helper constructors
function createNode(id: string, label: string, x: number = 0, y: number = 400): Node {
  return {
    id,
    position: { x, y },
    data: { label, order: Number(id) || 1 },
  };
}

function createEdge(source: string, target: string): Edge {
  return {
    id: `e${source}-${target}`,
    source,
    target,
  };
}

describe('Milestone 4 Challenger: Adversarial UI Workflow Topology & Resilience Stress Suite', () => {

  // =========================================================================
  // SUITE 1: TOPOLOGICAL SORTING WITH COMPLEX DAG TOPOLOGIES
  // =========================================================================
  describe('1. Complex DAG Topologies & Ordering Guarantees', () => {
    it('correctly sorts when nodes array is completely inverted relative to dependency order', () => {
      // Linear chain: Start(0) -> 1NF(1) -> 2NF(2) -> 3NF(3) -> Relation Gen(4) -> SQL Gen(5)
      // Insertion order in array is completely reversed: 5, 4, 3, 2, 1, 0
      const nodes: Node[] = [
        createNode('5', 'SQL Generator', 1500),
        createNode('4', 'Relation Generator', 1200),
        createNode('3', '3NF', 900),
        createNode('2', '2NF', 600),
        createNode('1', '1NF', 300),
        createNode('0', 'Start', 0),
      ];

      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4'),
        createEdge('4', '5'),
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedLabels).toEqual([
        '1NF',
        '2NF',
        '3NF',
        'Relation Generator',
        'SQL Generator',
      ]);
      expect(result.operationLabels).toEqual(result.sortedLabels);
      expect(result.unreachableNodeLabels).toEqual([]);
    });

    it('correctly sorts a diamond DAG (branch and merge)', () => {
      //       Start
      //         │
      //        1NF
      //       /   \
      //    2NF     FD Miner
      //       \   /
      //        3NF
      //         │
      //    SQL Generator
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('1', '1NF', 200),
        createNode('2', '2NF', 400, 300),
        createNode('3', 'FD Miner', 400, 500),
        createNode('4', '3NF', 600),
        createNode('5', 'SQL Generator', 800),
      ];

      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        createEdge('1', '3'),
        createEdge('2', '4'),
        createEdge('3', '4'),
        createEdge('4', '5'),
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(false);

      const labels = result.operationLabels;
      expect(labels.indexOf('1NF')).toBeLessThan(labels.indexOf('2NF'));
      expect(labels.indexOf('1NF')).toBeLessThan(labels.indexOf('FD Miner'));
      expect(labels.indexOf('2NF')).toBeLessThan(labels.indexOf('3NF'));
      expect(labels.indexOf('FD Miner')).toBeLessThan(labels.indexOf('3NF'));
      expect(labels.indexOf('3NF')).toBeLessThan(labels.indexOf('SQL Generator'));
    });

    it('correctly sorts multi-branch multi-merge (lattice) DAG', () => {
      // Start -> A -> B1, B2 -> C1, C2 (cross-connected) -> D
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('A', '1NF', 200),
        createNode('B1', '2NF', 400, 300),
        createNode('B2', 'FD Miner', 400, 500),
        createNode('C1', '3NF', 600, 300),
        createNode('C2', 'Relation Generator', 600, 500),
        createNode('D', 'SQL Generator', 800),
      ];

      const edges: Edge[] = [
        createEdge('0', 'A'),
        createEdge('A', 'B1'),
        createEdge('A', 'B2'),
        createEdge('B1', 'C1'),
        createEdge('B1', 'C2'),
        createEdge('B2', 'C1'),
        createEdge('B2', 'C2'),
        createEdge('C1', 'D'),
        createEdge('C2', 'D'),
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(false);
      expect(result.operationLabels).toHaveLength(6);

      const labels = result.operationLabels;
      expect(labels.indexOf('1NF')).toBe(0);
      expect(labels.indexOf('SQL Generator')).toBe(5);

      // Verify B nodes precede C nodes
      expect(labels.indexOf('2NF')).toBeLessThan(labels.indexOf('3NF'));
      expect(labels.indexOf('2NF')).toBeLessThan(labels.indexOf('Relation Generator'));
      expect(labels.indexOf('FD Miner')).toBeLessThan(labels.indexOf('3NF'));
      expect(labels.indexOf('FD Miner')).toBeLessThan(labels.indexOf('Relation Generator'));
    });

    it('handles disconnected subgraphs and flags unreachable components', () => {
      // Connected component: Start(0) -> 1NF(1) -> 2NF(2)
      // Disconnected component: FD Miner(3) -> 3NF(4)
      // Isolated node: SQL Generator(5)
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('1', '1NF', 200),
        createNode('2', '2NF', 400),
        createNode('3', 'FD Miner', 200, 600),
        createNode('4', '3NF', 400, 600),
        createNode('5', 'SQL Generator', 600, 600),
      ];

      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        createEdge('3', '4'),
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(false);
      // Only nodes reachable from Start should be in operationLabels
      expect(result.operationLabels).toEqual(['1NF', '2NF']);
      // Unreachable nodes should be reported
      expect(result.unreachableNodeLabels).toContain('FD Miner');
      expect(result.unreachableNodeLabels).toContain('3NF');
      expect(result.unreachableNodeLabels).toContain('SQL Generator');
    });

    it('handles isolated Start node with completely disconnected operations', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('1', '1NF', 200),
        createNode('2', '2NF', 400),
      ];

      // Edge exists between 1 and 2, but neither connects to Start
      const edges: Edge[] = [createEdge('1', '2')];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(false);
      expect(result.operationLabels).toEqual([]);
      expect(result.unreachableNodeLabels).toEqual(['1NF', '2NF']);
    });

    it('handles graph without Start node gracefully', () => {
      // When no node has id === '0', all nodes are retained
      const nodes: Node[] = [
        createNode('1', '1NF', 200),
        createNode('2', '2NF', 400),
        createNode('3', '3NF', 600),
      ];

      const edges: Edge[] = [
        createEdge('1', '2'),
        createEdge('2', '3'),
      ];

      const result = topologicalSortWorkflow(nodes, edges, 'NON_EXISTENT_START');
      expect(result.hasCycle).toBe(false);
      expect(result.operationLabels).toEqual(['1NF', '2NF', '3NF']);
      expect(result.unreachableNodeLabels).toEqual([]);
    });

    it('tolerates duplicate parallel edges between identical nodes without double-counting in-degree', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('1', '1NF', 200),
        createNode('2', '2NF', 400),
      ];

      // Three redundant parallel edges from 1 to 2
      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        { id: 'dup1', source: '1', target: '2' },
        { id: 'dup2', source: '1', target: '2' },
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(false);
      expect(result.operationLabels).toEqual(['1NF', '2NF']);
    });

    it('empirically sorts 15 randomized DAG instances preserving all dependency invariants', () => {
      for (let run = 0; run < 15; run++) {
        const nodeCount = 5 + (run % 5); // 5 to 9 nodes
        const nodes: Node[] = [createNode('0', 'Start', 0)];
        const opIds: string[] = [];

        for (let i = 1; i <= nodeCount; i++) {
          const id = `op_${i}`;
          opIds.push(id);
          nodes.push(createNode(id, `Operation_${i}`, i * 150));
        }

        // Random forward edges: edge only from u to v where u < v
        const edges: Edge[] = [createEdge('0', opIds[0])];
        for (let i = 0; i < opIds.length; i++) {
          for (let j = i + 1; j < opIds.length; j++) {
            if ((run + i + j) % 3 === 0) {
              edges.push(createEdge(opIds[i], opIds[j]));
            }
          }
        }

        const result = topologicalSortWorkflow(nodes, edges);
        expect(result.hasCycle).toBe(false);

        // Invariant: for every edge u -> v among reachable nodes, index(u) < index(v)
        const sortedLabels = result.operationLabels;
        const labelMap = new Map<string, string>();
        nodes.forEach(n => labelMap.set(n.id, String(n.data?.label ?? n.id)));

        edges.forEach(e => {
          if (e.source !== '0') {
            const srcLabel = labelMap.get(e.source)!;
            const tgtLabel = labelMap.get(e.target)!;
            const srcIdx = sortedLabels.indexOf(srcLabel);
            const tgtIdx = sortedLabels.indexOf(tgtLabel);
            if (srcIdx !== -1 && tgtIdx !== -1) {
              expect(srcIdx).toBeLessThan(tgtIdx);
            }
          }
        });
      }
    });
  });

  // =========================================================================
  // SUITE 2: CYCLE DETECTION ADVERSARIAL CHALLENGE
  // =========================================================================
  describe('2. Cycle Detection on Self-Loops, Reciprocal & Multi-Node Cycles', () => {
    it('detects self-loop on operation node', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('1', '1NF', 200),
      ];

      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '1'), // Self loop
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(true);
      expect(result.sortedNodes).toEqual([]);
      expect(result.operationLabels).toEqual([]);
      expect(result.errorMessage).toContain('connects to itself');
      expect(result.cycleNodeLabels).toContain('1NF');
    });

    it('detects self-loop on Start node', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('1', '1NF', 200),
      ];

      const edges: Edge[] = [
        createEdge('0', '0'), // Start connects to Start
        createEdge('0', '1'),
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(true);
      expect(result.errorMessage).toContain('connects to itself');
    });

    it('detects 2-node reciprocal cycle (A -> B -> A)', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('A', 'Operation A', 200),
        createNode('B', 'Operation B', 400),
      ];

      const edges: Edge[] = [
        createEdge('0', 'A'),
        createEdge('A', 'B'),
        createEdge('B', 'A'), // Reciprocal edge
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(true);
      expect(result.sortedNodes).toEqual([]);
      expect(result.errorMessage).toContain('cyclic dependency');
      expect(result.cycleNodeLabels).toContain('Operation A');
      expect(result.cycleNodeLabels).toContain('Operation B');
    });

    it('detects 3-node cycle (A -> B -> C -> A)', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('A', 'Op A', 200),
        createNode('B', 'Op B', 400),
        createNode('C', 'Op C', 600),
      ];

      const edges: Edge[] = [
        createEdge('0', 'A'),
        createEdge('A', 'B'),
        createEdge('B', 'C'),
        createEdge('C', 'A'), // Back edge to A
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodeLabels).toContain('Op A');
      expect(result.cycleNodeLabels).toContain('Op B');
      expect(result.cycleNodeLabels).toContain('Op C');
    });

    it('detects 5-node extended cycle (A -> B -> C -> D -> E -> A)', () => {
      const ids = ['A', 'B', 'C', 'D', 'E'];
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        ...ids.map((id, idx) => createNode(id, `Node_${id}`, (idx + 1) * 200)),
      ];

      const edges: Edge[] = [
        createEdge('0', 'A'),
        createEdge('A', 'B'),
        createEdge('B', 'C'),
        createEdge('C', 'D'),
        createEdge('D', 'E'),
        createEdge('E', 'A'), // Cycle back to A
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(true);
      ids.forEach(id => {
        expect(result.cycleNodeLabels).toContain(`Node_${id}`);
      });
    });

    it('detects cycle in an isolated component unreachable from Start', () => {
      // Start -> 1NF -> 2NF is valid
      // CycleX -> CycleY -> CycleX is an unreachable cycle
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('1', '1NF', 200),
        createNode('2', '2NF', 400),
        createNode('X', 'CycleX', 200, 600),
        createNode('Y', 'CycleY', 400, 600),
      ];

      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        createEdge('X', 'Y'),
        createEdge('Y', 'X'), // Disconnected cycle
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodeLabels).toContain('CycleX');
      expect(result.cycleNodeLabels).toContain('CycleY');
    });

    it('detects cycle with downstream tail (lasso graph: Start -> A -> B -> C -> B, C -> D -> E)', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('A', 'A', 200),
        createNode('B', 'B', 400),
        createNode('C', 'C', 600),
        createNode('D', 'D', 800),
        createNode('E', 'E', 1000),
      ];

      const edges: Edge[] = [
        createEdge('0', 'A'),
        createEdge('A', 'B'),
        createEdge('B', 'C'),
        createEdge('C', 'B'), // Cycle between B and C
        createEdge('C', 'D'),
        createEdge('D', 'E'),
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(true);
      expect(result.operationLabels).toEqual([]);
      expect(result.cycleNodeLabels).toContain('B');
      expect(result.cycleNodeLabels).toContain('C');
    });

    it('detects two separate disjoint cycles in the same graph', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('A1', 'A1', 200),
        createNode('A2', 'A2', 400),
        createNode('B1', 'B1', 200, 600),
        createNode('B2', 'B2', 400, 600),
      ];

      const edges: Edge[] = [
        createEdge('0', 'A1'),
        createEdge('A1', 'A2'),
        createEdge('A2', 'A1'), // Cycle 1
        createEdge('B1', 'B2'),
        createEdge('B2', 'B1'), // Cycle 2
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodeLabels.length).toBeGreaterThanOrEqual(4);
    });

    it('validateSequence cleanly reports cyclic errors and sets isValid = false', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 0),
        createNode('1', '1NF', 200),
        createNode('2', '2NF', 400),
      ];

      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        createEdge('2', '1'), // Cycle
      ];

      const result = validateSequence(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('cyclic dependency');
    });
  });

  // =========================================================================
  // SUITE 3: QA SECTION DIVISION-BY-ZERO & ADVERSARIAL MATH
  // =========================================================================
  describe('3. QA Section Math & Zero-Division Edge Cases', () => {
    it('handles 0 preserved and 0 lost dependencies safely without NaN%', () => {
      const result = calculatePreservationRate({
        isPreserved: true,
        preserved: [],
        lost: [],
      });
      expect(result).toBe('100.0');
      expect(result).not.toContain('NaN');
    });

    it('handles 0 preserved and 0 lost with isPreserved: false', () => {
      const result = calculatePreservationRate({
        isPreserved: false,
        preserved: [],
        lost: [],
      });
      expect(result).toBe('0.0');
    });

    it('handles 0 preserved and 0 lost with isPreserved: undefined (defaults to 100.0)', () => {
      const result = calculatePreservationRate({
        preserved: [],
        lost: [],
      });
      expect(result).toBe('100.0');
    });

    it('returns 0.0 for null or undefined input', () => {
      expect(calculatePreservationRate(null)).toBe('0.0');
      expect(calculatePreservationRate(undefined)).toBe('0.0');
    });

    it('handles non-array preserved and lost properties without throwing TypeError', () => {
      const malformedInput: any = {
        isPreserved: true,
        preserved: null,
        lost: undefined,
      };
      expect(() => calculatePreservationRate(malformedInput)).not.toThrow();
      expect(calculatePreservationRate(malformedInput)).toBe('100.0');
    });

    it('rejects NaN and Infinity in preservationRatio fallback', () => {
      const nanRatio = {
        preserved: [],
        lost: [],
        preservationRatio: NaN,
        isPreserved: true,
      };
      const infRatio = {
        preserved: [],
        lost: [],
        preservationRatio: Infinity,
        isPreserved: true,
      };
      const negInfRatio = {
        preserved: [],
        lost: [],
        preservationRatio: -Infinity,
        isPreserved: true,
      };

      expect(calculatePreservationRate(nanRatio)).toBe('100.0');
      expect(calculatePreservationRate(infRatio)).toBe('100.0');
      expect(calculatePreservationRate(negInfRatio)).toBe('100.0');
    });

    it('computes exact ratios for various non-empty combinations', () => {
      // 1 preserved, 2 lost -> 1/3 = 33.3%
      expect(
        calculatePreservationRate({
          preserved: [{ lhs: ['A'], rhs: 'B' }],
          lost: [{ lhs: ['C'], rhs: 'D' }, { lhs: ['E'], rhs: 'F' }],
        })
      ).toBe('33.3');

      // 7 preserved, 3 lost -> 7/10 = 70.0%
      expect(
        calculatePreservationRate({
          preserved: new Array(7).fill({ lhs: ['A'], rhs: 'B' }),
          lost: new Array(3).fill({ lhs: ['C'], rhs: 'D' }),
        })
      ).toBe('70.0');

      // 0 preserved, 4 lost -> 0.0%
      expect(
        calculatePreservationRate({
          preserved: [],
          lost: new Array(4).fill({ lhs: ['C'], rhs: 'D' }),
        })
      ).toBe('0.0');
    });

    it('evaluates valid preservationRatio when preserved and lost arrays are empty', () => {
      expect(
        calculatePreservationRate({
          preserved: [],
          lost: [],
          preservationRatio: 0.9456,
        })
      ).toBe('94.6');

      expect(
        calculatePreservationRate({
          preservationRatio: 0.0,
        })
      ).toBe('0.0');

      expect(
        calculatePreservationRate({
          preservationRatio: 1.0,
        })
      ).toBe('100.0');
    });

    it('evaluates confidence badge conditions guarding against 0, NaN, and negative numbers', () => {
      // The condition in QualityAssuranceSection.tsx is:
      // typeof fd.confidence === 'number' && Number.isFinite(fd.confidence) && fd.confidence > 0
      const isBadgeRendered = (confidence: any): boolean => {
        return typeof confidence === 'number' && Number.isFinite(confidence) && confidence > 0;
      };

      // Falsy / invalid numbers that previously caused "0" or "NaN%" rendering:
      expect(isBadgeRendered(0)).toBe(false);
      expect(isBadgeRendered(0.0)).toBe(false);
      expect(isBadgeRendered(-0.5)).toBe(false);
      expect(isBadgeRendered(NaN)).toBe(false);
      expect(isBadgeRendered(Infinity)).toBe(false);
      expect(isBadgeRendered(-Infinity)).toBe(false);
      expect(isBadgeRendered(null)).toBe(false);
      expect(isBadgeRendered(undefined)).toBe(false);
      expect(isBadgeRendered('0.95')).toBe(false);

      // Valid positive confidence values:
      expect(isBadgeRendered(0.854)).toBe(true);
      expect(isBadgeRendered(1.0)).toBe(true);
      expect(isBadgeRendered(0.001)).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 4: ERROR BOUNDARY RESILIENCE & RECOVERY
  // =========================================================================
  describe('4. ErrorBoundary Lifecycle, Fallback & State Transitions', () => {
    it('initializes in healthy state (hasError: false, error: null)', () => {
      const boundary = new ErrorBoundary({ children: null });
      expect(boundary.state.hasError).toBe(false);
      expect(boundary.state.error).toBe(null);
      expect(boundary.state.errorInfo).toBe(null);
    });

    it('derives error state from caught Error object', () => {
      const error = new TypeError('Simulated TypeError in render');
      const derived = ErrorBoundary.getDerivedStateFromError(error);

      expect(derived.hasError).toBe(true);
      expect(derived.error).toBe(error);
    });

    it('componentDidCatch triggers onError callback with error and component stack', () => {
      const onErrorMock = vi.fn();
      const boundary = new ErrorBoundary({
        children: null,
        onError: onErrorMock,
        componentName: 'TestComponent',
      });

      const error = new Error('Render crash');
      const errorInfo = { componentStack: '\n    in TestComponent\n    in div' };

      boundary.componentDidCatch(error, errorInfo as any);

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock).toHaveBeenCalledWith(error, errorInfo);
    });

    it('reset() method clears error state completely', () => {
      const boundary = new ErrorBoundary({ children: null });
      boundary.state = {
        hasError: true,
        error: new Error('Critical failure'),
        errorInfo: { componentStack: 'stack' } as any,
      };

      boundary.reset();

      expect(boundary.state.hasError).toBe(false);
      expect(boundary.state.error).toBe(null);
      expect(boundary.state.errorInfo).toBe(null);
    });

    it('componentDidUpdate triggers reset when resetKeys prop changes', () => {
      const boundary = new ErrorBoundary({
        children: null,
        resetKeys: ['file1.csv', 1],
      });

      // Simulate error state
      boundary.state = {
        hasError: true,
        error: new Error('File crash'),
        errorInfo: null,
      };

      const resetSpy = vi.spyOn(boundary, 'reset');

      // Props change: different file name
      boundary.componentDidUpdate({
        children: null,
        resetKeys: ['file0.csv', 1],
      });

      expect(resetSpy).toHaveBeenCalledTimes(1);
    });

    it('componentDidUpdate does not reset when resetKeys remain identical', () => {
      const boundary = new ErrorBoundary({
        children: null,
        resetKeys: ['file1.csv', 1],
      });

      boundary.state = {
        hasError: true,
        error: new Error('File crash'),
        errorInfo: null,
      };

      const resetSpy = vi.spyOn(boundary, 'reset');

      // Same resetKeys
      boundary.componentDidUpdate({
        children: null,
        resetKeys: ['file1.csv', 1],
      });

      expect(resetSpy).not.toHaveBeenCalled();
    });

    it('supports functional fallback renderer passing error and reset trigger', () => {
      let receivedError: Error | null = null;
      let receivedReset: (() => void) | null = null;

      const fallbackFn = (err: Error, reset: () => void) => {
        receivedError = err;
        receivedReset = reset;
        return 'Custom Fallback Rendered';
      };

      const boundary = new ErrorBoundary({
        children: 'Normal Children',
        fallback: fallbackFn,
      });

      const testError = new Error('Custom Error');
      boundary.state = {
        hasError: true,
        error: testError,
        errorInfo: null,
      };

      const output = boundary.render();
      expect(output).toBe('Custom Fallback Rendered');
      expect(receivedError).toBe(testError);
      expect(typeof receivedReset).toBe('function');

      // Test invoking the reset function passed to fallback
      receivedReset!();
      expect(boundary.state.hasError).toBe(false);
    });

    it('renders normal children when hasError is false', () => {
      const boundary = new ErrorBoundary({
        children: 'Healthy Child Component',
      });

      const output = boundary.render();
      expect(output).toBe('Healthy Child Component');
    });
  });
});
