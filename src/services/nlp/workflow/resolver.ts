/**
 * Hybrid resolver: keywords first, embeddings for what the keywords miss.
 * Never throws into the UI; with no embeddings it degrades to keywords only.
 */
import { getAnchorIndex, scoreOperations } from './anchorIndex';
import { EmbeddingUnavailableError, type EmbeddingProvider } from './embeddingProvider';
import { resolveLexical, splitClauses, type Dialect } from './lexicalResolver';
import { planFor, PlanConflictError } from './planner';
import { ALL_OPERATION_NAMES } from '../../../config/operations';

export interface Resolution {
  targets: string[];
  excluded: string[];
  plan: string[];
  addedAsDependencies: string[];
  options: { run?: boolean; dialect?: Dialect };
  confidence: 'high' | 'medium' | 'low' | 'none';
  candidates: { operation: string; score: number }[];
  source: 'lexical' | 'embedding' | 'mixed';
  message?: string;
}

/** Decision thresholds on cosine similarity. */
export interface Thresholds {
  accept: number;
  margin: number;
  floor: number;
}
/**
 * Tuned for the bundled all-MiniLM-L6-v2 model with `npm run bench:nl -- --sweep`: the
 * middle of a plateau where plan accuracy is 94% and all junk is rejected. Tuned and scored
 * on the same 77 cases, so expect real-world accuracy to be somewhat lower.
 */
export const DEFAULT_THRESHOLDS: Thresholds = { accept: 0.4, margin: 0.02, floor: 0.3 };

export type ResolveMode = 'hybrid' | 'lexical' | 'embedding';

export interface ResolveOptions {
  mode?: ResolveMode;
  thresholds?: Thresholds;
}

const EMPTY: Resolution = {
  targets: [],
  excluded: [],
  plan: [],
  addedAsDependencies: [],
  options: {},
  confidence: 'none',
  candidates: [],
  source: 'lexical',
};

export async function resolve(
  text: string,
  provider: EmbeddingProvider,
  { mode = 'hybrid', thresholds = DEFAULT_THRESHOLDS }: ResolveOptions = {},
): Promise<Resolution> {
  const lexical = mode === 'embedding' ? { targets: [], excluded: [], pending: [], options: resolveLexical(text).options, confidence: 'none' as const } : resolveLexical(text);

  const targets = [...lexical.targets];
  const excluded = [...lexical.excluded];
  let candidates: Resolution['candidates'] = [];
  let source: Resolution['source'] = 'lexical';
  let confidence: Resolution['confidence'] = lexical.confidence;
  let note: string | undefined;

  const needEmbeddings =
    mode !== 'lexical' && (lexical.confidence === 'none' || lexical.pending.length > 0 || lexical.confidence === 'medium');

  if (needEmbeddings) {
    const queries = lexical.confidence === 'none' || lexical.pending.length === 0
      ? [splitClauses(text).join(' ')].filter(Boolean)
      : lexical.pending;
    try {
      const index = await getAnchorIndex(provider);
      const vectors = await provider.embed(queries, 'query');
      let accepted = 0;
      let sawLow = false;
      vectors.forEach(v => {
        const ranked = scoreOperations(v, index);
        const [first, second] = ranked;
        candidates = ranked.slice(0, 3);
        if (!first || first.score < thresholds.floor) return;
        const margin = first.score - (second?.score ?? 0);
        if (first.score >= thresholds.accept && margin >= thresholds.margin) {
          if (!targets.includes(first.operation) && !excluded.includes(first.operation)) targets.push(first.operation);
          accepted++;
        } else {
          sawLow = true;
        }
      });
      if (accepted > 0) {
        source = lexical.targets.length > 0 ? 'mixed' : 'embedding';
        // A lexical-medium result confirmed by embeddings keeps its level; a fresh embedding match is medium.
        if (confidence === 'none' || confidence === 'high') confidence = 'medium';
      } else if (lexical.targets.length === 0) {
        confidence = sawLow ? 'low' : 'none';
      }
    } catch (e) {
      if (!(e instanceof EmbeddingUnavailableError)) {
        note = `Embedding lookup failed (${(e as Error).message}); using keywords only.`;
      } else if (lexical.confidence === 'none') {
        note = 'Embeddings are offline; only keyword matching is available.';
      }
    }
  }

  const base: Resolution = { ...EMPTY, options: lexical.options, candidates, source, confidence, excluded };

  const both = targets.filter(t => excluded.includes(t));
  if (both.length > 0) {
    return { ...base, targets, confidence: 'low', message: `You both asked for and asked to skip: ${both.join(', ')}.` };
  }
  if (targets.length === 0) {
    const msg =
      note ??
      (candidates.length > 0 && confidence === 'low'
        ? 'I am not sure what you mean. Did you mean one of these?'
        : `I couldn't match that to an operation. Available: ${ALL_OPERATION_NAMES.join(', ')}.`);
    return { ...base, confidence: confidence === 'low' ? 'low' : 'none', message: msg };
  }

  try {
    const { plan, addedAsDependencies } = planFor(targets, new Set(excluded));
    return { ...base, targets, plan, addedAsDependencies, message: note };
  } catch (e) {
    if (e instanceof PlanConflictError) {
      const why = e.excluded
        .map(x => `${(e.neededBy[x] ?? e.targets).join(' and ')} needs ${x}, which you asked to skip`)
        .join('; ');
      return { ...base, targets, confidence: 'low', message: `${why}.` };
    }
    throw e;
  }
}
