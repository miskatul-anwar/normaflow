/**
 * NLP-based semantic column profiler.
 *
 * Classifies CSV columns into entity types by fusing two independent evidence
 * channels:
 *
 *  1. **Name evidence** — tokenization of column/table names (snake_case,
 *     camelCase, kebab-case) matched against a curated synonym gazetteer.
 *  2. **Value evidence** — regex/structural analysis of sampled values
 *     (e-mails, URLs, UUIDs, dates, currency, booleans, cardinality shape).
 *
 * The final score is a weighted fusion; corroborating signals boost
 * confidence, conflicting signals resolve toward the stronger channel.
 * Pure functions only — no DOM or React dependencies — so it runs anywhere
 * and is fully unit-testable.
 */

import type { EntityTag, EntityType } from '../../types';

export interface ColumnSampleStats {
  /** Non-empty values observed (bounded sample). */
  samples: string[];
  /** Total non-empty values seen (may exceed samples.length). */
  filled: number;
  /** Distinct values seen in the full column (if known), else sample distinct. */
  distinct: number;
}

export const SAMPLE_LIMIT = 24;

// ---------------------------------------------------------------------------
// Tokenization & gazetteers
// ---------------------------------------------------------------------------

/** Tokenize a name on snake_case / camelCase / kebab-case / spaces / dots. */
export function tokenizeName(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .map(t => t.toLowerCase().trim())
    .filter(Boolean);
}

/** Naive English singularization: strips ONLY a trailing plural "s". */
export function singularize(word: string): string {
  const lower = word.toLowerCase();
  if (
    lower.length > 3 &&
    lower.endsWith('s') &&
    !lower.endsWith('ss') &&
    !lower.endsWith('us') &&
    !lower.endsWith('is')
  ) {
    return lower.slice(0, -1);
  }
  return lower;
}

type EntityType_ = EntityType;

interface NameRule {
  type: EntityType_;
  confidence: number;
  tokens?: string[];
  suffixes?: string[];
  prefixes?: string[];
  description: string;
}

/** Ordered rules — first match wins for the name channel. */
const NAME_RULES: NameRule[] = [
  { type: 'EMAIL', confidence: 0.95, tokens: ['email', 'mail', 'e_mail'], description: 'E-mail address' },
  { type: 'URL', confidence: 0.9, tokens: ['url', 'link', 'website', 'homepage'], description: 'URL / web address' },
  { type: 'UUID', confidence: 0.95, tokens: ['uuid', 'guid'], description: 'UUID identifier' },
  { type: 'PHONE_NUMBER', confidence: 0.92, tokens: ['phone', 'mobile', 'tel', 'telephone', 'fax'], description: 'Phone number' },
  {
    type: 'PERSON_NAME',
    confidence: 0.85,
    tokens: ['first_name', 'last_name', 'firstname', 'lastname', 'fullname', 'full_name', 'fname', 'lname', 'name'],
    description: 'Person name',
  },
  {
    type: 'DATE_TIMESTAMP',
    confidence: 0.9,
    tokens: ['date', 'time', 'created', 'updated', 'deleted', 'timestamp', 'dob', 'birthday', 'expires', 'expiry'],
    suffixes: ['_at', '_on', '_date', '_time', '_until', '_since'],
    description: 'Date or timestamp',
  },
  {
    type: 'CURRENCY_PRICE',
    confidence: 0.88,
    tokens: ['price', 'amount', 'cost', 'total', 'subtotal', 'revenue', 'salary', 'fee', 'payment', 'discount', 'balance', 'budget'],
    description: 'Currency / monetary amount',
  },
  {
    type: 'LOCATION_ADDRESS',
    confidence: 0.85,
    tokens: ['city', 'state', 'country', 'address', 'street', 'zip', 'zipcode', 'postal', 'location', 'latitude', 'longitude', 'region'],
    description: 'Location or address component',
  },
  {
    type: 'ORGANIZATION_COMPANY',
    confidence: 0.85,
    tokens: ['company', 'org', 'organization', 'vendor', 'supplier', 'brand', 'manufacturer', 'publisher', 'department', 'studio'],
    description: 'Organization / company',
  },
  {
    type: 'PRODUCT_ITEM',
    confidence: 0.8,
    tokens: ['product', 'item', 'title', 'sku', 'book', 'movie', 'song', 'article'],
    description: 'Product or item title',
  },
  {
    type: 'CATEGORY_TYPE',
    confidence: 0.78,
    tokens: ['type', 'category', 'status', 'kind', 'genre', 'priority', 'level', 'tier', 'stage', 'severity'],
    description: 'Categorical label (low cardinality)',
  },
  {
    type: 'BOOLEAN_FLAG',
    confidence: 0.7,
    prefixes: ['is_', 'has_'],
    tokens: ['active', 'enabled', 'verified', 'flag'],
    description: 'Boolean-like flag',
  },
  {
    type: 'NUMERIC_METRIC',
    confidence: 0.8,
    tokens: ['count', 'qty', 'quantity', 'stock', 'score', 'rating', 'age', 'year', 'views', 'likes', 'downloads'],
    description: 'Numeric measure',
  },
];

