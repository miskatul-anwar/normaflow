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

// ---- Relation-naming model (SmolLM2-360M-Instruct, 4-bit, Apache-2.0) ---------------------------------------------
// About 373 MB, too large to commit (GitHub rejects files over 100 MB), so it is fetched once, checked against the
// SHA-256 sums below, and ignored by git. It ships inside the installer like the embedding model and is loaded from
// disk at run time with remote loading off; nothing is downloaded when the app runs.
// Set NF_REQUIRE_NAMING_MODEL=1 (release builds) to fail the build if it cannot be obtained; otherwise a warning is printed
// and relations are left "unnamed" in that build.
import { mkdirSync as mk, createWriteStream, renameSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { pipeline as pipe } from 'node:stream/promises';
import { Readable } from 'node:stream';

const NAMING_REPO = 'HuggingFaceTB/SmolLM2-360M-Instruct';
const NAMING_DIR = `public/models/${NAMING_REPO}`;
const NAMING_FILES = {
  'config.json': '224f72354f10d617a359cc82ad15a3c96e866b9b2ffadb81997eeea9e88e22ee',
  'generation_config.json': '87b916edaaab66b3899b9d0dd0752727dff6666686da0504d89ae0a6e055a013',
  'tokenizer.json': '9ca9acddb6525a194ec8ac7a87f24fbba7232a9a15ffa1af0c1224fcd888e47c',
  'tokenizer_config.json': '4ec77d44f62efeb38d7e044a1db318f6a939438425312dfa333b8382dbad98df',
  'special_tokens_map.json': '2b7379f3ae813529281a5c602bc5a11c1d4e0a99107aaa597fe936c1e813ca52',
  'onnx/model_q4.onnx': 'a4ffda96e65beafc6f6cef0cbcf9fdc1cbdd79c230906bf3897d190547c7a596',
};

const sha = file =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });

async function ensureNamingModel() {
  for (const [name, want] of Object.entries(NAMING_FILES)) {
    const dest = `${NAMING_DIR}/${name}`;
    if (existsSync(dest) && (await sha(dest)) === want) continue;
    mk(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
    console.log(`fetching ${NAMING_REPO}/${name}`);
    const res = await fetch(`https://huggingface.co/${NAMING_REPO}/resolve/main/${name}`);
    if (!res.ok || !res.body) throw new Error(`${name}: HTTP ${res.status}`);
    const tmp = `${dest}.part`;
    await pipe(Readable.fromWeb(res.body), createWriteStream(tmp));
    const got = await sha(tmp);
    if (got !== want) throw new Error(`${name}: checksum mismatch (${got})`);
    renameSync(tmp, dest);
    console.log(`  ok, ${(statSync(dest).size / 1e6).toFixed(1)} MB`);
  }
}

try {
  await ensureNamingModel();
} catch (e) {
  const msg = `naming model unavailable: ${e.message}`;
  if (process.env.NF_REQUIRE_NAMING_MODEL === '1') {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`${msg}\n  This build leaves relations "unnamed". Re-run with network access to include the model.`);
}
