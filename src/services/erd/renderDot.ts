/** Graphviz compiled to WebAssembly and bundled with the app: no system install, no network. */
import type { Graphviz } from '@hpcc-js/wasm-graphviz';

let instance: Promise<Graphviz> | null = null;

export async function renderDot(dot: string, engine: 'neato' | 'fdp' | 'dot' = 'neato'): Promise<string> {
  instance ??= import('@hpcc-js/wasm-graphviz').then(m => m.Graphviz.load()).catch(e => {
    instance = null; // allow a retry
    throw e;
  });
  const gv = await instance;
  return gv.layout(dot, 'svg', engine);
}
