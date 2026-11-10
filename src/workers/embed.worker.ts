/// <reference lib="webworker" />
/**
 * Runs the bundled sentence-embedding model (all-MiniLM-L6-v2, int8) with
 * transformers.js on ONNX/WebAssembly, entirely inside the app. The model files
 * come from `/models` and the WASM runtime from `/ort`, both shipped in the
 * installer; remote model loading is switched off.
 */
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { LOCAL_MODEL_ID } from '../services/nlp/workflow/localModelProvider';

export type EmbedRequest = { id: number; texts: string[] };
export type EmbedResponse = { id: number; vectors: number[][] } | { id: number; error: string };

const base = new URL(import.meta.env.BASE_URL, self.location.href).href;

env.allowRemoteModels = false;
env.allowLocalModels = true;
// A path, not a full URL: transformers.js only probes local files when this is not an http(s) URL.
env.localModelPath = `${new URL(base).pathname}models/`;
env.useBrowserCache = false;
const onnx = env.backends.onnx as unknown as { wasm?: { wasmPaths?: unknown; numThreads?: number; proxy?: boolean } };
if (onnx.wasm) {
  onnx.wasm.wasmPaths = { mjs: `${base}ort/ort-wasm-simd-threaded.mjs`, wasm: `${base}ort/ort-wasm-simd-threaded.wasm` };
  // Single-threaded: multi-threading needs cross-origin isolation, which the webview does not provide.
  onnx.wasm.numThreads = 1;
  onnx.wasm.proxy = false;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let extractor: Promise<FeatureExtractionPipeline> | null = null;

ctx.onmessage = async (event: MessageEvent<EmbedRequest>) => {
  const { id, texts } = event.data;
  try {
    extractor ??= pipeline('feature-extraction', LOCAL_MODEL_ID, { dtype: 'q8', device: 'wasm' }) as Promise<FeatureExtractionPipeline>;
    const out = await (await extractor)(texts, { pooling: 'mean', normalize: true });
    ctx.postMessage({ id, vectors: out.tolist() as number[][] } satisfies EmbedResponse);
  } catch (e) {
    extractor = null; // allow a retry
    ctx.postMessage({ id, error: (e as Error)?.message ?? String(e) } satisfies EmbedResponse);
  }
};
