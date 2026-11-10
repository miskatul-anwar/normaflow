/** transformers.js in Node, loading the bundled model from `public/models` (evals and tests only). */
import path from 'node:path';
import { LOCAL_MODEL_ID, LocalModelProvider, type Extractor } from '../services/nlp/workflow/localModelProvider';

let cached: Promise<(texts: string[]) => Promise<number[][]>> | null = null;

export function nodeExtractor(): Extractor {
  cached ??= (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = `${path.resolve('public/models')}/`;
    const fe = await pipeline('feature-extraction', LOCAL_MODEL_ID, { dtype: 'q8' });
    return async (texts: string[]) => {
      const out = await fe(texts, { pooling: 'mean', normalize: true });
      return out.tolist() as number[][];
    };
  })();
  return async texts => (await cached!)(texts);
}

export const nodeLocalProvider = () => new LocalModelProvider(nodeExtractor());
