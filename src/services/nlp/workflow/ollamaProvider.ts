/**
 * Ollama embedding providers (loopback only).
 *
 *  - Desktop app: the webview calls the Rust command `embed_texts`, which talks
 *    to Ollama. No CORS, and the strict CSP is untouched.
 *  - Browser dev (`npm run dev`): `fetch('/ollama/api/embed')` through the Vite
 *    dev proxy.
 */
import {
  EmbeddingUnavailableError,
  formatInput,
  l2normalize,
  NullProvider,
  type EmbeddingProvider,
  type EmbedKind,
  type Framing,
  type ProviderStatus,
} from './embeddingProvider';

/**
 * Newest text-only EmbeddingGemma on Ollama (`embeddinggemma-2:270m`, verified
 * on ollama.com/library), then the original model as fallback.
 */
export const DEFAULT_EMBED_MODELS = ['embeddinggemma-2:270m', 'embeddinggemma'];
export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

/** True for http URLs to localhost, 127.x.x.x or [::1] without credentials. */
export function isLoopbackUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' || u.username || u.password) return false;
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}

export type Transport = (baseUrl: string, model: string, inputs: string[]) => Promise<number[][]>;

export const tauriTransport: Transport = async (baseUrl, model, inputs) => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<number[][]>('embed_texts', { baseUrl, model, inputs });
};

/** Browser dev only: goes through the Vite proxy so no CORS setup is needed. */
export const devProxyTransport: Transport = async (_baseUrl, model, inputs) => {
  const resp = await fetch('/ollama/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: inputs }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`Ollama returned ${resp.status}`);
  return ((await resp.json()) as { embeddings: number[][] }).embeddings;
};

export interface OllamaOptions {
  transport: Transport;
  baseUrl?: string;
  models?: string[];
  framing?: Framing;
}

export class OllamaProvider implements EmbeddingProvider {
  readonly name = 'ollama';
  private readonly transport: Transport;
  private readonly baseUrl: string;
  private readonly models: string[];
  private readonly framing: Framing;
  private working: string | null = null;
  private dimension: number | undefined;

  constructor(options: OllamaOptions) {
    this.transport = options.transport;
    this.baseUrl = options.baseUrl ?? DEFAULT_OLLAMA_URL;
    this.models = options.models?.length ? options.models : DEFAULT_EMBED_MODELS;
    this.framing = options.framing ?? 'classification';
    if (!isLoopbackUrl(this.baseUrl)) throw new Error('Ollama URL must be a loopback address');
  }

  get cacheKey(): string {
    return `${this.working ?? this.models[0]}|${this.framing}`;
  }

  async embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
    if (texts.length === 0) return [];
    const inputs = texts.map(t => formatInput(t, kind, this.framing));
    const candidates = this.working ? [this.working] : this.models;
    let lastError = 'unknown error';
    for (const model of candidates) {
      try {
        const vectors = await this.transport(this.baseUrl, model, inputs);
        if (vectors.length !== inputs.length) throw new Error('unexpected number of embeddings');
        this.working = model;
        this.dimension = vectors[0]?.length;
        return vectors.map(l2normalize);
      } catch (e) {
        lastError = typeof e === 'string' ? e : (e as Error)?.message ?? String(e);
      }
    }
    throw new EmbeddingUnavailableError(lastError);
  }

  async status(): Promise<ProviderStatus> {
    try {
      const [v] = await this.embed(['ping'], 'query');
      return { ready: true, model: this.working ?? undefined, dimension: v?.length ?? this.dimension };
    } catch (e) {
      return { ready: false, detail: (e as Error).message };
    }
  }
}

/**
 * Picks the right provider for the environment: the Rust command inside the
 * desktop app, the Vite dev proxy in `npm run dev`, and keywords only in a
 * plain browser build (nothing could answer, and a failing fetch would only
 * add console errors).
 */
export function createOllamaProvider(options: Omit<OllamaOptions, 'transport'> = {}): EmbeddingProvider {
  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  if (!inTauri && !import.meta.env?.DEV) return new NullProvider();
  return new OllamaProvider({ ...options, transport: inTauri ? tauriTransport : devProxyTransport });
}
