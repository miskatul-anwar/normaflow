/**
 * Input hygiene for natural-language requests, applied before any matching.
 *
 *  - Unicode: NFKC, strip zero-width/control characters and accents, unify quotes and dashes;
 *  - bounded length (a pasted document must not reach the regexes or the model);
 *  - conservative typo repair against the vocabulary the aliases actually use.
 *
 * Everything here is deterministic and offline.
 */
import { ANCHORS } from './anchors';

export const MAX_INPUT_CHARS = 400;

export interface PreparedInput {
  /** Cleaned text to match against. Empty when there is nothing usable. */
  text: string;
  truncated: boolean;
  /** Words that were repaired, as [typed, corrected]. */
  corrections: Array<[string, string]>;
}

/** Zero-width and bidi format characters are dropped; other control characters separate words. */
const ZERO_WIDTH = /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]/g;

/** Words whose misspellings are worth repairing: the ones the aliases and the dialect/run options key on. */
const VOCAB = [
  'normalize', 'normalise', 'normalization', 'normalisation', 'denormalize', 'dependency', 'dependencies', 'functional',
  'foreign', 'cardinality', 'lossless', 'preservation', 'preserve', 'preserved', 'diagram', 'entity', 'relationship',
  'relationships', 'boyce', 'atomic', 'atomicity', 'profile', 'profiler', 'classify', 'classifier', 'report', 'summary',
  'summarize', 'summarise', 'generate', 'second', 'third', 'first', 'normal', 'candidate', 'primary', 'composite',
  'clean', 'cleaning', 'duplicate', 'duplicates', 'postgres', 'postgresql', 'mysql', 'sqlite', 'schema', 'tables',
  'transitive', 'partial', 'determinants', 'datatypes', 'multivalued', 'sanitize', 'ingest', 'import', 'upload',
  'discovery', 'detect', 'mermaid', 'documentation', 'execute', 'skip', 'without', 'exclude', 'relations', 'relation',
].filter((w, i, a) => a.indexOf(w) === i);
// Anything an alias spells out as a plain word is also fair game.
for (const a of Object.values(ANCHORS)) {
  for (const re of a.aliases) {
    for (const w of re.source.match(/[a-z]{6,}/g) ?? []) if (!VOCAB.includes(w)) VOCAB.push(w);
  }
}
const VOCAB_SET = new Set(VOCAB);

/** Optimal-string-alignment distance (insert, delete, substitute, adjacent swap), capped. */
export function editDistance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** The single vocabulary word within the allowed distance of `word`, or null if none or ambiguous. */
export function repairWord(word: string): string | null {
  if (word.length < 6 || VOCAB_SET.has(word) || /\d/.test(word)) return null;
  const limit = word.length >= 9 ? 2 : 1;
  let best: string | null = null;
  let bestD = limit + 1;
  let tie = false;
  for (const v of VOCAB) {
    const dist = editDistance(word, v, limit);
    if (dist < bestD) {
      best = v;
      bestD = dist;
      tie = false;
    } else if (dist === bestD && best !== v) {
      tie = true;
    }
  }
  // A tie between different words (not mere spelling variants of one) is a guess; do not guess.
  return best && !tie ? best : null;
}

export function prepareInput(raw: unknown): PreparedInput {
  const empty: PreparedInput = { text: '', truncated: false, corrections: [] };
  if (typeof raw !== 'string') return empty;
  let text = raw
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(CONTROL, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019\u201b`\u00b4]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/[\p{L}\p{N}]/u.test(text)) return empty;
  let truncated = false;
  if (text.length > MAX_INPUT_CHARS) {
    text = text.slice(0, MAX_INPUT_CHARS).replace(/\S*$/, '').trim() || text.slice(0, MAX_INPUT_CHARS);
    truncated = true;
  }
  const corrections: Array<[string, string]> = [];
  text = text.replace(/[A-Za-z]+/g, word => {
    const fixed = repairWord(word.toLowerCase());
    if (!fixed) return word;
    corrections.push([word, fixed]);
    return fixed;
  });
  return { text, truncated, corrections };
}
