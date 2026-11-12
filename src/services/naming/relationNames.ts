/**
 * Relation names.
 *
 * The engine never builds a relation's name out of column names. While it works, every relation it creates gets an opaque id
 * (`relation_1`, `relation_2`, ...). Names people read come later, from one of four sources:
 *
 *   source       the relation that holds the table's key keeps the table's own (file) name;
 *   user         a name the user typed, remembered per workspace;
 *   model        a short noun phrase written by the on-device model;
 *   placeholder  the engine id, shown as "unnamed", when there is no model result.
 *
 * `IdentifierRegistry` turns display text into a safe, unique SQL / Mermaid identifier; it never combines attribute names.
 */
import { IdentifierRegistry, sanitizeIdentifier } from '../utils/identifiers';

export type NameSource = 'source' | 'user' | 'model' | 'placeholder';

/** The parts of a relation that naming needs; the engine's RelationSchema satisfies this. */
export interface NameableRelation {
  name: string;
  attributes: string[];
  primaryKey: string[];
  foreignKeys: Array<{ references: string }>;
  displayName?: string;
  nameSource?: NameSource;
  sourceTable?: string;
}

let counter = 0;

/** Start numbering again (once per analysis run, so ids are small and stable for the same input). */
export function resetRelationIds(): void {
  counter = 0;
}

/** An opaque id for a new relation. It is a counter, not text derived from the data. */
export function newRelationId(): string {
  return `relation_${++counter}`;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Identifies a relation by what it contains, so the same set of columns gets the same name wherever it appears
 * (3NF and BCNF, two normal forms of one table) and a user's rename is found again on the next run.
 */
export function relationSignature(tableName: string, r: Pick<NameableRelation, 'attributes' | 'primaryKey'>): string {
  const attrs = [...r.attributes].map(norm).sort().join(',');
  const key = [...r.primaryKey].map(norm).sort().join(',');
  return `${norm(tableName)}|${attrs}|${key}`;
}

/** What the namer is asked about: columns only. Values are never sent (they would be copied back into the name). */
export interface NamingRequest {
  signature: string;
  columns: string[];
}

export interface ChosenName {
  text: string;
  source: Exclude<NameSource, 'source' | 'placeholder'>;
}

/**
 * Checks a model answer before it is used. This validates, it does not write names: the answer is the model's, or it is
 * rejected and the relation stays "unnamed". Rejects empty or very long text, sentences, anything with digits or
 * punctuation inside, and answers that are just a column name.
 */
export function cleanModelName(raw: string, columns: string[]): string | null {
  let s = String(raw ?? '')
    .split(/\r?\n/)[0]
    .replace(/^["'`“”‘’\s]+|["'`“”‘’.!?:;,\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/\s+table$/i, '');
  if (s.length < 2 || s.length > 40) return null;
  if (/[\d:=,;()[\]{}<>|/\\]/.test(s)) return null;
  const words = s.split(' ');
  if (words.length > 4) return null;
  if (/^(the|a|an|this|these|one|there|it|here|name|table)\b/i.test(s)) return null; // starts like a sentence
  const compact = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (columns.some(c => compact(c) === compact(s))) return null; // a copied column
  if (!/[A-Za-z]/.test(s)) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface NameSetOptions {
  /** The table (file or sheet) these relations come from. */
  tableName: string;
  /** The key chosen for the table; the relation that holds it keeps the table's name. */
  primaryKey: string[];
  /** Names chosen for relations of this run, by signature. */
  chosen?: Map<string, ChosenName>;
  /** Make names unique across calls (several tables in one schema). */
  registry?: IdentifierRegistry;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));

/**
 * The relation that keeps the table's own (file) name: the one that holds the most columns of the table's key. When no
 * relation holds the whole key (the decomposition may use an equivalent key), the one with the largest key of its own
 * wins, which is the relation that links the others, and then the one with the most columns.
 */
export function mainOf<T extends Pick<NameableRelation, 'attributes' | 'primaryKey'>>(set: T[], primaryKey: string[]): T | undefined {
  const held = (r: T) => primaryKey.filter(k => r.attributes.includes(k)).length;
  return [...set].sort(
    (a, b) =>
      held(b) - held(a) ||
      Number(sameSet(b.primaryKey, primaryKey)) - Number(sameSet(a.primaryKey, primaryKey)) ||
      b.primaryKey.length - a.primaryKey.length ||
      b.attributes.length - a.attributes.length,
  )[0];
}

/**
 * Gives every relation in one normal-form set its final name and rewrites foreign-key targets to match.
 * `name` becomes a safe identifier; `displayName` is the text people read; `nameSource` says where it came from.
 */
export function nameRelationSet(set: NameableRelation[], opts: NameSetOptions): void {
  if (set.length === 0) return;
  const registry = opts.registry ?? new IdentifierRegistry();
  const main = mainOf(set, opts.primaryKey);

  const rename = new Map<string, string>();
  const decided = set.map(r => {
    if (r === main) return { r, text: opts.tableName, source: 'source' as NameSource };
    // Already named in an earlier pass (the set is shared between the engine and the schema builder): keep that name.
    if ((r.nameSource === 'model' || r.nameSource === 'user') && r.displayName) return { r, text: r.displayName, source: r.nameSource };
    const pick = opts.chosen?.get(relationSignature(opts.tableName, r));
    if (pick) return { r, text: pick.text, source: pick.source as NameSource };
    return { r, text: r.name, source: 'placeholder' as NameSource }; // the engine id: honest, and never built from columns
  });
  for (const d of decided) rename.set(d.r.name, registry.fresh(sanitizeIdentifier(d.text)));
  for (const d of decided) {
    for (const fk of d.r.foreignKeys) fk.references = rename.get(fk.references) ?? fk.references;
  }
  for (const d of decided) {
    d.r.displayName = d.source === 'placeholder' ? undefined : d.text;
    d.r.nameSource = d.source;
    d.r.sourceTable = opts.tableName;
    d.r.name = rename.get(d.r.name) ?? d.r.name;
  }
}
