/**
 * Barker and UML class-diagram notations as Graphviz DOT.
 *
 *  - Barker: rounded entity boxes; `#` marks a unique identifier, `*` a mandatory attribute and
 *    `o` an optional one. Foreign-key columns are not listed (the relationship says it); a dashed
 *    line means the relationship is optional, a crow's foot marks the "many" end, and a bar across
 *    the foot means the relationship is part of the child's identifier.
 *  - UML: class boxes with a name compartment and an attribute compartment (`+ name : type`,
 *    «PK» / «FK»), and associations with multiplicities (`1`, `0..1`, `0..*`).
 *
 * Names come from untrusted CSV headers: every label is HTML-escaped and node ids are generated.
 */
import type { ChenRelation } from './chenErd';

export interface BoxRelation extends ChenRelation {
  rows?: Array<Record<string, unknown>>;
  metadata?: { attributeTypes?: Record<string, string> };
}

export interface BoxOptions {
  /** List the attributes inside each box. Off gives names only. */
  attributes?: boolean;
}

const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
const SAMPLE = 2000;

/** Columns that contain at least one empty value in (a sample of) the data. */
export function optionalColumns(rel: BoxRelation): Set<string> {
  const out = new Set<string>();
  const rows = rel.rows ?? [];
  const step = Math.max(1, Math.floor(rows.length / SAMPLE));
  for (let i = 0; i < rows.length; i += step) {
    for (const a of rel.attributes) {
      const v = rows[i]?.[a];
      if (v === null || v === undefined || v === '') out.add(a);
    }
  }
  return out;
}

interface Edge {
  parent: string;
  child: string;
  columns: string[];
  optional: boolean;
  identifying: boolean;
  oneToOne: boolean;
}

function edgesOf(relations: BoxRelation[]): Edge[] {
  const names = new Set(relations.map(r => r.name));
  const edges: Edge[] = [];
  for (const r of relations) {
    const pk = r.primaryKey ?? [];
    const optionalCols = optionalColumns(r);
    for (const fk of r.foreignKeys ?? []) {
      if (!fk.references || !names.has(fk.references) || fk.references === r.name) continue;
      edges.push({
        parent: fk.references,
        child: r.name,
        columns: fk.attributes,
        optional: fk.attributes.some(c => optionalCols.has(c)),
        identifying: fk.attributes.some(c => pk.includes(c)),
        oneToOne: pk.length > 0 && pk.length === fk.attributes.length && pk.every(c => fk.attributes.includes(c)),
      });
    }
  }
  return edges;
}

/** Large schemas run left-to-right so the diagram grows downwards (which scrolls) rather than sideways. */
const HEAD = (kind: 'digraph' | 'graph', count: number) => [
  `${kind} ERD {`,
  `  graph [rankdir=${count > 10 ? 'LR' : 'TB'}, nodesep=0.4, ranksep=0.8, pad=0.3, bgcolor="white", splines=true, pack=true];`,
  '  node [shape=plaintext, fontname="Helvetica", fontsize=11];',
  '  edge [color="#6b7280", fontname="Helvetica", fontsize=9, fontcolor="#0f766e"];',
];

export function buildBarkerDot(relations: BoxRelation[], { attributes = true }: BoxOptions = {}): string {
  const lines = HEAD('digraph', relations.length);
  const ids = new Map(relations.map((r, i) => [r.name, `e${i}`]));
  for (const r of relations) {
    const pk = r.primaryKey ?? [];
    const fkCols = new Set((r.foreignKeys ?? []).flatMap(f => f.attributes));
    const optional = optionalColumns(r);
    const rows = attributes
      ? r.attributes
          .filter(a => pk.includes(a) || !fkCols.has(a))
          .map(a => {
            const mark = pk.includes(a) ? '#&nbsp;*' : optional.has(a) ? 'o&nbsp;&nbsp;' : '*&nbsp;&nbsp;';
            return `<TR><TD ALIGN="LEFT">${mark} ${html(a)}</TD></TR>`;
          })
          .join('')
      : '';
    lines.push(
      `  ${ids.get(r.name)} [label=<<TABLE STYLE="ROUNDED" BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" COLOR="#374151" BGCOLOR="#ecfdf5"><TR><TD><B>${html(r.name.toUpperCase())}</B></TD></TR>${rows ? '<HR/>' + rows : ''}</TABLE>>];`,
    );
  }
  for (const e of edgesOf(relations)) {
    const foot = e.oneToOne ? 'none' : e.identifying ? 'crowtee' : 'crow';
    lines.push(
      `  ${ids.get(e.parent)} -> ${ids.get(e.child)} [dir=both, arrowtail=none, arrowhead=${foot}, ${e.optional ? 'style=dashed, ' : ''}label="${esc(e.columns.join(', '))}"];`,
    );
  }
  lines.push('}');
  return lines.join('\n');
}

export function buildUmlDot(relations: BoxRelation[], { attributes = true }: BoxOptions = {}): string {
  const lines = HEAD('graph', relations.length);
  const ids = new Map(relations.map((r, i) => [r.name, `c${i}`]));
  for (const r of relations) {
    const pk = new Set(r.primaryKey ?? []);
    const fk = new Set((r.foreignKeys ?? []).flatMap(f => f.attributes));
    const types = r.metadata?.attributeTypes ?? {};
    const rows = attributes
      ? r.attributes
          .map(a => {
            const name = pk.has(a) ? `<U>${html(a)}</U>` : html(a);
            const tag = [pk.has(a) ? 'PK' : '', fk.has(a) ? 'FK' : ''].filter(Boolean).map(t => `&#171;${t}&#187;`).join(' ');
            return `<TR><TD ALIGN="LEFT">+ ${name}${types[a] ? ` : ${html(types[a])}` : ''}${tag ? ` ${tag}` : ''}</TD></TR>`;
          })
          .join('')
      : '';
    lines.push(
      `  ${ids.get(r.name)} [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" COLOR="#374151" BGCOLOR="#ffffff"><TR><TD BGCOLOR="#e0f2f1"><B>${html(r.name)}</B></TD></TR>${rows ? '<HR/>' + rows : ''}</TABLE>>];`,
    );
  }
  for (const e of edgesOf(relations)) {
    const parentMult = e.optional ? '0..1' : '1';
    const childMult = e.oneToOne ? (e.optional ? '0..1' : '1') : e.optional || !e.identifying ? '0..*' : '1..*';
    lines.push(
      `  ${ids.get(e.parent)} -- ${ids.get(e.child)} [taillabel="${parentMult}", headlabel="${childMult}", labeldistance=2.2, labelangle=-30, labelfontsize=10, label="${esc(e.columns.join(', '))}"];`,
    );
  }
  lines.push('}');
  return lines.join('\n');
}
