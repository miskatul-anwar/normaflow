/** Mermaid is large, so it is loaded when a crow's-foot diagram is first drawn. */
let mermaidReady: Promise<typeof import('mermaid').default> | null = null;

function load() {
  mermaidReady ??= import('mermaid').then(m => {
    // Diagrams are built from untrusted CSV headers: never let Mermaid run scripts or raw HTML.
    m.default.initialize({ startOnLoad: false, securityLevel: 'strict' });
    return m.default;
  });
  return mermaidReady;
}

let counter = 0;
export async function renderMermaid(source: string): Promise<string> {
  const mermaid = await load();
  const { svg } = await mermaid.render(`erd-preview-${++counter}`, source);
  return svg;
}
