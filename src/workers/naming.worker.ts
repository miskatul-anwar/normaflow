/// <reference lib="webworker" />
/**
 * Runs the bundled naming model (SmolLM2-360M-Instruct, 4-bit) with transformers.js on ONNX/WebAssembly, inside the app.
 * Files come from `/models`, the runtime from `/ort`; remote loading is off, so nothing leaves the machine.
 * Requests are answered one relation at a time so the page can show progress.
 */
import { env, pipeline, type TextGenerationPipeline } from '@huggingface/transformers';
import { MODEL_ID, namingMessages } from '../services/naming/namingPrompt';

export type NamingRequest = { id: number; items: Array<{ key: string; columns: string[] }> };
export type NamingResponse =
  | { id: number; key: string; text: string }
  | { id: number; done: true }
  | { id: number; error: string };

const base = new URL(import.meta.env.BASE_URL, self.location.href).href;
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = `${new URL(base).pathname}models/`;
env.useBrowserCache = false;
const onnx = env.backends.onnx as unknown as { wasm?: { wasmPaths?: unknown; numThreads?: number; proxy?: boolean } };
if (onnx.wasm) {
  onnx.wasm.wasmPaths = { mjs: `${base}ort/ort-wasm-simd-threaded.mjs`, wasm: `${base}ort/ort-wasm-simd-threaded.wasm` };
  onnx.wasm.numThreads = 1;
  onnx.wasm.proxy = false;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let generator: Promise<TextGenerationPipeline> | null = null;

ctx.onmessage = async (event: MessageEvent<NamingRequest>) => {
  const { id, items } = event.data;
  try {
    generator ??= pipeline('text-generation', MODEL_ID, { dtype: 'q4', device: 'wasm' }) as Promise<TextGenerationPipeline>;
    const gen = await generator;
    for (const item of items) {
      const out = (await gen(namingMessages(item.columns), { max_new_tokens: 12, do_sample: false })) as Array<{
        generated_text: Array<{ content: string }>;
      }>;
      ctx.postMessage({ id, key: item.key, text: out[0].generated_text.at(-1)?.content ?? '' } satisfies NamingResponse);
    }
    ctx.postMessage({ id, done: true } satisfies NamingResponse);
  } catch (e) {
    generator = null;
    ctx.postMessage({ id, error: (e as Error)?.message ?? String(e) } satisfies NamingResponse);
  }
};
