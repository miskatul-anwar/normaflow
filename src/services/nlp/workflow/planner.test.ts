// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { OPERATIONS, ALL_OPERATION_NAMES } from '../../../config/operations';
import { useWorkflowGraph } from '../../../hooks/useWorkflowGraph';
import { validateSequence } from '../../../utils/workflowValidation';
import { planFor, PlanConflictError } from './planner';

const build = (plan: string[]) => {
  const logs: Array<[string, string]> = [];
  const { result } = renderHook(() => useWorkflowGraph({ log: (level, msg) => void logs.push([level, msg]) }));
  act(() => result.current.addOperationsBatch(plan));
  return { result, logs };
};

describe('planner', () => {
  it('1NF needs loader, cleaner, atomicity, profiler (the spec example)', () => {
    expect(planFor(['1NF']).plan).toEqual(['CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler', '1NF']);
  });

  it('3NF pulls in FD Miner and 2NF, not NER', () => {
    const { plan, addedAsDependencies } = planFor(['3NF']);
    expect(plan).toEqual(expect.arrayContaining(['1NF', 'FD Miner', '2NF', '3NF']));
    expect(plan).not.toContain('NER Classifier');
    expect(addedAsDependencies).not.toContain('3NF');
  });

  it('multi-target is the deduplicated ordered union', () => {
    const { plan } = planFor(['SQL Generator', 'Report Generator']);
    expect(new Set(plan).size).toBe(plan.length);
    expect(plan).toEqual(expect.arrayContaining(['Relation Generator', 'Lossless Check', 'Dependency Preservation']));
  });

  it('reports a conflict instead of dropping an excluded dependency', () => {
    expect(() => planFor(['BCNF'], new Set(['3NF']))).toThrow(PlanConflictError);
  });

  it('every operation is buildable on the real canvas hook', () => {
    for (const target of ALL_OPERATION_NAMES) {
      const { plan } = planFor([target]);
      expect(plan[plan.length - 1], target).toBe(target);
      const { result, logs } = build(plan);
      const errors = logs.filter(l => l[0] === 'error');
      expect(errors, `${target}: ${JSON.stringify(errors)}`).toEqual([]);
      expect(result.current.placedOperationLabels, target).toEqual(plan);
    }
  });

  it('property: any subset gives a dependency-closed, ordered plan that the canvas accepts', () => {
    fc.assert(
      fc.property(fc.subarray(ALL_OPERATION_NAMES, { minLength: 1 }), targets => {
        const { plan } = planFor(targets);
        const orders = plan.map(n => OPERATIONS[n].order);
        expect([...orders].sort((a, b) => a - b)).toEqual(orders);
        for (const n of plan) for (const d of OPERATIONS[n].dependencies) expect(plan).toContain(d);
        const { result, logs } = build(plan);
        const errors = logs.filter(l => l[0] === 'error');
        expect(errors, `${targets.join(',')}: ${JSON.stringify(errors)}`).toEqual([]);
        expect(result.current.placedOperationLabels).toEqual(plan);
        expect(validateSequence(result.current.nodes).isValid).toBe(true);
      }),
      { numRuns: 60 },
    );
  });
});
