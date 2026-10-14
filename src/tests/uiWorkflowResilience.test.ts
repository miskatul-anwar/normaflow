import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import {
  getTopologicalOrder,
  topologicalSortWorkflow,
  validateSequence,
} from '../utils/workflowValidation';
import { calculatePreservationRate } from '../components/output/QualityAssuranceSection';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

describe('Milestone 4: UI Workflow Topology & Resilience Test Suite', () => {
  describe('1. React Flow Graph Topological Sorting', () => {
    const createNode = (id: string, label: string, x: number = 0): Node => ({
      id,
      position: { x, y: 400 },
      data: { label, order: Number(id) },
    });

    const createEdge = (source: string, target: string): Edge => ({
      id: `e${source}-${target}`,
      source,
      target,
    });

    it('sorts nodes in linear execution order regardless of array insertion order', () => {
      // Insertion order is intentionally reversed: 3NF, 2NF, 1NF
      const nodes: Node[] = [
        createNode('0', 'Start', 100),
        createNode('3', '3NF', 700),
        createNode('2', '2NF', 500),
        createNode('1', '1NF', 300),
      ];

      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        createEdge('2', '3'),
      ];

      const result = getTopologicalOrder(nodes, edges);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedLabels).toEqual(['1NF', '2NF', '3NF']);
      expect(result.operationLabels).toEqual(['1NF', '2NF', '3NF']);
    });

    it('sorts branching DAG workflows satisfying all dependency constraints', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 100),
        createNode('1', '1NF', 300),
        createNode('2', '2NF', 600),
        createNode('3', '3NF', 900),
        createNode('4', 'FD Miner', 600),
        createNode('5', 'SQL Generator', 1200),
      ];

      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('1', '4'),
        createEdge('3', '5'),
      ];

      const result = getTopologicalOrder(nodes, edges);
      expect(result.hasCycle).toBe(false);

      // Verify prerequisite ordering
      const idx1NF = result.sortedLabels.indexOf('1NF');
      const idx2NF = result.sortedLabels.indexOf('2NF');
      const idx3NF = result.sortedLabels.indexOf('3NF');
      const idxFDMiner = result.sortedLabels.indexOf('FD Miner');
      const idxSQL = result.sortedLabels.indexOf('SQL Generator');

      expect(idx1NF).toBeLessThan(idx2NF);
      expect(idx2NF).toBeLessThan(idx3NF);
      expect(idx1NF).toBeLessThan(idxFDMiner);
      expect(idx3NF).toBeLessThan(idxSQL);
    });

    it('detects cyclic dependencies and reports cycle nodes without crashing', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 100),
        createNode('1', 'Operation A', 300),
        createNode('2', 'Operation B', 600),
        createNode('3', 'Operation C', 900),
      ];

      // A -> B -> C -> A
      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '1'),
      ];

      const result = getTopologicalOrder(nodes, edges);
      expect(result.hasCycle).toBe(true);
      expect(result.errorMessage).toContain('cyclic dependency');
      expect(result.cycleNodes).toBeDefined();
    });

    it('detects self-loop cycle on a single node', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 100),
        createNode('1', 'Operation A', 300),
      ];

      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '1'),
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('connects to itself');
    });

    it('falls back to node array order when no edges exist', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 100),
        createNode('1', '1NF', 300),
        createNode('2', '2NF', 500),
      ];

      const result = getTopologicalOrder(nodes, []);
      expect(result.hasCycle).toBe(false);
      expect(result.sortedLabels).toEqual(['1NF', '2NF']);
    });

    it('identifies unreachable nodes not connected to Start', () => {
      const nodes: Node[] = [
        createNode('0', 'Start', 100),
        createNode('1', '1NF', 300),
        createNode('2', '2NF', 500),
        createNode('3', 'Orphaned Op', 800),
      ];

      const edges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
      ];

      const result = topologicalSortWorkflow(nodes, edges);
      expect(result.hasCycle).toBe(false);
      expect(result.operationLabels).toEqual(['1NF', '2NF']);
      expect(result.unreachableNodeLabels).toContain('Orphaned Op');
    });
  });

  describe('2. Workflow Sequence & Topological Validation', () => {
    it('validates sequence prerequisites with edge topology and flags cycles', () => {
      const nodes: Node[] = [
        { id: '0', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: '1', position: { x: 100, y: 0 }, data: { label: '1NF' } },
        { id: '2', position: { x: 200, y: 0 }, data: { label: '2NF' } },
      ];

      const cyclicEdges: Edge[] = [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-1', source: '2', target: '1' },
      ];

      const result = validateSequence(nodes, cyclicEdges);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('cyclic dependency'))).toBe(true);
    });

    it('validates prerequisite requirements when operations are missing', () => {
      const nodesWithout1NF: Node[] = [
        { id: '0', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: '2', position: { x: 200, y: 0 }, data: { label: '2NF' } },
      ];

      const result = validateSequence(nodesWithout1NF);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('2NF requires 1NF'))).toBe(true);
    });
  });

  describe('3. QualityAssuranceSection NaN% and Division by Zero Guards', () => {
    it('returns 100.0% when 0 dependencies exist instead of NaN%', () => {
      const depPreservation = {
        isPreserved: true,
        preserved: [],
        lost: [],
      };

      const rate = calculatePreservationRate(depPreservation);
      expect(rate).toBe('100.0');
      expect(rate).not.toBe('NaN');
    });

    it('returns 0.0% when dependencyPreservation is null or undefined', () => {
      expect(calculatePreservationRate(null)).toBe('0.0');
      expect(calculatePreservationRate(undefined)).toBe('0.0');
    });

    it('formats existing preservationRatio correctly when provided', () => {
      const depPreservation = {
        isPreserved: true,
        preserved: [],
        lost: [],
        preservationRatio: 0.854,
      };

      expect(calculatePreservationRate(depPreservation)).toBe('85.4');
    });

    it('computes exact ratio when non-empty preserved and lost arrays are given', () => {
      expect(
        calculatePreservationRate({
          preserved: [{ lhs: ['A'], rhs: 'B' }],
          lost: [{ lhs: ['C'], rhs: 'D' }],
        })
      ).toBe('50.0');

      expect(
        calculatePreservationRate({
          preserved: [{ lhs: ['A'], rhs: 'B' }, { lhs: ['C'], rhs: 'D' }],
          lost: [],
        })
      ).toBe('100.0');

      expect(
        calculatePreservationRate({
          preserved: [],
          lost: [{ lhs: ['A'], rhs: 'B' }],
        })
      ).toBe('0.0');
    });
  });

  describe('4. React ErrorBoundary Resilience & State Transitions', () => {
    it('transforms caught errors into hasError state in getDerivedStateFromError', () => {
      const testError = new Error('Test render crash');
      const state = ErrorBoundary.getDerivedStateFromError(testError);

      expect(state.hasError).toBe(true);
      expect(state.error).toBe(testError);
    });

    it('initializes with hasError: false and error: null', () => {
      const boundary = new ErrorBoundary({ children: null });
      expect(boundary.state.hasError).toBe(false);
      expect(boundary.state.error).toBe(null);
      expect(boundary.state.errorInfo).toBe(null);
    });

    it('resets error state when reset() is invoked', () => {
      const boundary = new ErrorBoundary({ children: null });
      boundary.state = {
        hasError: true,
        error: new Error('Crash'),
        errorInfo: {} as any,
      };

      boundary.reset();
      expect(boundary.state.hasError).toBe(false);
      expect(boundary.state.error).toBe(null);
      expect(boundary.state.errorInfo).toBe(null);
    });
  });
});
