// Spike for docs/notes/model-naming-spike.md: can a small bundled text-to-text model name a relation?
//
//   node scripts/spike/model-naming.mjs <model-dir-name> <prompt> <dir-of-csvs...>
//
// Models are read from MODELS_DIR (default /tmp/t5), laid out like Hugging Face repos
// (<model>/config.json, tokenizer.json, onnx/encoder_model_quantized.onnx,
// onnx/decoder_model_merged_quantized.onnx), for example from Xenova/flan-t5-base.
// Encoder-decoder models (T5) use prompts shots | q1 | q2 | q4 | q5; decoder-only chat models (SmolLM2, Qwen) are detected by the
// missing encoder file and use chat | chatshots, with onnx/model_q4.onnx. Prints the top answer per CSV (the file name is never shown to the model).
import { pipeline, env } from '@huggingface/transformers';
import fs from 'node:fs';
import path from 'node:path';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = `${process.env.MODELS_DIR ?? '/tmp/t5'}/`;

const [model, variant, ...dirs] = process.argv.slice(2);
const read = f => fs.readFileSync(f, 'utf8').split(/\r?\n/);
const header = f => read(f)[0].split(',');
const sample = f => read(f).slice(1, 3).map(r => r.slice(0, 120));

const SHOTS = [
  ['emp_no, first_name, last_name, hire_date, salary', 'Employee'],
  ['order_id, product_id, quantity, unit_price', 'Order line'],
  ['isbn, title, author, publisher', 'Book'],
  ['student_id, course_id, grade', 'Enrollment'],
  ['dept_code, dept_name, building', 'Department'],
];
const PROMPTS = {
  shots: h => `${SHOTS.map(([c, n]) => `Columns: ${c}\nTable: ${n}`).join('\n\n')}\n\nColumns: ${h.join(', ')}\nTable:`,
  q1: h => `A database table has these columns: ${h.join(', ')}.\nWhat kind of thing does one row of this table describe? Answer with one or two words.`,
  q2: h => `Question: Here are the column names of a database table: ${h.join(', ')}. What is a good name for this table (a singular noun)?\nAnswer:`,
  q4: h => `Give a short, clear name for a database table that has these columns: ${h.join(', ')}. Reply with just the name, in singular.`,
  q5: (h, ex) => `Here is a database table.\nColumns: ${h.join(', ')}\nSample rows:\n${ex.join('\n')}\n\nWhat real-world thing does one row describe? Reply with a single noun phrase of one to three words.`,
};

const MODELS = process.env.MODELS_DIR ?? '/tmp/t5';
const decoderOnly = !fs.existsSync(`${MODELS}/${model}/onnx/encoder_model_quantized.onnx`);
const ask = (h, ex) => `Database table columns: ${h.join(', ')}\n${ex.length ? `Sample rows:\n${ex.join('\n')}\n` : ''}\nName this table with one singular noun phrase of one to three words. Reply with only the name.`;
const CHAT = {
  chat: (h, ex) => [{ role: 'system', content: 'You name database tables.' }, { role: 'user', content: ask(h, ex) }],
  chatshots: (h, ex) => [
    { role: 'system', content: 'You name database tables.' },
    ...SHOTS.flatMap(([c, n]) => [{ role: 'user', content: ask(c.split(', '), []) }, { role: 'assistant', content: n }]),
    { role: 'user', content: ask(h, ex) },
  ],
  // Same examples, but the table under test is described by its columns only (no sample values to copy).
  chatcols: (h) => CHAT.chatshots(h, []),
};
// Accepted answers per table (lower case, singular), used to print a score.
const TRUTH = {
  album: ['album'], artist: ['artist'], customer: ['customer', 'client'], employee: ['employee', 'staff'], genre: ['genre'],
  invoice: ['invoice', 'bill'], invoiceline: ['invoice line', 'invoice item', 'line item'], mediatype: ['media type'],
  playlist: ['playlist'], playlisttrack: ['playlist track', 'playlist item', 'playlist entry', 'playlist song'], track: ['track', 'song'],
  categories: ['category', 'product category'], customers: ['customer'], employeeterritories: ['employee territory', 'territory assignment', 'employee-territory'],
  employees: ['employee'], order_details: ['order detail', 'order line', 'order item', 'line item'], orders: ['order'], products: ['product'],
  regions: ['region'], shippers: ['shipper', 'shipping company'], suppliers: ['supplier', 'vendor'], territories: ['territory'],
};
const tidy = a => a.toLowerCase().replace(/["'.]/g, '').replace(/\s+/g, ' ').trim();
let hit = 0;
let total = 0;
const gen = decoderOnly
  ? await pipeline('text-generation', model, { dtype: 'q4' })
  : await pipeline('text2text-generation', model, { dtype: 'q8' });
// Qwen3 writes a <think> block unless the template is told not to; the template is applied here so that can be switched off.
const generate = async messages => {
  if (/qwen3/i.test(model)) {
    const prompt = gen.tokenizer.apply_chat_template(messages, { tokenize: false, add_generation_prompt: true, enable_thinking: false });
    return (await gen(prompt, { max_new_tokens: 12, do_sample: false, return_full_text: false }))[0].generated_text;
  }
  return (await gen(messages, { max_new_tokens: 12, do_sample: false }))[0].generated_text.at(-1).content;
};
for (const dir of dirs) {
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.csv')).sort()) {
    const p = path.join(dir, f);
    const t0 = Date.now();
    const answer = decoderOnly
      ? await generate(CHAT[variant](header(p), sample(p)))
      : (await gen(PROMPTS[variant](header(p), sample(p)), { max_new_tokens: 16, num_beams: 4 }))[0].generated_text;
    const key = f.replace('.csv', '').toLowerCase();
    const ok = (TRUTH[key] ?? []).includes(tidy(answer));
    total++;
    if (ok) hit++;
    console.log(f.replace('.csv', '').padEnd(22), ok ? 'OK ' : '-- ', JSON.stringify(answer.trim()), `${Date.now() - t0} ms`);
  }
}
console.log(`exact or accepted synonym: ${hit}/${total}`);
