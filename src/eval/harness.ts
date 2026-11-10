import { DatabaseService } from '../services/api/databaseService';
import { ALL_OPERATION_NAMES } from '../config/operations';
import { denormalize, toCsv, type TruthDataset } from './datasets';

export interface Score {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export function score(predicted: Set<string>, truth: Set<string>): Score {
  let tp = 0;
  for (const p of predicted) if (truth.has(p)) tp++;
  const fp = predicted.size - tp;
  const fn = truth.size - tp;
  const precision = predicted.size === 0 ? (truth.size === 0 ? 1 : 0) : tp / predicted.size;
  const recall = truth.size === 0 ? 1 : tp / truth.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { tp, fp, fn, precision, recall, f1 };
}

export interface DatasetReport {
  dataset: string;
  rows: number;
  /** Separate key-less CSVs. */
  primaryKeys: Score;
  foreignKeys: Score;
  separateMs: number;
  /** One denormalized CSV. */
  recoveredRelations: Score;
  denormalizedRows: number;
  denormalizedMs: number;
}

const csvFile = (name: string, text: string) => new File([text], `${name}.csv`, { type: 'text/csv' });
const set = (xs: string[][]) => new Set(xs.map(x => [...x].sort().join('+')));

export async function evaluate(ds: TruthDataset, operations: string[] = ALL_OPERATION_NAMES): Promise<DatasetReport> {
  // (a) Key-less tables: primary keys and foreign keys.
  let t0 = Date.now();
  const sep = await new DatabaseService().processFiles(
    ds.tables.map(t => csvFile(t.name, toCsv(t.columns, t.rows))),
    operations,
  );
  const separateMs = Date.now() - t0;
  if (!sep.success) throw new Error(`${ds.name}: ${sep.error}`);

  const predictedPk = new Set<string>();
  for (const t of sep.tables ?? []) predictedPk.add(`${t.tableName}:${[...(t.primaryKey ?? [])].sort().join('+')}`);
  const truthPk = new Set(ds.tables.map(t => `${t.name}:${[...t.primaryKey].sort().join('+')}`));

  const fkKey = (from: string, cols: string[], to: string, toCols: string[]) =>
    `${from}.${[...cols].sort().join('+')}->${to}.${[...toCols].sort().join('+')}`;
  const predictedFk = new Set(
    (sep.crossTableRelationships ?? []).map((l: any) =>
      fkKey(l.sourceTable, l.sourceColumns ?? [l.sourceColumn], l.targetTable, l.targetColumns ?? [l.targetColumn]),
    ),
  );
  const truthFk = new Set(ds.fks.map(f => fkKey(f.from, f.columns, f.to, f.toColumns)));

  // (b) Denormalized join: do the original relations come back?
  const flat = denormalize(ds);
  t0 = Date.now();
  const den = await new DatabaseService().processFile(csvFile('flat', toCsv(flat.columns, flat.rows)), operations);
  const denormalizedMs = Date.now() - t0;
  if (!den.success) throw new Error(`${ds.name} (denormalized): ${den.error}`);
  const predictedRel = set((den.relations ?? []).map((r: any) => r.attributes));
  const truthRel = set(ds.tables.map(t => t.columns));

  return {
    dataset: ds.name,
    rows: ds.tables.reduce((n, t) => n + t.rows.length, 0),
    primaryKeys: score(predictedPk, truthPk),
    foreignKeys: score(predictedFk, truthFk),
    separateMs,
    recoveredRelations: score(predictedRel, truthRel),
    denormalizedRows: flat.rows.length,
    denormalizedMs,
  };
}
