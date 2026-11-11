/**
 * Glue between the natural-language resolver and the workflow canvas.
 *
 * Side effects (network, notifications, running) live here, outside any state
 * updater. Batch undo restores a snapshot because `graph.undo` removes one
 * node at a time.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notify } from '../services/notify';
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
  /** The workspace the notifications are about. */
  workspaceId?: string;
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

function failedResolution(e: unknown): Resolution {
  return {
    targets: [],
    excluded: [],
    plan: [],
    addedAsDependencies: [],
    options: {},
    confidence: 'none',
    candidates: [],
    source: 'lexical',
    message: `Something went wrong reading that request (${(e as Error)?.message ?? 'unknown error'}). Try rephrasing it.`,
  };
}

let sharedProvider: EmbeddingProvider | null = null;
/** One embedding worker (and one copy of the model in memory) for every workspace tab. */
function getSharedProvider(): EmbeddingProvider {
  sharedProvider ??= createAppProvider();
  return sharedProvider;
}

export function useNLWorkflow({ graph, run, hasFiles, workspaceId, provider: injected }: UseNLWorkflowOptions) {
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
  const [undoSnapshot, setUndoSnapshot] = useState<WorkflowSnapshot | null>(null);
  const [embeddings, setEmbeddings] = useState<EmbeddingStatus>('checking');
  const pendingRun = useRef<number | null>(null);
  const requestId = useRef(0);

  // Probe once; this also warms the model so the first request is fast. The result is kept in `embeddings` for diagnostics; nothing is shown to the user.
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
      } catch (e) {
        // resolve() is meant not to throw; if it does, say so instead of leaving a spinner or an unhandled rejection.
        if (id === requestId.current) setResolution(failedResolution(e));
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    },
    [provider],
  );

  /** Re-plan for one chosen candidate ("Did you mean…"). */
  const pickCandidate = useCallback(
    async (operation: string) => {
      const id = ++requestId.current;
      setBusy(true);
      try {
        const res = await resolve(operation, new NullProvider());
        if (id === requestId.current) setResolution(res);
      } catch (e) {
        if (id === requestId.current) setResolution(failedResolution(e));
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    },
    [],
  );

  const dismiss = useCallback(() => {
    requestId.current++;
    setResolution(null);
    setBusy(false);
  }, []);

  /** Put the canvas back as it was before the last natural-language build, in one step. */
  const undoBuild = useCallback(() => {
    if (!undoSnapshot) return;
    graph.replaceGraph(undoSnapshot.nodes, undoSnapshot.edges, undoSnapshot.nextId);
    setUndoSnapshot(null);
  }, [graph, undoSnapshot]);

  const apply = useCallback(
    (res: Resolution, { run: runAfter, mode = 'replace' }: { run: boolean; mode?: ApplyMode }) => {
      if (res.plan.length === 0) return;
      const known = res.plan.filter(p => OPERATIONS[p]);
      if (known.length !== res.plan.length || new Set(known).size !== known.length) {
        notify('error', 'That request produced an invalid pipeline. Nothing was changed.', workspaceId);
        return;
      }
      const before = graph.serializeSnapshot();
      const placed = graph.placedOperationLabels;
      let toAdd = res.plan;
      if (mode === 'extend' && placed.length > 0) {
        const ext = extensionFor(placed, res.plan);
        if (ext === null) {
          notify('error', 'This request cannot extend the current workflow. Use Replace.', workspaceId);
          return;
        }
        toAdd = ext;
      } else {
        graph.clearGraph();
      }
      graph.addOperationsBatch(toAdd);
      // System notifications cannot carry an in-app button, so undo lives in the command bar.
      setUndoSnapshot(before);
      notify('success', `Pipeline built: ${res.plan.length} steps`, workspaceId);
      if (runAfter) pendingRun.current = res.plan.length;
      setResolution(null);
    },
    [graph, workspaceId],
  );

  // Run once React has committed the new nodes (handleRun reads state from its closure).
  useEffect(() => {
    if (pendingRun.current === null) return;
    if (graph.placedOperationLabels.length >= pendingRun.current) {
      pendingRun.current = null;
      if (hasFiles) run();
      else notify('error', 'Upload a data file to run the pipeline.', workspaceId);
    }
  }, [graph.nodes, graph.placedOperationLabels.length, hasFiles, run, workspaceId]);

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
    canUndoBuild: undoSnapshot !== null,
    undoBuild,
  };
}

export type NLWorkflow = ReturnType<typeof useNLWorkflow>;
