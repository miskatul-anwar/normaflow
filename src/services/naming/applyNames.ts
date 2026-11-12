/**
 * Names every relation of every table after the engine has run.
 *
 * Only the relations of the final schema (3NF / BCNF) are sent to the model, once per distinct column set. The other
 * normal-form sets reuse a name when the same columns appear there, and otherwise stay "unnamed". The model sees column
 * names only. A name the user typed always wins; a model answer that fails `cleanModelName` is dropped.
 */
import {
  cleanModelName,
  nameRelationSet,
  relationSignature,
  mainOf,
  type ChosenName,
  type NameableRelation,
} from './relationNames';
import { IdentifierRegistry } from '../utils/identifiers';

export type NamerFn = (
  items: Array<{ key: string; columns: string[] }>,
  onProgress?: (done: number, total: number) => void,
) => Promise<Record<string, string>>;

export interface NamableTable {
  tableName: string;
  primaryKey: string[];
  /** The set whose relations people will see and the model is asked about. */
  final: NameableRelation[];
  /** Other normal-form sets of the same table; they reuse names by signature. */
  others: NameableRelation[][];
}

export interface ApplyNamesOptions {
  namer?: NamerFn | null;
  /** Names typed by the user, by relation signature. */
  userNames?: Record<string, string>;
  onProgress?: (done: number, total: number) => void;
  /** Called when the model could not be used (the relations stay unnamed). */
  onUnavailable?: (reason: string) => void;
}

export async function applyNames(tables: NamableTable[], opts: ApplyNamesOptions = {}): Promise<void> {
  const chosen = new Map<string, ChosenName>();
  const toAsk = new Map<string, string[]>();
  for (const t of tables) {
    const main = mainOf(t.final, t.primaryKey);
    for (const r of t.final) {
      if (r === main) continue;
      const sig = relationSignature(t.tableName, r);
      const typed = opts.userNames?.[sig]?.trim();
      if (typed) chosen.set(sig, { text: typed, source: 'user' });
      else if (!toAsk.has(sig)) toAsk.set(sig, r.attributes);
    }
    // Typed names also apply to relations that only appear in the other sets.
    for (const set of t.others)
      for (const r of set) {
        const sig = relationSignature(t.tableName, r);
        const typed = opts.userNames?.[sig]?.trim();
        if (typed && !chosen.has(sig)) chosen.set(sig, { text: typed, source: 'user' });
      }
  }

  if (opts.namer && toAsk.size > 0) {
    try {
      const answers = await opts.namer(
        [...toAsk].map(([key, columns]) => ({ key, columns })),
        opts.onProgress,
      );
      for (const [sig, columns] of toAsk) {
        const text = cleanModelName(answers[sig] ?? '', columns);
        if (text) chosen.set(sig, { text, source: 'model' });
      }
    } catch (e) {
      opts.onUnavailable?.((e as Error)?.message ?? String(e));
    }
  }

  const registry = new IdentifierRegistry();
  for (const t of tables) {
    nameRelationSet(t.final, { tableName: t.tableName, primaryKey: t.primaryKey, chosen, registry });
    for (const set of t.others) {
      nameRelationSet(set, { tableName: t.tableName, primaryKey: t.primaryKey, chosen, registry: new IdentifierRegistry() });
    }
  }
}
