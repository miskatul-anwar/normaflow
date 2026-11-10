/**
 * Ground-truth databases for the evaluation harness.
 *
 * Each dataset is a small relational schema with known primary keys and
 * foreign keys, filled with seeded pseudo-random rows. The harness exports the
 * tables as key-less CSV (to test key and foreign-key detection) and as one
 * denormalized join (to test whether normalization recovers the tables).
 */

export interface TruthTable {
  name: string;
  columns: string[];
  primaryKey: string[];
  rows: Record<string, string>[];
}

export interface TruthFk {
  from: string;
  columns: string[];
  to: string;
  toColumns: string[];
}

export interface TruthDataset {
  name: string;
  tables: TruthTable[];
  fks: TruthFk[];
}

function rng(seed: number) {
  // mulberry32: good low bits, unlike a plain LCG.
  let a = seed >>> 0;
  return (n: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

const CITIES = ['Paris', 'Rome', 'Oslo', 'Lima', 'Kyiv', 'Doha', 'Pune', 'Graz'];
const DAYS = (i: number) => `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`;

export function retail(scale = 1, seed = 7): TruthDataset {
  const r = rng(seed);
  const nC = 30 * scale, nP = 12 * scale, nO = 120 * scale, nI = 400 * scale;
  const customers: TruthTable = {
    name: 'customers',
    columns: ['customer_id', 'customer_name', 'city'],
    primaryKey: ['customer_id'],
    rows: Array.from({ length: nC }, (_, i) => ({ customer_id: String(i + 1), customer_name: `Customer ${i + 1}`, city: CITIES[r(CITIES.length)] })),
  };
  const products: TruthTable = {
    name: 'products',
    columns: ['sku', 'product_name', 'unit_price'],
    primaryKey: ['sku'],
    rows: Array.from({ length: nP }, (_, i) => ({ sku: `SKU-${100 + i}`, product_name: `Product ${i + 1}`, unit_price: (5 + r(95) + 0.99).toFixed(2) })),
  };
  const orders: TruthTable = {
    name: 'orders',
    columns: ['order_id', 'customer_id', 'order_date'],
    primaryKey: ['order_id'],
    rows: Array.from({ length: nO }, (_, i) => ({ order_id: String(1000 + i), customer_id: String(r(nC) + 1), order_date: DAYS(i * 5) })),
  };
  const seen = new Set<string>();
  const items: TruthTable = { name: 'order_items', columns: ['order_id', 'line_no', 'sku', 'quantity'], primaryKey: ['order_id', 'line_no'], rows: [] };
  while (items.rows.length < nI) {
    const o = orders.rows[r(nO)].order_id;
    const line = r(6) + 1;
    if (seen.has(`${o}|${line}`)) continue;
    seen.add(`${o}|${line}`);
    items.rows.push({ order_id: o, line_no: String(line), sku: products.rows[r(nP)].sku, quantity: String(r(9) + 1) });
  }
  return {
    name: `retail x${scale}`,
    tables: [customers, products, orders, items],
    fks: [
      { from: 'orders', columns: ['customer_id'], to: 'customers', toColumns: ['customer_id'] },
      { from: 'order_items', columns: ['order_id'], to: 'orders', toColumns: ['order_id'] },
      { from: 'order_items', columns: ['sku'], to: 'products', toColumns: ['sku'] },
    ],
  };
}

export function university(scale = 1, seed = 11): TruthDataset {
  const r = rng(seed);
  const nS = 40 * scale, nC = 10 * scale;
  const majors: TruthTable = {
    name: 'majors',
    columns: ['major_code', 'major_title'],
    primaryKey: ['major_code'],
    rows: ['CS', 'MA', 'PH', 'BI', 'EC'].map(c => ({ major_code: c, major_title: `${c} Studies` })),
  };
  const students: TruthTable = {
    name: 'students',
    columns: ['student_id', 'student_name', 'major_code'],
    primaryKey: ['student_id'],
    rows: Array.from({ length: nS }, (_, i) => ({ student_id: String(500 + i), student_name: `Student ${i + 1}`, major_code: majors.rows[r(5)].major_code })),
  };
  const courses: TruthTable = {
    name: 'courses',
    columns: ['course_id', 'course_title', 'credits'],
    primaryKey: ['course_id'],
    rows: Array.from({ length: nC }, (_, i) => ({ course_id: `C${i + 1}`, course_title: `Course ${i + 1}`, credits: String(2 + r(4)) })),
  };
  const seen = new Set<string>();
  const enrol: TruthTable = { name: 'enrolments', columns: ['student_id', 'course_id', 'grade'], primaryKey: ['student_id', 'course_id'], rows: [] };
  while (enrol.rows.length < 150 * scale) {
    const s = students.rows[r(nS)].student_id;
    const c = courses.rows[r(nC)].course_id;
    if (seen.has(`${s}|${c}`)) continue;
    seen.add(`${s}|${c}`);
    enrol.rows.push({ student_id: s, course_id: c, grade: ['A', 'B', 'C', 'D'][r(4)] });
  }
  return {
    name: `university x${scale}`,
    tables: [majors, students, courses, enrol],
    fks: [
      { from: 'students', columns: ['major_code'], to: 'majors', toColumns: ['major_code'] },
      { from: 'enrolments', columns: ['student_id'], to: 'students', toColumns: ['student_id'] },
      { from: 'enrolments', columns: ['course_id'], to: 'courses', toColumns: ['course_id'] },
    ],
  };
}

/** Natural-join all tables along the foreign keys, starting from the table with most FKs. */
export function denormalize(ds: TruthDataset): { columns: string[]; rows: Record<string, string>[] } {
  const byName = new Map(ds.tables.map(t => [t.name, t]));
  const root = [...ds.tables].sort((a, b) => ds.fks.filter(f => f.from === b.name).length - ds.fks.filter(f => f.from === a.name).length)[0];
  let columns = [...root.columns];
  let rows = root.rows.map(r => ({ ...r }));
  const joined = new Set([root.name]);
  let progress = true;
  while (progress) {
    progress = false;
    for (const fk of ds.fks) {
      if (joined.has(fk.from) && !joined.has(fk.to)) {
        const target = byName.get(fk.to)!;
        const index = new Map(target.rows.map(t => [fk.toColumns.map(c => t[c]).join('|'), t]));
        rows = rows.map(r => ({ ...r, ...index.get(fk.columns.map(c => r[c]).join('|')) }));
        columns = [...columns, ...target.columns.filter(c => !columns.includes(c))];
        joined.add(fk.to);
        progress = true;
      }
    }
  }
  return { columns, rows };
}

export function toCsv(columns: string[], rows: Record<string, string>[]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `${[columns.join(','), ...rows.map(r => columns.map(c => cell(r[c] ?? '')).join(','))].join('\n')}\n`;
}
