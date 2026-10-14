import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { validateEdgeConnection, isValidEdgeConnection } from '../utils/edgeRules';
import { START_NODE_ID } from '../utils/workflowValidation';

function createMockNode(id: string, label: string, phase = 'PREP', order = 1): Node {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { label, phase, order },
    type: 'tealNode',
  };
}

describe('Pipeline Edge Connection Rules (validateEdgeConnection)', () => {
  const startNode: Node = {
    id: START_NODE_ID,
    position: { x: 100, y: 400 },
    data: { label: 'Start' },
    type: 'startNode',
  };

  const csvLoader = createMockNode('1', 'CSV Data Loader', 'PREP', 1);
  const dataCleaner = createMockNode('2', 'Data Cleaner', 'PREP', 2);
  const dataProfiler = createMockNode('4', 'Data Type Profiler', 'PREP', 4);
  const nf1 = createMockNode('6', '1NF', 'NORMAL', 6);
  const fdMiner = createMockNode('7', 'FD Miner', 'ANALYZE', 7);
  const keyDiscovery = createMockNode('8', 'Key Discovery', 'ANALYZE', 8);
  const nf2 = createMockNode('11', '2NF', 'NORMAL', 11);
  const nf3 = createMockNode('12', '3NF', 'NORMAL', 12);
  const relationGen = createMockNode('16', 'Relation Generator', 'OUTPUT', 16);
  const sqlGen = createMockNode('17', 'SQL Generator', 'OUTPUT', 17);
  const reportGen = createMockNode('18', 'Report Generator', 'OUTPUT', 18);

  const defaultNodes = [
    startNode,
    csvLoader,
    dataCleaner,
    dataProfiler,
    nf1,
    fdMiner,
    keyDiscovery,
    nf2,
    nf3,
    relationGen,
    sqlGen,
    reportGen,
  ];

  describe('Self-loop and missing endpoints', () => {
    it('rejects connection if source or target is missing', () => {
      const res = validateEdgeConnection({ source: '', target: '1' } as any, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Connection must specify both a source and a target');
    });

    it('rejects connection when a node connects to itself', () => {
      const res = validateEdgeConnection({ source: '1', target: '1' }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Cannot connect a node to itself.');
    });

    it('rejects connection if source or target does not exist in nodes array', () => {
      const res = validateEdgeConnection({ source: '999', target: '1' }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('does not exist');
    });
  });

  describe('Start node rules', () => {
    it('disallows any incoming edge into the Start node', () => {
      const res = validateEdgeConnection({ source: '1', target: START_NODE_ID }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Start node cannot have incoming connections');
    });

    it('allows Start node to connect to CSV Data Loader (PREP)', () => {
      const res = validateEdgeConnection({ source: START_NODE_ID, target: '1' }, defaultNodes, []);
      expect(res.isValid).toBe(true);
    });

    it('disallows Start node from connecting directly to non-PREP operations', () => {
      const res = validateEdgeConnection({ source: START_NODE_ID, target: '17' }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Start node can only connect to Data Preparation operations');
    });

    it('disallows non-Start nodes from feeding into CSV Data Loader', () => {
      const res = validateEdgeConnection({ source: '2', target: '1' }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('can only receive incoming connections from the Start node');
    });
  });

  describe('Terminal node rules', () => {
    it('disallows Report Generator from having outgoing connections', () => {
      const res = validateEdgeConnection({ source: '18', target: '17' }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('terminal output operation and cannot have outgoing connections');
    });
  });

  describe('Duplicate edge rules', () => {
    it('rejects connection if an identical edge already exists', () => {
      const existing: Edge[] = [
        { id: 'e1', source: '1', target: '2' },
      ];
      const res = validateEdgeConnection({ source: '1', target: '2' }, defaultNodes, existing);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('already exists');
    });
  });

  describe('Forward pipeline dataflow and normalization order', () => {
    it('allows valid forward connections across pipeline stages', () => {
      // PREP -> PREP
      expect(validateEdgeConnection({ source: '1', target: '2' }, defaultNodes, []).isValid).toBe(true);
      // 1NF -> FD Miner
      expect(validateEdgeConnection({ source: '6', target: '7' }, defaultNodes, []).isValid).toBe(true);
      // FD Miner -> 2NF
      expect(validateEdgeConnection({ source: '7', target: '11' }, defaultNodes, []).isValid).toBe(true);
      // 2NF -> 3NF
      expect(validateEdgeConnection({ source: '11', target: '12' }, defaultNodes, []).isValid).toBe(true);
      // 3NF -> Relation Generator
      expect(validateEdgeConnection({ source: '12', target: '16' }, defaultNodes, []).isValid).toBe(true);
      // Relation Generator -> SQL Generator
      expect(validateEdgeConnection({ source: '16', target: '17' }, defaultNodes, []).isValid).toBe(true);
    });

    it('rejects backward connections in pipeline order', () => {
      // SQL Generator backwards to Data Cleaner
      const res = validateEdgeConnection({ source: '17', target: '2' }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Pipeline connections must flow forward');
    });

    it('rejects backward connections between normalization forms (e.g. 3NF -> 1NF)', () => {
      const res = validateEdgeConnection({ source: '12', target: '6' }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Normalization forms must proceed in forward order: 1NF → 2NF → 3NF');
    });

    it('rejects 3NF -> 2NF backward connection', () => {
      const res = validateEdgeConnection({ source: '12', target: '11' }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Normalization forms must proceed in forward order');
    });
  });

  describe('Specific prerequisite rules', () => {
    it('enforces that 3NF requires direct input from 2NF', () => {
      // Attempting to connect directly from 1NF to 3NF without 2NF
      const res = validateEdgeConnection({ source: '6', target: '12' }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("'3NF' requires direct input from '2NF'");
    });

    it('enforces that SQL Generator requires input from Relation Generator or 3NF', () => {
      const res = validateEdgeConnection({ source: '8', target: '17' }, defaultNodes, []);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("'SQL Generator' must receive input from 'Relation Generator' or '3NF'");
    });
  });

  describe('DAG Acyclicity (Cycle Prevention)', () => {
    it('rejects connection that would create a cycle (A -> B -> C -> A)', () => {
      const edges: Edge[] = [
        { id: 'e1', source: '6', target: '7' },
        { id: 'e2', source: '7', target: '8' },
      ];
      // Try connecting 8 back to 6
      const res = validateEdgeConnection({ source: '8', target: '6' }, defaultNodes, edges);
      expect(res.isValid).toBe(false);
      // Fails both forward order and acyclicity
      expect(res.error).toBeDefined();
    });
  });

  describe('isValidEdgeConnection helper', () => {
    it('returns boolean matching validateEdgeConnection.isValid', () => {
      expect(isValidEdgeConnection({ source: '1', target: '2' }, defaultNodes, [])).toBe(true);
      expect(isValidEdgeConnection({ source: '2', target: '1' }, defaultNodes, [])).toBe(false);
      expect(isValidEdgeConnection({ source: '1', target: '1' }, defaultNodes, [])).toBe(false);
    });
  });
});
