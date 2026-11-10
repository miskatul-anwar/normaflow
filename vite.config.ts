import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path"; // <-- Import path module

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
/**
 * transformers.js pulls in onnxruntime-web, whose bundle makes Vite emit a 27 MB
 * WebAssembly file. The embedding worker loads its own copy from /ort (set via
 * `wasmPaths`), so the emitted one is never used; drop it from the installer.
 */
const dropUnusedOrtWasm = {
  name: 'drop-unused-ort-wasm',
  generateBundle(_options: unknown, bundle: Record<string, unknown>) {
    for (const name of Object.keys(bundle)) {
      if (/ort-wasm-.*\.wasm$/.test(name)) delete bundle[name];
    }
  },
};

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), dropUnusedOrtWasm],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // <-- This enables @/ alias
    },
  },
  // Workers are created with { type: 'module' }; build them as ES modules so they can
  // lazy-load code (the spreadsheet parser) instead of bundling it into every start.
  worker: { format: 'es' as const },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));