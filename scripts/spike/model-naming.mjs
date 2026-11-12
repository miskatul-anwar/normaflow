// Spike for docs/notes/model-naming-spike.md: can a small bundled text-to-text model name a relation?
//
//   node scripts/spike/model-naming.mjs <model-dir-name> <prompt> <dir-of-csvs...>
//
// Models are read from MODELS_DIR (default /tmp/t5), laid out like Hugging Face repos
// (<model>/config.json, tokenizer.json, onnx/encoder_model_quantized.onnx,
// onnx/decoder_model_merged_quantized.onnx), for example from Xenova/flan-t5-base.
// Prompts: shots | q1 | q2 | q4 | q5 (see PROMPTS). Prints the top answer per CSV (the file name is never shown to the model).
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

const gen = await pipeline('text2text-generation', model, { dtype: 'q8' });
for (const dir of dirs) {
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.csv')).sort()) {
    const p = path.join(dir, f);
    const t0 = Date.now();
    const out = await gen(PROMPTS[variant](header(p), sample(p)), { max_new_tokens: 16, num_beams: 4 });
    console.log(f.replace('.csv', '').padEnd(22), '->', JSON.stringify(out[0].generated_text.trim()), `${Date.now() - t0} ms`);
  }
}
