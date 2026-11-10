/**
 * Glue between the natural-language resolver and the workflow canvas.
 *
 * Side effects (network, toasts, running) live here, outside any state
 * updater. Batch undo restores a snapshot because `graph.undo` removes one
 * node at a time.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { OPERATIONS } from '../config/operations';
import { resolve, NullProvider, type EmbeddingProvider, type Resolution } from '../services/nlp/workflow';
import { createAppProvider } from '../services/nlp/workflow/workerExtractor';
import type { useWorkflowGraph, WorkflowSnapshot } from './useWorkflowGraph';

type Graph = ReturnType<typeof useWorkflowGraph>;

export type EmbeddingStatus = 'checking' | 'ready' | 'offline';
export type ApplyMode = 'replace' | 'extend';

export interface UseNLWorkflowOptions {
  graph: Graph;
  /** Runs the pipeline currently on the canvas. */
  run: () => void;
  hasFiles: boolean;
  /** Override for tests. */
  provider?: EmbeddingProvider;
}

/** Operations still missing from the canvas, if the plan can simply be appended. */
export function extensionFor(placed: string[], plan: string[]): string[] | null {
  const missing = plan.filter(p => !placed.includes(p));
  const lastOrder = placed.reduce((m, p) => Math.max(m, OPERATIONS[p]?.order ?? 0), 0);
  const placedInPlan = placed.every(p => plan.includes(p));
  if (!placedInPlan) return null;
  return missing.every(m => OPERATIONS[m].order > lastOrder) ? missing : null;
}

let sharedProvider: EmbeddingProvider | null = null;
/** One embedding worker (and one copy of the model in memory) for every workspace tab. */
function getSharedProvider(): EmbeddingProvider {
  sharedProvider ??= createAppProvider();
  return sharedProvider;
}

export function useNLWorkflow({ graph, run, hasFiles, provider: injected }: UseNLWorkflowOptions) {
  const provider = useMemo<EmbeddingProvider>(() => {
    if (injected) return injected;
    try {
      return getSharedProvider();
    } catch {
      return new NullProvider();
    }
  }, [injected]);

  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [embeddings, setEmbeddings] = useState<EmbeddingStatus>('checking');
  const pendingRun = useRef<number | null>(null);
  const requestId = useRef(0);

  // Probe once; this also warms the model so the first request is fast. Failure only flips the badge.
  useEffect(() => {
    let cancelled = false;
    void provider.status().then(s => {
      if (!cancelled) setEmbeddings(s.ready ? 'ready' : 'offline');
    });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const submit = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const id = ++requestId.current;
      setQuery(clean);
      setBusy(true);
      try {
        const res = await resolve(clean, provider);
        if (id !== requestId.current) return; // a newer request superseded this one
        setResolution(res);
        if (res.source === 'lexical' && res.confidence === 'none') setEmbeddings(e => (e === 'checking' ? 'offline' : e));
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    },
    [provider],
  );

  /** Re-plan for one chosen candidate ("Did you mean…"). */
  const pickCandidate = useCallback(
    async (operation: string) => {
      setBusy(true);
      try {
        setResolution(await resolve(operation, new NullProvider()));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const dismiss = useCallback(() => {
    requestId.current++;
    setResolution(null);
    setBusy(false);
  }, []);

  const restore = useCallback(
    (snapshot: WorkflowSnapshot) => {
      graph.replaceGraph(snapshot.nodes, snapshot.edges, snapshot.nextId);
    },
    [graph],
  );

  const apply = useCallback(
    (res: Resolution, { run: runAfter, mode = 'replace' }: { run: boolean; mode?: ApplyMode }) => {
      if (res.plan.length === 0) return;
      const before = graph.serializeSnapshot();
      const placed = graph.placedOperationLabels;
      let toAdd = res.plan;
      if (mode === 'extend' && placed.length > 0) {
        const ext = extensionFor(placed, res.plan);
        if (ext === null) {
          toast.error('This request cannot extend the current workflow. Use Replace.');
          return;
        }
        toAdd = ext;
      } else {
        graph.clearGraph();
      }
      graph.addOperationsBatch(toAdd);
      toast.success(`Pipeline built: ${res.plan.length} steps`, {
        action: { label: 'Undo', onClick: () => restore(before) },
      });
      if (runAfter) pendingRun.current = res.plan.length;
      setResolution(null);
    },
    [graph, restore],
  );

  // Run once React has committed the new nodes (handleRun reads state from its closure).
  useEffect(() => {
    if (pendingRun.current === null) return;
    if (graph.placedOperationLabels.length >= pendingRun.current) {
      pendingRun.current = null;
      if (hasFiles) run();
      else toast.error('Upload a CSV file to run the pipeline.');
    }
  }, [graph.nodes, graph.placedOperationLabels.length, hasFiles, run]);

  return {
    query,
    resolution,
    busy,
    embeddings,
    hasNodes: graph.placedOperationLabels.length > 0,
    placed: graph.placedOperationLabels,
    hasFiles,
    submit,
    pickCandidate,
    apply,
    dismiss,
  };
}

export type NLWorkflow = ReturnType<typeof useNLWorkflow>;
