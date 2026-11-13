// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { OPERATIONS, ALL_OPERATION_NAMES, canonicalOperationName } from '../config/operations';
import { DatabaseService } from '../services/api/databaseService';
import { useWorkflowGraph } from '../hooks/useWorkflowGraph';
import { resolveLexical } from '../services/nlp/workflow/lexicalResolver';

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' });

describe('Column Classifier (formerly NER Classifier)', () => {
  it('is registered under the new name only', () => {
    expect(OPERATIONS['Column Classifier']?.id).toBe('column-classifier');
    expect(ALL_OPERATION_NAMES).toContain('Column Classifier');
    expect(ALL_OPERATION_NAMES).not.toContain('NER Classifier');
    expect(canonicalOperationName('NER Classifier')).toBe('Column Classifier');
    expect(canonicalOperationName('3NF')).toBe('3NF');
  });

  it('the engine accepts the old name and still classifies the columns', async () => {
    const rows = ['order_id,customer_email,total'];
    for (let i = 1; i <= 30; i++) rows.push(`${i},user${i}@example.com,${i * 2}.5`);
    const ops = ['CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler', 'NER Classifier', '1NF'];
    const r: any = await new DatabaseService().processFile(csv('orders.csv', rows.join('\n')), ops);
    expect(r.success).toBe(true);
  });

  it('requests that say "ner", "classify columns" or "column classifier" still resolve to it', () => {
    for (const q of ['run ner', 'classify the columns', 'add the column classifier']) {
      expect(resolveLexical(q).targets).toContain('Column Classifier');
    }
  });

  it('a workflow saved with the old name loads under the new name', () => {
    const { result } = renderHook(() => useWorkflowGraph({ log: () => {} }));
    const mk = (id: string, label: string, operationId: string) => ({ id, type: 'operation', position: { x: 0, y: 0 }, data: { label, phase: 'PREP', operationId } });
    const snapshot = {
      format: 'normaflow-workflow', version: 2, nextId: 6,
      nodes: [
        { id: '0', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        mk('1', 'CSV Data Loader', 'csv-loader'), mk('2', 'Data Cleaner', 'data-cleaner'),
        mk('3', 'Atomicity Checker', 'atomicity-checker'), mk('4', 'Data Type Profiler', 'data-profiler'),
        mk('5', 'NER Classifier', 'ner-classifier'),
      ],
      edges: [],
    };
    let ok = false;
    act(() => { ok = result.current.loadSnapshot(snapshot as object); });
    expect(ok).toBe(true);
    expect(result.current.operationLabels).toContain('Column Classifier');
    expect(result.current.operationLabels).not.toContain('NER Classifier');
  });
});
