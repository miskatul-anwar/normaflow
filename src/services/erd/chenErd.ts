/**
 * Chen-notation ER diagram as Graphviz DOT.
 *
 *  - entity            -> rectangle (double border for a weak entity: its key includes a foreign key);
 *  - relationship      -> diamond (double border when it identifies a weak entity), with 1 / N labels;
 *  - attribute         -> ellipse, key attributes underlined;
 *  - foreign-key columns are not drawn as attributes: they are the relationships;
 *  - junction relation -> one N:M relationship diamond between the entities it links; its own
 *                         non-key columns become attributes of that diamond.
 *
 * Names come from untrusted CSV headers: every string is escaped, node ids are generated.
 */
export interface ChenRelation {
  name: string;
  attributes: string[];
  primaryKey?: string[];
  foreignKeys?: Array<{ attributes: string[]; references: string; referencedKey?: string[] }>;
}

export interface ChenOptions {
  /** Draw attribute ellipses. Off gives a compact entity/relationship overview. */
  attributes?: boolean;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function isJunction(r: ChenRelation): boolean {
  const fks = (r.foreignKeys ?? []).filter(f => f.references);
  if (fks.length < 2) return false;
  const fkCols = new Set(fks.flatMap(f => f.attributes));
  const pk = r.primaryKey ?? [];
  // Every key column is a foreign key, and the key spans at least two referenced entities.
  return pk.length >= 2 && pk.every(c => fkCols.has(c));
}

export function isWeak(r: ChenRelation): boolean {
  const fkCols = new Set((r.foreignKeys ?? []).flatMap(f => f.attributes));
  const pk = r.primaryKey ?? [];
  return !isJunction(r) && pk.some(c => fkCols.has(c)) && pk.some(c => !fkCols.has(c));
}

export function buildChenDot(relations: ChenRelation[], { attributes = true }: ChenOptions = {}): string {
  const known = new Set(relations.map(r => r.name));
  const entityId = new Map<string, string>();
  let counter = 0;
  const next = (p: string) => `${p}${counter++}`;
  const lines: string[] = [
    'graph ERD {',
    '  graph [overlap=false, splines=true, sep="+8", outputorder=edgesfirst, pad=0.3, bgcolor="white"];',
    '  node [fontname="Helvetica", fontsize=11, color="#374151", fontcolor="#111827"];',
    '  edge [color="#6b7280", fontname="Helvetica", fontsize=10, fontcolor="#0f766e"];',
  ];

  const junctions = relations.filter(isJunction);
  const entities = relations.filter(r => !isJunction(r));
  for (const e of entities) {
    const id = next('e');
    entityId.set(e.name, id);
    lines.push(
      `  ${id} [label="${esc(e.name)}", shape=box, style="filled", fillcolor="#ecfdf5"${isWeak(e) ? ', peripheries=2' : ''}, penwidth=1.4];`,
    );
  }

  const attrNode = (owner: string, attr: string, isKey: boolean, shape = 'ellipse') => {
    const id = next('a');
    const label = isKey ? `<<U>${html(attr)}</U>>` : `"${esc(attr)}"`;
    lines.push(`  ${id} [label=${label}, shape=${shape}, style="filled", fillcolor="#ffffff", fontsize=10];`);
    lines.push(`  ${owner} -- ${id};`);
  };

  const relationship = (label: string, ends: Array<{ id: string; card: string }>, identifying = false) => {
    const id = next('r');
    lines.push(`  ${id} [label="${esc(label)}", shape=diamond, style="filled", fillcolor="#fef9c3"${identifying ? ', peripheries=2' : ''}];`);
    for (const end of ends) lines.push(`  ${id} -- ${end.id} [label="${end.card}", penwidth=1.2];`);
    return id;
  };

  for (const e of entities) {
    const id = entityId.get(e.name)!;
    const fkCols = new Set((e.foreignKeys ?? []).flatMap(f => f.attributes));
    if (attributes) {
      for (const a of e.attributes) {
        if (fkCols.has(a)) continue; // the relationship carries it
        attrNode(id, a, (e.primaryKey ?? []).includes(a));
      }
    }
    for (const fk of e.foreignKeys ?? []) {
      const target = entityId.get(fk.references);
      if (!target) continue;
      const pk = e.primaryKey ?? [];
      const oneToOne = pk.length > 0 && pk.every(c => fk.attributes.includes(c)) && fk.attributes.every(c => pk.includes(c));
      const identifying = isWeak(e) && fk.attributes.some(c => pk.includes(c));
      relationship(fk.attributes.join(', '), [
        { id: target, card: '1' },
        { id, card: oneToOne ? '1' : 'N' },
      ], identifying);
    }
  }

  for (const j of junctions) {
    const fks = (j.foreignKeys ?? []).filter(f => entityId.has(f.references));
    if (fks.length < 2) continue;
    const rel = relationship(j.name, fks.map((f, i) => ({ id: entityId.get(f.references)!, card: i === 0 ? 'M' : 'N' })));
    if (attributes) {
      const fkCols = new Set((j.foreignKeys ?? []).flatMap(f => f.attributes));
      for (const a of j.attributes) if (!fkCols.has(a)) attrNode(rel, a, (j.primaryKey ?? []).includes(a));
    }
  }

  // Foreign keys that point outside the diagram are listed rather than silently dropped.
  const dangling = relations.flatMap(r => (r.foreignKeys ?? []).filter(f => f.references && !known.has(f.references)).map(f => `${r.name} -> ${f.references}`));
  if (dangling.length > 0) lines.push(`  // references to relations not in this diagram: ${dangling.map(d => d.replace(/[\r\n]/g, ' ')).join('; ')}`);

  lines.push('}');
  return lines.join('\n');
}

/** Rough attribute count, used to choose a readable default. */
export function attributeCount(relations: ChenRelation[]): number {
  return relations.reduce((n, r) => n + r.attributes.length, 0);
}
