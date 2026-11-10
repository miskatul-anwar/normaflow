/**
 * Multi-table schema assembly.
 *
 * Each input file is normalized on its own into one or more relations. This
 * module joins those results into one schema: it gives every relation a
 * globally unique name, maps each detected cross-file foreign key onto the
 * normalized relations that actually hold the columns, and emits the ER
 * diagram and DDL input from the *normalized* relations (not from the raw
 * file headers).
 */

import type { CrossTableRelationship, ForeignKey, RelationSchema } from '../../types';
import type { DecomposedRelation } from '../api/databaseService';
import { IdentifierRegistry, sanitizeIdentifier } from '../utils/identifiers';
import { inferColumnTypes } from '../utils/sqlTypes';

export interface TableSchemaInput {
  tableName: string;
  headers: string[];
  rows: any[];
  primaryKey: string[];
  /** Normalized relations for this table (may be empty if no normal form was selected). */
  relations: RelationSchema[];
}

export interface BuiltSchema {
  relations: RelationSchema[];
  /** `relation.column` keys of foreign-key columns that may be NULL. */
  optionalFks: Set<string>;
  /** `relation.column` keys referenced by a foreign key but not the relation's primary key. */
  referencedUnique: Set<string>;
  /** Cross-file links that could not be placed on a relation, with the reason. */
  unplaced: Array<{ link: CrossTableRelationship; reason: string }>;
  /** Association tables that realise many-to-many relationships. */
  junctions: JunctionTable[];
}

export interface JunctionTable {
  relation: string;
  /** The parent relations the junction connects. */
  between: string[];
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));

export function buildSchema(tables: TableSchemaInput[], cross: CrossTableRelationship[]): BuiltSchema {
  const names = new IdentifierRegistry();
  const byTable = new Map<string, RelationSchema[]>();
  const all: RelationSchema[] = [];

  for (const t of tables) {
    let rels: RelationSchema[] = t.relations.map(r => ({
      ...r,
      foreignKeys: (r.foreignKeys ?? []).map(fk => ({ ...fk })),
    }));
    if (rels.length === 0) {
      rels = [
        {
          name: t.tableName,
          attributes: [...t.headers],
          primaryKey: [...t.primaryKey],
          foreignKeys: [],
          rows: t.rows,
          sourceType: 'Main',
          metadata: { rowCount: t.rows.length, attributeTypes: {} },
        },
      ];
    }

    // The relation holding the table's primary key keeps the file's name.
    const holdsKey = rels.filter(r => t.primaryKey.every(k => r.attributes.includes(k)));
    const main = [...(holdsKey.length ? holdsKey : rels)].sort(
      (a, b) =>
        Number(sameSet(b.primaryKey, t.primaryKey)) - Number(sameSet(a.primaryKey, t.primaryKey)) ||
        b.attributes.length - a.attributes.length,
    )[0];

    const rename = new Map<string, string>();
    for (const r of rels) {
      const base =
        r === main
          ? t.tableName
          : `${t.tableName}_${r.primaryKey.map(sanitizeIdentifier).join('_')}`.slice(0, 48);
      rename.set(r.name, names.fresh(base));
    }
    for (const r of rels) {
      for (const fk of r.foreignKeys) fk.references = rename.get(fk.references) ?? fk.references;
      r.name = rename.get(r.name) ?? r.name;
      r.sourceTable = t.tableName;
    }

    // Honour the key chosen for the table: synthesis may have keyed the main
    // relation by another candidate key (e.g. a unique price instead of order_id).
    // Only re-key when no sibling relation references the old key.
    if (
      t.primaryKey.length > 0 &&
      t.primaryKey.every(k => main.attributes.includes(k)) &&
      !sameSet(main.primaryKey, t.primaryKey) &&
      !rels.some(r => r !== main && r.foreignKeys.some(fk => fk.references === main.name))
    ) {
      main.primaryKey = [...t.primaryKey];
    }
    byTable.set(t.tableName, rels);
    all.push(...rels);
  }

  const optionalFks = new Set<string>();
  const referencedUnique = new Set<string>();
  const unplaced: BuiltSchema['unplaced'] = [];

  for (const link of cross) {
    const srcCols = link.sourceColumns ?? [link.sourceColumn];
    const tgtCols = link.targetColumns ?? [link.targetColumn];
    const label = (t: string, cols: string[]) => `${t}.${cols.join('+')}`;
    const srcRels = byTable.get(link.sourceTable) ?? [];
    const tgtRels = byTable.get(link.targetTable) ?? [];

    const holdingSrc = srcRels.filter(r => srcCols.every(c => r.attributes.includes(c)));
    if (holdingSrc.length === 0) {
      unplaced.push({ link, reason: `column ${label(link.sourceTable, srcCols)} is not in any normalized relation` });
      continue;
    }
    // Prefer the relation where the columns are ordinary attributes, not its key.
    const src =
      [...holdingSrc].sort(
        (a, b) =>
          Number(srcCols.every(c => a.primaryKey.includes(c))) - Number(srcCols.every(c => b.primaryKey.includes(c))) ||
          b.attributes.length - a.attributes.length,
      )[0];

    const holdingTgt = tgtRels.filter(r => tgtCols.every(c => r.attributes.includes(c)));
    if (holdingTgt.length === 0) {
      unplaced.push({ link, reason: `column ${label(link.targetTable, tgtCols)} is not in any normalized relation` });
      continue;
    }
    const tgt =
      [...holdingTgt].sort(
        (a, b) =>
          Number(sameSet(b.primaryKey, tgtCols)) - Number(sameSet(a.primaryKey, tgtCols)) ||
          Number(tgtCols.every(c => b.primaryKey.includes(c))) - Number(tgtCols.every(c => a.primaryKey.includes(c))) ||
          a.attributes.length - b.attributes.length,
      )[0];

    const duplicate = src.foreignKeys.some(fk => fk.references === tgt.name && sameSet(fk.attributes, srcCols));
    if (!duplicate) {
      src.foreignKeys.push({
        attributes: [...srcCols],
        references: tgt.name,
        referencedKey: [...tgtCols],
        cardinality: link.cardinality,
      } satisfies ForeignKey);
    }
    if (link.optional) for (const c of srcCols) optionalFks.add(`${src.name}.${c}`);
    if (!sameSet(tgt.primaryKey, tgtCols)) for (const c of tgtCols) referencedUnique.add(`${tgt.name}.${c}`);
  }

  return { relations: all, optionalFks, referencedUnique, unplaced, junctions: findJunctionTables(all) };
}

