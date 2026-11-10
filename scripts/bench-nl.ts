/**
 * Accuracy of the natural-language workflow builder.
 *
 *   npm run bench:nl                 # keywords, fake vectors, and the bundled model
 *   npm run bench:nl -- --sweep      # also search the decision thresholds
 *   npm run bench:nl -- --failures   # list the wrong answers
 */
import { NL_CASES } from '../src/eval/nlWorkflowCases';
import { evaluateNL } from '../src/eval/nlWorkflow';
import { FakeEmbeddingProvider, NullProvider } from '../src/services/nlp/workflow/embeddingProvider';
import { nodeLocalProvider } from '../src/eval/nodeExtractor';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../src/services/nlp/workflow/resolver';

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
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

if (!flag('no-model')) {
  const provider = nodeLocalProvider();
  const status = await provider.status();
  out.push(`bundled model: ${status.ready ? `${status.model} (${status.dimension}-dim)` : `unavailable (${status.detail})`}`);
  if (status.ready) {
    const grid: Thresholds[] = flag('sweep')
      ? [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6].flatMap(accept => [0, 0.02, 0.04, 0.06, 0.08].map(margin => ({ accept, margin, floor: Math.max(0.2, accept - 0.1) })))
      : [DEFAULT_THRESHOLDS];
    let best: { t: Thresholds; r: Awaited<ReturnType<typeof evaluateNL>>; score: number } | null = null;
    for (const t of grid) {
      const hyb = await evaluateNL(provider, 'hybrid', t);
      // Prefer plan accuracy; junk rejection counts too (a wrong pipeline is worse than no pipeline).
      const score = hyb.planAccuracy + hyb.rejectionRate;
      if (flag('sweep')) out.push(line(`  accept=${t.accept} margin=${t.margin} floor=${t.floor.toFixed(2)}`, hyb));
      if (!best || score > best.score) best = { t, r: hyb, score };
    }
    const t = best!.t;
    if (flag('sweep')) out.push(`best thresholds: ${JSON.stringify(t)}`);
    out.push(line('embeddings only', await evaluateNL(provider, 'embedding', t)));
    out.push(line('hybrid (keywords + embeddings)', best!.r));
    if (flag('failures')) best!.r.failures.forEach(f => failures.push(`  [hybrid] ${f.case.kind}: "${f.case.text}" -> ${JSON.stringify(f.got)} (want ${JSON.stringify(f.case.targets)})`));
  }
}
process.stdout.write(`${[...out, ...failures].join('\n')}\n`);