const PERSON_EXCLUDES = new Set(['product', 'item', 'company', 'file', 'table', 'column', 'field']);

// ---------------------------------------------------------------------------
// Value-pattern detectors
// ---------------------------------------------------------------------------

export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^(https?:\/\/|www\.)\S+$/i,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  phone: /^\+?[\d\s\-().]{7,17}$/,
  integer: /^[+-]?\d+$/,
  numeric: /^[+-]?\d*\.?\d+([eE][+-]?\d+)?$/,
  boolean: /^(true|false|yes|no|y|n|0|1)$/i,
  isoDate: /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?(Z|[+-]\d{2}:?\d{2})?$/,
  slashDate: /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/,
  textualDate: /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/,
} as const;

export function looksLikeDate(v: string): boolean {
  return patterns.isoDate.test(v) || patterns.slashDate.test(v) || patterns.textualDate.test(v) || (!isNaN(Date.parse(v)) && /\d{4}/.test(v) && v.length > 5 && !patterns.numeric.test(v));
}

function valueEvidence(samples: string[], filled: number, distinct: number): Array<{ type: EntityType_; ratio: number }> {
  if (samples.length === 0 || filled === 0) return [];
  const n = samples.length;
  const out: Array<{ type: EntityType_; ratio: number }> = [];

  const countMatching = (test: (v: string) => boolean): number => samples.reduce((acc, v) => acc + (test(v) ? 1 : 0), 0);

  const email = countMatching(v => patterns.email.test(v));
  if (email > 0) out.push({ type: 'EMAIL', ratio: email / n });
  const url = countMatching(v => patterns.url.test(v));
  if (url > 0) out.push({ type: 'URL', ratio: url / n });
  const uuid = countMatching(v => patterns.uuid.test(v));
  if (uuid > 0) out.push({ type: 'UUID', ratio: uuid / n });
  const date = countMatching(looksLikeDate);
  if (date > 0) out.push({ type: 'DATE_TIMESTAMP', ratio: date / n });
  const bool = countMatching(v => patterns.boolean.test(v.trim()));
  if (bool > 0) out.push({ type: 'BOOLEAN_FLAG', ratio: bool / n });
  const num = countMatching(v => patterns.numeric.test(v.replace(/[$,\s]/g, '')));
  if (num > 0) out.push({ type: 'NUMERIC_METRIC', ratio: num / n });

  // Low cardinality → categorical (strictly fewer distinct values than rows).
  if (distinct > 0 && distinct <= 32 && distinct < Math.max(filled, 1)) {
    out.push({ type: 'CATEGORY_TYPE', ratio: 0.85 });
  }
  // High-cardinality integers behave like identifiers.
  const ints = countMatching(v => patterns.integer.test(v));
  if (ints / n >= 0.95 && distinct > filled * 0.85) {
    out.push({ type: 'FOREIGN_KEY_REF', ratio: 0.55 });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function nameEvidence(
  tableName: string,
  columnName: string,
): { type: EntityType_; confidence: number; description: string } {
  const colTokens = tokenizeName(columnName);
  if (colTokens.length === 0) {
    return { type: 'GENERAL_TEXT', confidence: 0.3, description: 'Text attribute' };
  }
  const joined = colTokens.join('_');
  const tableSingular = singularize(tableName);

  // Structural id rules first.
  if (joined === 'id') {
    return { type: 'PRIMARY_KEY_ID', confidence: 0.95, description: 'Primary key identifier' };
  }
  const last = colTokens[colTokens.length - 1];
  if (last === 'id') {
    if (joined === `${tableSingular}_id` || (colTokens.length === 2 && colTokens[0] === tableSingular)) {
      return { type: 'PRIMARY_KEY_ID', confidence: 0.9, description: 'Primary key identifier' };
    }
    return { type: 'FOREIGN_KEY_REF', confidence: 0.9, description: 'Foreign key reference' };
  }
  if (['key', 'code', 'no', 'num', 'number'].some(t => last === t)) {
    return { type: 'FOREIGN_KEY_REF', confidence: 0.75, description: 'Foreign key reference' };
  }

  for (const rule of NAME_RULES) {
    const tokenHit = rule.tokens?.some(t =>
      t.includes('_') ? joined === t || joined.endsWith(`_${t}`) : colTokens.includes(t),
    );
    const suffixHit = rule.suffixes?.some(s => joined.endsWith(s));
    const prefixHit = rule.prefixes?.some(p => joined.startsWith(p));

    if (tokenHit || suffixHit || prefixHit) {
      // Disambiguate generic "name" columns: product_name is not a person.
      if (rule.type === 'PERSON_NAME' && colTokens.some(t => PERSON_EXCLUDES.has(t))) {
        return { type: 'PRODUCT_ITEM', confidence: 0.8, description: 'Product or item title' };
      }
      return { type: rule.type, confidence: rule.confidence, description: rule.description };
    }
  }

  return { type: 'GENERAL_TEXT', confidence: 0.4, description: 'Text attribute' };
}

/**
 * Whether value evidence of `valueType` is allowed to redefine a column whose
 * name already suggests `nameType`. Compatible/subsumed signals (numeric
 * values in id or price columns, categorical values in status columns) never
 * override — they only corroborate when identical.
 */
function canOverride(nameType: EntityType_, valueType: EntityType_): boolean {
  const NUMERIC_SUBSUMED: EntityType_[] = [
    'PRIMARY_KEY_ID',
    'FOREIGN_KEY_REF',
    'CURRENCY_PRICE',
    'NUMERIC_METRIC',
    'DATE_TIMESTAMP',
    'UUID',
    'BOOLEAN_FLAG',
  ];
  if (valueType === 'NUMERIC_METRIC') return !NUMERIC_SUBSUMED.includes(nameType);
  if (valueType === 'CATEGORY_TYPE') return nameType === 'GENERAL_TEXT';
  if (nameType === 'CATEGORY_TYPE' || nameType === 'BOOLEAN_FLAG') return false;
  return true;
}

export interface ClassifyInput {
  tableName: string;
  columnName: string;
  columnIndex: number;
  stats: ColumnSampleStats;
}

/** Fuse name + value evidence into a single {@link EntityTag}. */
export function classifyColumn({ tableName, columnName, columnIndex, stats }: ClassifyInput): EntityTag {
  let best = nameEvidence(tableName, columnName);
  let confidence = best.confidence;
  const evidence = valueEvidence(stats.samples, stats.filled, stats.distinct);

  for (const { type, ratio } of evidence) {
    if (type === best.type) {
      confidence = Math.min(0.99, confidence + 0.35); // corroboration boost
      continue;
    }
    if (!canOverride(best.type, type)) continue;

    const fused = best.confidence * 0.6 + ratio * 0.4;
    const strongOverride = ratio >= 0.9 && best.confidence < 0.8;
    if (fused > confidence || strongOverride) {
      best = {
        type,
        confidence: Math.max(fused, Math.min(ratio, 0.97)),
        description: NAME_RULES.find(r => r.type === type)?.description ?? type,
      };
      confidence = best.confidence;
    }
  }

  const highCardinality = stats.distinct > 0 && stats.distinct >= Math.max(1, stats.filled) * 0.95;

  // Structural override: unique first column behaves like a PK.
  if (
    columnIndex === 0 &&
    highCardinality &&
    ['FOREIGN_KEY_REF', 'NUMERIC_METRIC', 'GENERAL_TEXT', 'CATEGORY_TYPE'].includes(best.type)
  ) {
    best = { type: 'PRIMARY_KEY_ID', confidence: Math.max(confidence, 0.85), description: 'Primary key identifier' };
    confidence = best.confidence;
  }

  // A confirmed-unique `<table>_id` inside its own table is that table's PK.
  if (best.type === 'FOREIGN_KEY_REF' && highCardinality) {
    const tokens = tokenizeName(columnName);
    const tableSingular = singularize(tableName);
    if (tokens[tokens.length - 1] === 'id') {
      const stem = tokens[tokens.length - 2] ?? '';
      if (stem === tableSingular || tokens.length === 1) {
        best = { type: 'PRIMARY_KEY_ID', confidence: Math.max(confidence, 0.88), description: 'Primary key identifier' };
        confidence = best.confidence;
      }
    }
  }

  return {
    columnName,
    tableName,
    entityType: best.type as EntityType,
    confidence: Number(Math.min(0.99, Math.max(0.05, confidence)).toFixed(3)),
    sampleValues: stats.samples.slice(0, 5),
    description: best.description,
  };
}
