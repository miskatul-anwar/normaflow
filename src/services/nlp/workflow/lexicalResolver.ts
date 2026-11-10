/**
 * Keyword resolver: works with no model and no network.
 *
 * Steps: normalise -> split into clauses -> per clause find alias hits ->
 * negation marks a hit as excluded. Several hits are all kept as targets; the
 * planner takes the union of their dependency closures.
 */
import { ANCHORS, NEGATION, RUN_WORDS, WEAK_ALIASES } from './anchors';

export type Dialect = 'postgresql' | 'mysql' | 'sqlite' | 'ansi';

export interface LexicalResult {
  targets: string[];
  excluded: string[];
  /** Clauses with real content but no alias hit; candidates for embedding. */
  pending: string[];
  options: { run?: boolean; dialect?: Dialect };
  /** `high`: every content clause matched an alias. `medium`: only generic wording. `none`: nothing matched. */
  confidence: 'high' | 'medium' | 'none';
}

const STOPWORDS = new Set(
  'a an the it its this that these those me my you your please pls can could would will should i we us to for of on in at by with from into and or but then also after so just only up until through all everything data table file files csv thanks thank give make get let lets need want like do does is are be have has some'.split(' '),
);

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
}

export function splitClauses(text: string): string[] {
  return normalize(text)
    .split(/[.;,!?\n]+|\bbut\b|\bthen\b|\band also\b|\bafter that\b|\band\b|&|\+/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function parseOptions(text: string): LexicalResult['options'] {
  const t = normalize(text);
  const options: LexicalResult['options'] = {};
  if (RUN_WORDS.test(t)) options.run = true;
  if (/\bpostgres(ql)?\b/.test(t)) options.dialect = 'postgresql';
  else if (/\bmysql\b|\bmaria ?db\b/.test(t)) options.dialect = 'mysql';
  else if (/\bsqlite\b/.test(t)) options.dialect = 'sqlite';
  else if (/\bansi\b/.test(t)) options.dialect = 'ansi';
  return options;
}

interface Hit {
  operation: string;
  index: number;
  weak: boolean;
}

function hitsIn(clause: string): Hit[] {
  const hits: Hit[] = [];
  for (const [operation, { aliases }] of Object.entries(ANCHORS)) {
    let first = -1;
    for (const re of aliases) {
      const m = re.exec(clause);
      if (m && (first === -1 || m.index < first)) first = m.index;
    }
    if (first >= 0) hits.push({ operation, index: first, weak: false });
  }
  // A specific hit swallows overlapping generic ones: "give me sql" must not also trigger "schema".
  return hits.length ? hits : WEAK_ALIASES.flatMap(w => {
    const m = w.pattern.exec(clause);
    return m ? [{ operation: w.operation, index: m.index, weak: true }] : [];
  });
}

/** Operations that a more specific hit in the same clause makes redundant (substring-style aliases). */
const SUPERSEDED_BY: Record<string, string[]> = {
  'Relation Generator': ['SQL Generator', 'ERD Generator', 'Report Generator', 'Relation Detector'],
  'CSV Data Loader': ['Data Cleaner', 'Data Type Profiler', 'Atomicity Checker', 'Report Generator', 'Relation Detector'],
  'Key Discovery': ['Relation Detector'],
};

export function resolveLexical(text: string): LexicalResult {
  const options = parseOptions(text);
  const targets: string[] = [];
  const excluded: string[] = [];
  const pending: string[] = [];
  let anyWeak = false;
  let matchedClauses = 0;

  for (const clause of splitClauses(text)) {
    let hits = hitsIn(clause);
    const present = new Set(hits.map(h => h.operation));
    hits = hits.filter(h => !(SUPERSEDED_BY[h.operation] ?? []).some(s => present.has(s)));
    // "read"/"open"/"load" are only loader requests when nothing else is asked in the clause.
    if (hits.length > 1) hits = hits.filter(h => h.operation !== 'CSV Data Loader');

    if (hits.length === 0) {
      const content = clause.split(/[^a-z0-9']+/).filter(w => w && !STOPWORDS.has(w) && !RUN_WORDS.test(w));
      if (content.length >= 2) pending.push(clause);
      continue;
    }
    matchedClauses++;
    const negation = NEGATION.exec(clause);
    for (const hit of hits.sort((a, b) => a.index - b.index)) {
      anyWeak ||= hit.weak;
      const negated = negation !== null && negation.index < hit.index;
      const list = negated ? excluded : targets;
      if (!list.includes(hit.operation)) list.push(hit.operation);
    }
  }

  const confidence = matchedClauses === 0 ? 'none' : pending.length > 0 || anyWeak ? 'medium' : 'high';
  return { targets, excluded, pending, options, confidence };
}