/**
 * Junction (association) tables: a relation whose primary key is made up of
 * foreign keys to two or more different relations. It realises a many-to-many
 * relationship between those parents.
 */
export function findJunctionTables(relations: RelationSchema[]): JunctionTable[] {
  const out: JunctionTable[] = [];
  for (const r of relations) {
    if (r.primaryKey.length < 2) continue;
    const fks = r.foreignKeys.filter(fk => fk.attributes.every(a => r.primaryKey.includes(a)));
    const covered = new Set(fks.flatMap(fk => fk.attributes));
    const parents = [...new Set(fks.map(fk => fk.references))].filter(p => p !== r.name);
    if (parents.length >= 2 && r.primaryKey.every(a => covered.has(a))) {
      out.push({ relation: r.name, between: parents });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// ER diagram (Mermaid)
// ---------------------------------------------------------------------------

function mermaidType(sqlType: string): string {
  const t = sqlType.toUpperCase();
  if (t.startsWith('BIGINT')) return 'bigint';
  if (t.startsWith('INT')) return 'int';
  if (t.startsWith('DECIMAL')) return 'decimal';
  if (t.startsWith('BOOL')) return 'boolean';
  if (t.startsWith('TIMESTAMP')) return 'timestamp';
  if (t.startsWith('DATE')) return 'date';
  return 'string';
}

/**
 * Mermaid `erDiagram` for the normalized relations. Every relation appears;
 * parents sit on the left of each relationship, and a nullable foreign key
 * makes the parent side optional (`|o`).
 */
export function emitMermaidErd(schema: BuiltSchema): string {
  const entityNames = new IdentifierRegistry();
  const entity = new Map<string, string>();
  for (const r of schema.relations) entity.set(r.name, entityNames.fresh(r.name));

  const columnNames = new Map<string, IdentifierRegistry>();
  const col = (rel: string, name: string) => {
    let reg = columnNames.get(rel);
    if (!reg) columnNames.set(rel, (reg = new IdentifierRegistry()));
    return reg.assign(name);
  };

  const lines: string[] = ['erDiagram'];
  for (const r of schema.relations) {
    const types = inferColumnTypes(r.rows ?? [], r.attributes);
    const fkCols = new Set(r.foreignKeys.flatMap(fk => fk.attributes));
    lines.push(`    ${entity.get(r.name)} {`);
    for (const a of r.attributes) {
      const tags: string[] = [];
      if (r.primaryKey.includes(a)) tags.push('PK');
      if (fkCols.has(a)) tags.push('FK');
      lines.push(
        `        ${mermaidType(types[a]?.sqlType ?? 'VARCHAR(255)')} ${col(r.name, a)}${tags.length ? ` ${tags.join(', ')}` : ''}`,
      );
    }
    lines.push('    }');
  }

  for (const r of schema.relations) {
    for (const fk of r.foreignKeys) {
      const parent = entity.get(fk.references);
      const child = entity.get(r.name);
      if (!parent || !child) continue;
      const optional = fk.attributes.some(a => schema.optionalFks.has(`${r.name}.${a}`));
      const left = optional ? '|o' : '||';
      const right = fk.cardinality === '1:1' ? 'o|' : 'o{';
      const label = fk.attributes.map(a => col(r.name, a)).join(', ').replace(/"/g, "'");
      lines.push(`    ${parent} ${left}--${right} ${child} : "${label}"`);
    }
  }
  for (const j of schema.junctions) {
    const names = j.between.map(b => entity.get(b) ?? b).join(' <-> ');
    lines.push(`    %% ${entity.get(j.relation) ?? j.relation} is a junction table: many-to-many between ${names}`);
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// DDL input
// ---------------------------------------------------------------------------

/** Relations ordered so referenced tables come before the tables that reference them. */
function orderParentsFirst(relations: RelationSchema[]): RelationSchema[] {
  const byName = new Map(relations.map(r => [r.name, r]));
  const ordered: RelationSchema[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (r: RelationSchema) => {
    if (state.get(r.name)) return; // done or in progress (cycle): emit as is
    state.set(r.name, 1);
    for (const fk of r.foreignKeys) {
      const parent = byName.get(fk.references);
      if (parent && parent !== r) visit(parent);
    }
    state.set(r.name, 2);
    ordered.push(r);
  };
  relations.forEach(visit);
  return ordered;
}

/** Convert the schema into DDL generator input with unique, sanitized identifiers and inferred types. */
export function toDecomposedRelations(schema: BuiltSchema): DecomposedRelation[] {
  const tableNames = new IdentifierRegistry();
  const tableOf = new Map<string, string>();
  for (const r of schema.relations) tableOf.set(r.name, tableNames.fresh(r.name));

  const colMaps = new Map<string, IdentifierRegistry>();
  for (const r of schema.relations) {
    const reg = new IdentifierRegistry();
    r.attributes.forEach(a => reg.assign(a));
    colMaps.set(r.name, reg);
  }
  const colOf = (rel: string, a: string) => colMaps.get(rel)?.get(a) ?? sanitizeIdentifier(a);

  return orderParentsFirst(schema.relations).map(r => {
    const inferred = inferColumnTypes(r.rows ?? [], r.attributes);
    const columnTypes: Record<string, string> = {};
    const notNull: Record<string, boolean> = {};
    const unique: string[] = [];
    for (const a of r.attributes) {
      const c = colOf(r.name, a);
      columnTypes[c] = inferred[a].sqlType;
      notNull[c] = inferred[a].notNull;
      if (schema.referencedUnique.has(`${r.name}.${a}`)) unique.push(c);
    }
    return {
      name: tableOf.get(r.name)!,
      attributes: r.attributes.map(a => colOf(r.name, a)),
      primaryKey: r.primaryKey.map(a => colOf(r.name, a)),
      foreignKeys: r.foreignKeys.map(fk => ({
        attributes: fk.attributes.map(a => colOf(r.name, a)),
        references: tableOf.get(fk.references) ?? sanitizeIdentifier(fk.references),
        referencedKey: fk.referencedKey.map(a => colOf(fk.references, a)),
        cardinality: fk.cardinality,
      })),
      columnTypes,
      notNull,
      unique,
    };
  });
}
