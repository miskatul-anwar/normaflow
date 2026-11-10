/**
 * Accuracy of the natural-language workflow builder.
 *
 *   npm run bench:nl                    # keywords only + fake embeddings (offline)
 *   npm run bench:nl -- --ollama        # also use a local Ollama (127.0.0.1:11434)
 *   npm run bench:nl -- --ollama --model embeddinggemma --framing retrieval --sweep
 *   npm run bench:nl -- --failures
 */
import { NL_CASES } from '../src/eval/nlWorkflowCases';
import { evaluateNL } from '../src/eval/nlWorkflow';
import { FakeEmbeddingProvider, NullProvider, type Framing } from '../src/services/nlp/workflow/embeddingProvider';
import { OllamaProvider, DEFAULT_EMBED_MODELS, DEFAULT_OLLAMA_URL } from '../src/services/nlp/workflow/ollamaProvider';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../src/services/nlp/workflow/resolver';

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
for (const m of ['log', 'info', 'debug', 'warn'] as const) console[m] = () => undefined;

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const line = (label: string, r: Awaited<ReturnType<typeof evaluateNL>>) =>
  `${label.padEnd(34)} plan ${pct(r.planAccuracy).padStart(4)}  targets ${pct(r.targetAccuracy).padStart(4)}  junk rejected ${r.junkTotal - r.junkAccepted}/${r.junkTotal}  ` +
  Object.entries(r.byKind).map(([k, v]) => `${k} ${v.ok}/${v.total}`).join(' ');

const out: string[] = [`${NL_CASES.length} cases`];
const failures: string[] = [];

const lexical = await evaluateNL(new NullProvider(), 'lexical');
out.push(line('keywords only', lexical));
if (flag('failures')) lexical.failures.forEach(f => failures.push(`  [keywords] ${f.case.kind}: "${f.case.text}" -> ${JSON.stringify(f.got)} (want ${JSON.stringify(f.case.targets)})`));

const fake = await evaluateNL(new FakeEmbeddingProvider(), 'hybrid', { accept: 0.3, margin: 0.02, floor: 0.2 });
out.push(line('hybrid, fake bag-of-words vectors', fake));

if (flag('ollama')) {
  const framing = (opt('framing') ?? 'classification') as Framing;
  const models = opt('model') ? [opt('model')!] : DEFAULT_EMBED_MODELS;
  const transport = async (baseUrl: string, model: string, inputs: string[]) => {
    const resp = await fetch(`${baseUrl}/api/embed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: inputs }) });
    if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
    return ((await resp.json()) as { embeddings: number[][] }).embeddings;
  };
  const provider = new OllamaProvider({ transport, models, framing, baseUrl: opt('url') ?? DEFAULT_OLLAMA_URL });
  const status = await provider.status();
  out.push(`ollama: ${status.ready ? `${status.model} (${status.dimension}-dim), framing=${framing}` : `unavailable (${status.detail})`}`);
  if (status.ready) {
    const grid: Thresholds[] = flag('sweep')
      ? [0.4, 0.5, 0.55, 0.6, 0.65, 0.7].flatMap(accept => [0, 0.02, 0.04, 0.06].map(margin => ({ accept, margin, floor: Math.max(0.3, accept - 0.15) })))
      : [DEFAULT_THRESHOLDS];
    let best: { t: Thresholds; r: Awaited<ReturnType<typeof evaluateNL>>; score: number } | null = null;
    for (const t of grid) {
      const emb = await evaluateNL(provider, 'embedding', t);
      const hyb = await evaluateNL(provider, 'hybrid', t);
      // Prefer plan accuracy; break ties toward rejecting junk.
      const score = hyb.planAccuracy + 0.5 * hyb.rejectionRate;
      if (flag('sweep')) out.push(line(`  accept=${t.accept} margin=${t.margin} floor=${t.floor.toFixed(2)} (hybrid)`, hyb));
      if (!best || score > best.score) best = { t, r: hyb, score };
      if (!flag('sweep')) out.push(line('embeddings only', emb), line('hybrid', hyb));
    }
    if (best && flag('sweep')) {
      out.push(`best thresholds: ${JSON.stringify(best.t)}`);
      out.push(line('embeddings only (best)', await evaluateNL(provider, 'embedding', best.t)));
      out.push(line('hybrid (best)', best.r));
      if (flag('failures')) best.r.failures.forEach(f => failures.push(`  [hybrid] ${f.case.kind}: "${f.case.text}" -> ${JSON.stringify(f.got)} (want ${JSON.stringify(f.case.targets)})`));
    }
  }
}
process.stdout.write(`${[...out, ...failures].join('\n')}\n`);
