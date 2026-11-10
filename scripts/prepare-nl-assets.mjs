// Copies the ONNX WebAssembly runtime from node_modules into public/ort so the
// installer carries it (no CDN). The embedding model itself is committed under
// public/models. Runs before `dev`, `build` and `tauri` via npm pre-scripts.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const FILES = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];
const src = 'node_modules/onnxruntime-web/dist';
mkdirSync('public/ort', { recursive: true });
for (const f of FILES) {
  if (!existsSync(`${src}/${f}`)) {
    console.error(`missing ${src}/${f}; run npm install`);
    process.exit(1);
  }
  copyFileSync(`${src}/${f}`, `public/ort/${f}`);
}

const MODEL = 'public/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx';
const SHA256 = 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1';
if (!existsSync(MODEL)) {
  console.error(`missing ${MODEL}`);
  process.exit(1);
}
const got = createHash('sha256').update(readFileSync(MODEL)).digest('hex');
if (got !== SHA256) {
  console.error(`model checksum mismatch: ${got}`);
  process.exit(1);
}
