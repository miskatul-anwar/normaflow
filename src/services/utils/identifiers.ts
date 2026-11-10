/**
 * Identifier handling shared by the ERD, SQL and report emitters.
 *
 * Sanitizing alone is lossy: `Order Date` and `Order-Date` both become
 * `Order_Date`. The registry hands out a unique name for each original, so
 * two inputs never collapse into one column or table.
 */

/** Keep word characters only; never empty, never starts with a digit. */
export function sanitizeIdentifier(raw: string): string {
  let s = String(raw ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (s === '') s = 'col';
  if (/^\d/.test(s)) s = `c_${s}`;
  return s;
}

export class IdentifierRegistry {
  private readonly used = new Set<string>();
  private readonly byOriginal = new Map<string, string>();

  /** Unique sanitized name for `original`; the same original always maps to the same name. */
  assign(original: string): string {
    const known = this.byOriginal.get(original);
    if (known) return known;
    const base = sanitizeIdentifier(original);
    let candidate = base;
    let n = 2;
    while (this.used.has(candidate.toLowerCase())) candidate = `${base}_${n++}`;
    this.used.add(candidate.toLowerCase());
    this.byOriginal.set(original, candidate);
    return candidate;
  }

  /** A new unique name derived from `base`, even if `base` was handed out before. */
  fresh(base: string): string {
    const clean = sanitizeIdentifier(base);
    let candidate = clean;
    let n = 2;
    while (this.used.has(candidate.toLowerCase())) candidate = `${clean}_${n++}`;
    this.used.add(candidate.toLowerCase());
    return candidate;
  }

  get(original: string): string | undefined {
    return this.byOriginal.get(original);
  }
}

/** Escape text for a Markdown table cell or inline span (CSV headers and values are untrusted). */
export function mdEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/[|`*_[\]<>]/g, ch => `\\${ch}`)
    .replace(/\r?\n/g, ' ');
}
