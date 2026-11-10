/**
 * In-process embeddings from a small model that ships inside the app
 * (all-MiniLM-L6-v2, int8, ~23 MB, Apache-2.0). No server, no download, no
 * network: the installer contains the model and everything runs locally.
 *
 * The provider is transport-agnostic: it wraps an `Extractor`, which is the
 * web-worker client in the app (`workerExtractor.ts`) and a direct
 * transformers.js call in Node (evals, tests).
 */
import {
  EmbeddingUnavailableError,
  l2normalize,
  type EmbeddingProvider,
  type EmbedKind,
  type ProviderStatus,
} from './embeddingProvider';

export const LOCAL_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

/** Turns texts into vectors (mean pooled; normalisation is applied again here to be safe). */
export type Extractor = (texts: string[]) => Promise<number[][]>;

export class LocalModelProvider implements EmbeddingProvider {
  readonly name = 'local';
  readonly cacheKey = `${LOCAL_MODEL_ID}|q8`;
  private dimension: number | undefined;

  constructor(private readonly extract: Extractor) {}

  async embed(texts: string[], _kind: EmbedKind): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const vectors = await this.extract(texts);
      if (vectors.length !== texts.length) throw new Error('unexpected number of embeddings');
      this.dimension = vectors[0]?.length;
      return vectors.map(l2normalize);
    } catch (e) {
      throw new EmbeddingUnavailableError(typeof e === 'string' ? e : (e as Error)?.message ?? String(e));
    }
  }

  async status(): Promise<ProviderStatus> {
    try {
      const [v] = await this.embed(['ping'], 'query');
      return { ready: true, model: LOCAL_MODEL_ID, dimension: v?.length ?? this.dimension };
    } catch (e) {
      return { ready: false, detail: (e as Error).message };
    }
  }
}
