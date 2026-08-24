import { describe, expect, it } from 'vitest';
import { classifyColumn, singularize, tokenizeName } from './services/nlp/semanticProfiler';

const stats = (samples: string[], distinct?: number) => ({
  samples,
  filled: samples.length,
  distinct: distinct ?? new Set(samples).size,
});

describe('tokenizeName', () => {
  it('splits snake_case, camelCase and kebab-case', () => {
    expect(tokenizeName('customer_id')).toEqual(['customer', 'id']);
    expect(tokenizeName('firstName')).toEqual(['first', 'name']);
    expect(tokenizeName('Created-At')).toEqual(['created', 'at']);
  });
});

describe('singularize', () => {
  it('strips only trailing plural s', () => {
    expect(singularize('customers')).toBe('customer');
    expect(singularize('address')).toBe('address');
    expect(singularize('status')).toBe('status');
    expect(singularize('bus')).toBe('bus');
  });
});

describe('classifyColumn', () => {
  it('identifies primary key by table-scoped id name', () => {
    const tag = classifyColumn({
      tableName: 'customers',
      columnName: 'customer_id',
      columnIndex: 0,
      stats: stats(['1', '2', '3']),
    });
    expect(tag.entityType).toBe('PRIMARY_KEY_ID');
  });

  it('marks foreign-key-shaped ids referencing other tables', () => {
    const tag = classifyColumn({
      tableName: 'orders',
      columnName: 'customer_id',
      columnIndex: 1,
      stats: stats(['7', '7', '9']),
    });
    expect(tag.entityType).toBe('FOREIGN_KEY_REF');
  });

  it('detects emails purely from values when the name is generic', () => {
    const tag = classifyColumn({
      tableName: 'contacts',
      columnName: 'info_field',
      columnIndex: 2,
      stats: stats(['a@b.com', 'c@d.org', 'e@f.net']),
    });
    expect(tag.entityType).toBe('EMAIL');
  });

  it('detects ISO dates from values', () => {
    const tag = classifyColumn({
      tableName: 'events',
      columnName: 'moment',
      columnIndex: 3,
      stats: stats(['2025-01-15', '2025-02-20', '2025-03-25']),
    });
    expect(tag.entityType).toBe('DATE_TIMESTAMP');
  });

  it('classifies low-cardinality text as category', () => {
    const tag = classifyColumn({
      tableName: 'products',
      columnName: 'mystery',
      columnIndex: 4,
      stats: stats(['red', 'blue', 'red', 'blue'], 2),
    });
    expect(tag.entityType).toBe('CATEGORY_TYPE');
  });

  it('does not mistake product names for person names', () => {
    const tag = classifyColumn({
      tableName: 'items',
      columnName: 'product_name',
      columnIndex: 5,
      stats: stats(['Laptop', 'Mouse', 'Keyboard']),
    });
    expect(tag.entityType).not.toBe('PERSON_NAME');
  });

  it('detects currency by name', () => {
    const tag = classifyColumn({
      tableName: 'orders',
      columnName: 'total_price',
      columnIndex: 6,
      stats: stats(['10.50', '9.99']),
    });
    expect(tag.entityType).toBe('CURRENCY_PRICE');
  });

  it('boosts confidence when name and values agree on email', () => {
    const weak = classifyColumn({
      tableName: 't',
      columnName: 'contact_info',
      columnIndex: 0,
      stats: stats(['hello world']),
    });
    const strong = classifyColumn({
      tableName: 't',
      columnName: 'email_address',
      columnIndex: 0,
      stats: stats(['a@b.com', 'x@y.com']),
    });
    expect(strong.entityType).toBe('EMAIL');
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
  });
});
