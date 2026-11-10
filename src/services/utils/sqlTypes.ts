/**
 * One SQL type-inference spec for generated DDL.
 *
 * Rules, applied to the non-missing values of a column:
 *  - integers without leading zeros -> INTEGER, or BIGINT beyond 32 bits;
 *  - decimals -> DECIMAL(p, s) sized from the data plus two digits of headroom;
 *  - ISO dates -> DATE, ISO date-times -> TIMESTAMP;
 *  - true/false only -> BOOLEAN;
 *  - anything else -> VARCHAR(n) sized from the longest value, or TEXT.
 * Digit strings with leading zeros (ZIP codes, phone numbers, ids) stay text.
 * `notNull` is true only when the column has no missing value in the data.
 */

export interface InferredColumn {
  sqlType: string;
  notNull: boolean;
}

const missing = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

const VARCHAR_STEPS = [16, 32, 64, 128, 255, 500, 1000];

export function inferColumnSqlType(values: unknown[]): InferredColumn {
  const present: string[] = [];
  for (const v of values) if (!missing(v)) present.push(String(v).trim());
  const notNull = present.length === values.length && values.length > 0;
  if (present.length === 0) return { sqlType: 'VARCHAR(255)', notNull: false };

  const allMatch = (re: RegExp) => present.every(v => re.test(v));
  const noLeadingZero = (v: string) => !/^-?0\d/.test(v);

  if (allMatch(/^-?\d{1,18}$/) && present.every(noLeadingZero)) {
    const big = present.some(v => Math.abs(Number(v)) > 2_147_483_647);
    return { sqlType: big ? 'BIGINT' : 'INTEGER', notNull };
  }

  if (allMatch(/^-?\d+(\.\d+)?$/) && present.every(noLeadingZero)) {
    let intDigits = 1;
    let scale = 0;
    for (const v of present) {
      const [i, f = ''] = v.replace('-', '').split('.');
      intDigits = Math.max(intDigits, i.length);
      scale = Math.max(scale, f.length);
    }
    const precision = Math.min(38, intDigits + 2 + scale);
    return { sqlType: `DECIMAL(${precision},${Math.min(scale, precision)})`, notNull };
  }

  if (allMatch(/^\d{4}-\d{2}-\d{2}$/)) return { sqlType: 'DATE', notNull };
  if (allMatch(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/)) {
    return { sqlType: 'TIMESTAMP', notNull };
  }
  if (allMatch(/^(true|false)$/i)) return { sqlType: 'BOOLEAN', notNull };

  const longest = present.reduce((m, v) => Math.max(m, v.length), 0);
  const step = VARCHAR_STEPS.find(s => longest <= s);
  return { sqlType: step ? `VARCHAR(${step})` : 'TEXT', notNull };
}

export function inferColumnTypes(
  rows: Record<string, unknown>[],
  attributes: string[],
): Record<string, InferredColumn> {
  const out: Record<string, InferredColumn> = {};
  for (const attr of attributes) {
    out[attr] = inferColumnSqlType(rows.map(r => r[attr]));
  }
  return out;
}
