/**
 * Instance-level verification of a decomposition.
 *
 * The chase proves a decomposition lossless *with respect to a set of FDs*.
 * That is only as trustworthy as the FDs. This check does the same test on
 * the data itself: project the rows onto every relation, natural-join the
 * projections, and compare the result with the distinct input rows. Equal
 * sets mean nothing was lost or invented on this data.
 */

export interface InstanceLosslessResult {
  /** `true`/`false` when decided; `null` when the join exceeded the limit. */
  lossless: boolean | null;
  inputRows: number;
  joinedRows: number;
  /** Rows produced by the join that are not in the input (spurious tuples). */
  spuriousRows: number;
  /** Input rows missing from the join (cannot happen for projections; kept as a sanity check). */
  missingRows: number;
  note?: string;
}

const SEP = '\u0001';

function cell(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function rowKey(row: Record<string, unknown>, attrs: string[]): string {
  let out = '';
  for (let i = 0; i < attrs.length; i++) {
    if (i) out += SEP;
    out += cell(row[attrs[i]]);
  }
  return out;
}

/**
 * Natural-join the projections of `rows` onto each of `relationAttrs` and
 * compare with the distinct input rows.
 *
 * @param maxJoinRows stop (result `null`) if an intermediate join exceeds this size.
 */
export function verifyLosslessOnData(
  rows: Record<string, unknown>[],
  relationAttrs: string[][],
  maxJoinRows = 250_000,
): InstanceLosslessResult {
  const empty: InstanceLosslessResult = {
    lossless: null,
    inputRows: rows.length,
    joinedRows: 0,
    spuriousRows: 0,
    missingRows: 0,
  };
  if (rows.length === 0 || relationAttrs.length === 0) {
    return { ...empty, lossless: rows.length === 0 ? true : null, note: 'No data to verify.' };
  }

  const allAttrs = Object.keys(rows[0]);
  const covered = new Set(relationAttrs.flat());
  if (!allAttrs.every(a => covered.has(a))) {
    return { ...empty, lossless: false, note: 'Some attributes are not in any relation.' };
  }

  // Distinct input rows over all attributes.
  const inputSet = new Set<string>();
  for (const r of rows) inputSet.add(rowKey(r, allAttrs));

  // Distinct projections.
  const projections = relationAttrs.map(attrs => {
    const seen = new Set<string>();
    const out: Record<string, string>[] = [];
    for (const r of rows) {
      const k = rowKey(r, attrs);
      if (seen.has(k)) continue;
      seen.add(k);
      const o: Record<string, string> = {};
      for (const a of attrs) o[a] = cell(r[a]);
      out.push(o);
    }
    return { attrs, rows: out };
  });

  // Join smallest-first, always picking a relation that shares attributes with the running result.
  const remaining = [...projections].sort((a, b) => a.rows.length - b.rows.length);
  const first = remaining.shift()!;
  let currentAttrs = [...first.attrs];
  let current: Record<string, string>[] = first.rows;

  while (remaining.length > 0) {
    let idx = remaining.findIndex(p => p.attrs.some(a => currentAttrs.includes(a)));
    if (idx === -1) idx = 0; // cross product (disconnected relations)
    const next = remaining.splice(idx, 1)[0];
    const shared = next.attrs.filter(a => currentAttrs.includes(a));

    const index = new Map<string, Record<string, string>[]>();
    for (const r of next.rows) {
      const k = shared.map(a => r[a]).join(SEP);
      const bucket = index.get(k);
      if (bucket) bucket.push(r);
      else index.set(k, [r]);
    }

    const joined: Record<string, string>[] = [];
    for (const left of current) {
      const bucket = index.get(shared.map(a => left[a]).join(SEP));
      if (!bucket) continue;
      for (const right of bucket) {
        joined.push({ ...left, ...right });
        if (joined.length > maxJoinRows) {
          return {
            ...empty,
            lossless: null,
            joinedRows: joined.length,
            note: `Join exceeded ${maxJoinRows.toLocaleString()} rows; the decomposition is very likely lossy.`,
          };
        }
      }
    }
    current = joined;
    currentAttrs = [...new Set([...currentAttrs, ...next.attrs])];
  }

  const joinedSet = new Set<string>();
  for (const r of current) joinedSet.add(allAttrs.map(a => r[a] ?? '').join(SEP));

  let spurious = 0;
  for (const k of joinedSet) if (!inputSet.has(k)) spurious++;
  let missing = 0;
  for (const k of inputSet) if (!joinedSet.has(k)) missing++;

  return {
    lossless: spurious === 0 && missing === 0,
    inputRows: inputSet.size,
    joinedRows: joinedSet.size,
    spuriousRows: spurious,
    missingRows: missing,
  };
}
