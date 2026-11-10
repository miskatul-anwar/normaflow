// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { useWorkflowGraph } from '../../hooks/useWorkflowGraph';
import { useNLWorkflow } from '../../hooks/useNLWorkflow';
import { NLCommandBar } from './NLCommandBar';
import { FakeEmbeddingProvider } from '../../services/nlp/workflow';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

let latest: ReturnType<typeof useWorkflowGraph> | null = null;
const run = vi.fn();

function Harness({ hasFiles = true }: { hasFiles?: boolean }) {
  const graph = useWorkflowGraph();
  latest = graph;
  const nl = useNLWorkflow({ graph, run, hasFiles, provider: new FakeEmbeddingProvider() });
  return <NLCommandBar nl={nl} />;
}

const type = async (text: string) => {
  // The input is disabled while its vanish animation plays after a submit.
  await waitFor(() => expect((screen.getByLabelText(/describe the pipeline/i) as HTMLInputElement).disabled).toBe(false));
  const input = screen.getByLabelText(/describe the pipeline/i);
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    // A real Enter key: keydown first, then the form submit it triggers.
    fireEvent.keyDown(input, { key: 'Enter' });
  });
};

afterEach(() => {
  cleanup();
  run.mockClear();
});

describe('NLCommandBar', () => {
  it('previews the five-step plan for "convert it to 1NF", then Apply builds it', async () => {
    render(<Harness />);
    await type('Can you pls convert it to 1NF');
    const steps = await screen.findAllByRole('listitem');
    expect(steps.map(s => s.textContent?.replace('→', '').trim())).toEqual([
      'CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler', '1NF',
    ]);
    // Dependencies are dimmed with an explanatory tooltip; the request itself is not.
    expect(screen.getByTitle('You asked for this').textContent).toBe('1NF');
    expect(screen.getAllByTitle(/Added because 1NF requires it/).length).toBe(4);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(latest!.placedOperationLabels).toEqual(['CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler', '1NF']));
    expect(latest!.nodes.length).toBe(6); // Start + 5
    expect(latest!.edges.length).toBe(5);
  });

  it('Undo in the toast restores the whole previous canvas in one step', async () => {
    render(<Harness />);
    await type('clean the data');
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(latest!.placedOperationLabels.length).toBe(2));
    await type('give me 1NF');
    fireEvent.click(await screen.findByRole('button', { name: 'Replace workflow' }));
    await waitFor(() => expect(latest!.placedOperationLabels.length).toBe(5));
    const calls = (toast.success as any).mock.calls;
    const action = calls[calls.length - 1][1].action;
    act(() => action.onClick());
    expect(latest!.placedOperationLabels).toEqual(['CSV Data Loader', 'Data Cleaner']);
    expect(latest!.edges.length).toBe(2);
  });

  it('Apply & Run builds first, then runs once', async () => {
    render(<Harness />);
    await type('give me 3NF');
    await screen.findByRole('button', { name: /apply & run/i });
    fireEvent.click(screen.getByRole('button', { name: /apply & run/i }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(latest!.placedOperationLabels.slice(-1)[0]).toBe('3NF');
  });

  it('Apply & Run is disabled without a file', async () => {
    render(<Harness hasFiles={false} />);
    await type('give me 1NF');
    const btn = await screen.findByRole('button', { name: /apply & run/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a conflict instead of a plan', async () => {
    render(<Harness />);
    await type('give me BCNF but skip 3NF');
    expect(await screen.findByText(/needs 3NF, which you asked to skip/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^apply/i })).toBeNull();
  });

  it('offers Replace / Extend when the canvas already has nodes', async () => {
    render(<Harness />);
    await type('clean the data');
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(latest!.placedOperationLabels.length).toBe(2));
    await type('give me 1NF');
    expect(await screen.findByRole('button', { name: 'Extend workflow' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Extend workflow' }));
    await waitFor(() => expect(latest!.placedOperationLabels.slice(-1)[0]).toBe('1NF'));
    expect(latest!.placedOperationLabels.filter(l => l === 'Data Cleaner').length).toBe(1);
  });

  it('shows no embeddings label, and keywords still work when the model is unavailable', async () => {
    function Offline() {
      const graph = useWorkflowGraph();
      const nl = useNLWorkflow({ graph, run, hasFiles: true, provider: { name: 'x', cacheKey: 'x', embed: async () => { throw new Error('x'); }, status: async () => ({ ready: false }) } as any });
      return <NLCommandBar nl={nl} />;
    }
    render(<Offline />);
    await type('give me 1NF');
    expect(await screen.findByRole('button', { name: 'Apply' })).toBeTruthy();
    expect(screen.queryByText(/embeddings/i)).toBeNull();
  });
});
