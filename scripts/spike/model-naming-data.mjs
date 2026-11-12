// Spike: does showing the model facts about the column DATA improve entity names?
//
//   MODELS_DIR=/tmp/t5 [CRYPTIC=1] node scripts/spike/model-naming-data.mjs <model-dir> <variant> <dir-of-csvs...>
//
// Variants (SmolLM2-360M-Instruct, same five-example few-shot chat as model-naming.mjs, greedy, 12 tokens):
//   cols      column names only (the shipped prompt; baseline)
//   distinct  each column with up to 3 distinct values
//   types     each column with an inferred type and whether it repeats
//   both      distinct values and types
// CRYPTIC=1 replaces every header of the table under test (and of the examples) with c1, c2, ... so that only the data
// can say what the table is about.
import { pipeline, env } from '@huggingface/transformers';
import fs from 'node:fs';
import path from 'node:path';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = `${process.env.MODELS_DIR ?? '/tmp/t5'}/`;

const [model, variant, ...dirs] = process.argv.slice(2);
const CRYPTIC = process.env.CRYPTIC === '1';

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}

const kind = vals => {
  const v = vals.filter(x => x !== '');
  if (!v.length) return 'empty';
  if (v.every(x => /^-?\d+$/.test(x))) return 'integer';
  if (v.every(x => /^-?\d*\.\d+$/.test(x))) return 'decimal';
  if (v.every(x => /^\d{4}-\d{2}-\d{2}/.test(x))) return 'date';
  if (v.every(x => /@/.test(x))) return 'email';
  return 'text';
};

// One column's facts, from up to 200 rows.
function describe(header, rows) {
  return header.map((name, i) => {
    const vals = rows.slice(0, 200).map(r => r[i] ?? '');
    const distinct = [...new Set(vals)].filter(x => x !== '');
    const unique = distinct.length === vals.filter(x => x !== '').length;
    const shown = distinct.slice(0, 3).map(x => (x.length > 24 ? `${x.slice(0, 24)}…` : x)).join(' | ');
    const t = `${kind(vals)}, ${unique ? 'all different' : 'repeats'}`;
    if (variant === 'distinct') return `- ${name}: ${shown}`;
    if (variant === 'types') return `- ${name} (${t})`;
    if (variant === 'both') return `- ${name} (${t}): ${shown}`;
    return name;
  });
}

const ask = (header, rows) => {
  const body = variant === 'cols' ? `Database table columns: ${header.join(', ')}` : `Database table columns:\n${describe(header, rows).join('\n')}`;
  return `${body}\n\nName this table with one singular noun phrase of one to three words. Reply with only the name.`;
};

// Worked examples, from unrelated domains. Each has a few rows so the facts above can be computed.
const EXAMPLES = [
  [['emp_no', 'first_name', 'last_name', 'hire_date', 'salary'], [['1001', 'Ana', 'Ruiz', '2019-03-01', '52000'], ['1002', 'Raj', 'Shah', '2020-07-15', '61000'], ['1003', 'Li', 'Wei', '2018-11-30', '52000'], ['1004', 'Ana', 'Berg', '2021-01-04', '58000']], 'Employee'],
  [['order_id', 'product_id', 'quantity', 'unit_price'], [['5001', 'P10', '2', '9.99'], ['5001', 'P22', '1', '24.50'], ['5002', 'P10', '5', '9.99'], ['5003', 'P31', '1', '4.00']], 'Order line'],
  [['isbn', 'title', 'author', 'publisher'], [['978-0-13', 'Compilers', 'Aho', 'Pearson'], ['978-0-26', 'Algorithms', 'Cormen', 'MIT Press'], ['978-0-20', 'Patterns', 'Gamma', 'Pearson'], ['978-1-49', 'Data Systems', 'Kleppmann', "O'Reilly"]], 'Book'],
  [['student_id', 'course_id', 'grade'], [['S1', 'C1', 'A'], ['S1', 'C2', 'B+'], ['S2', 'C1', 'A-'], ['S3', 'C3', 'B']], 'Enrollment'],
  [['dept_code', 'dept_name', 'building'], [['HR', 'Human Resources', 'North'], ['ENG', 'Engineering', 'East'], ['FIN', 'Finance', 'North'], ['OPS', 'Operations', 'South']], 'Department'],
];
const cryptic = h => h.map((_, i) => `c${i + 1}`);
const messages = (header, rows) => [
  { role: 'system', content: 'You name database tables.' },
  ...EXAMPLES.flatMap(([h, r, n]) => [{ role: 'user', content: ask(CRYPTIC ? cryptic(h) : h, r) }, { role: 'assistant', content: n }]),
  { role: 'user', content: ask(CRYPTIC ? cryptic(header) : header, rows) },
];

const TRUTH = {
  album: ['album'], artist: ['artist'], customer: ['customer', 'client'], employee: ['employee', 'staff'], genre: ['genre'],
  invoice: ['invoice', 'bill'], invoiceline: ['invoice line', 'invoice item', 'line item'], mediatype: ['media type'],
  playlist: ['playlist'], playlisttrack: ['playlist track', 'playlist item', 'playlist entry', 'playlist song'], track: ['track', 'song'],
  categories: ['category', 'product category'], customers: ['customer'], employeeterritories: ['employee territory', 'territory assignment', 'employee-territory'],
  employees: ['employee'], order_details: ['order detail', 'order line', 'order item', 'line item'], orders: ['order'], products: ['product'],
  regions: ['region'], shippers: ['shipper', 'shipping company'], suppliers: ['supplier', 'vendor'], territories: ['territory'],
};
const tidy = a => a.toLowerCase().replace(/["'.]/g, '').replace(/\s+/g, ' ').trim();

const gen = await pipeline('text-generation', model, { dtype: 'q4' });
let hit = 0, total = 0;
for (const dir of dirs) {
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.csv')).sort()) {
    const [header, ...rows] = parseCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
    const t0 = Date.now();
    const answer = (await gen(messages(header, rows), { max_new_tokens: 12, do_sample: false }))[0].generated_text.at(-1).content;
    const ok = (TRUTH[f.replace('.csv', '').toLowerCase()] ?? []).includes(tidy(answer));
    total++;
    if (ok) hit++;
    console.log(f.replace('.csv', '').padEnd(22), ok ? 'OK ' : '-- ', JSON.stringify(answer.trim()), `${Date.now() - t0} ms`);
  }
}
console.log(`${variant}${CRYPTIC ? ' (cryptic headers)' : ''}: ${hit}/${total}`);
