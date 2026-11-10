/**
 * Evaluation harness: precision / recall / F1 for primary keys, foreign keys
 * and recovered relations on ground-truth databases, plus runtime.
 *
 *   npm run bench            # default scales
 *   npm run bench -- --scale 5 --json
 */
import { retail, university } from '../src/eval/datasets';
import { evaluate } from '../src/eval/harness';

const argv = process.argv.slice(2);
const scale = Number(argv[argv.indexOf('--scale') + 1]) || 1;
const json = argv.includes('--json');
for (const m of ['log', 'info', 'debug', 'warn'] as const) console[m] = () => undefined;

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const reports = [];
for (const ds of [retail(scale), university(scale)]) reports.push(await evaluate(ds));

if (json) process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
else {
  const line = (r: (typeof reports)[number]) =>
    `${r.dataset.padEnd(14)} rows=${String(r.rows).padStart(5)}  ` +
    `PK P/R ${pct(r.primaryKeys.precision)}/${pct(r.primaryKeys.recall)}  ` +
    `FK P/R ${pct(r.foreignKeys.precision)}/${pct(r.foreignKeys.recall)}  ` +
    `relations P/R ${pct(r.recoveredRelations.precision)}/${pct(r.recoveredRelations.recall)}  ` +
    `time ${r.separateMs}ms / ${r.denormalizedMs}ms`;
  process.stdout.write(`${reports.map(line).join('\n')}\n`);
}
