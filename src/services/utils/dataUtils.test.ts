import { describe, expect, it } from 'vitest';
import { DataUtils } from './dataUtils';

describe('DataUtils', () => {
  describe('isIndexColumn (BUG-ING-01)', () => {
    it('does NOT flag primary key identifier columns as index columns', () => {
      const pkNames = [
        'id', 'ID', 'Id', '_id',
        'customer_id', 'order_id', 'user_id', 'product_id',
        'sn', 'SN', 'serial_number',
        'no', 'No', 'no.', 'item_no', 'invoice_no',
        'idx', 'IDX', 'index',
        'code', 'key', 'pk'
      ];

      for (const name of pkNames) {
        expect(DataUtils.isIndexColumn(name), `Expected "${name}" NOT to be an index column`).toBe(false);
      }
    });

    it('identifies synthetic unnamed or empty columns as index columns', () => {
      expect(DataUtils.isIndexColumn('')).toBe(true);
      expect(DataUtils.isIndexColumn('   ')).toBe(true);
      expect(DataUtils.isIndexColumn('Unnamed: 0')).toBe(true);
      expect(DataUtils.isIndexColumn('unnamed: 1')).toBe(true);
      expect(DataUtils.isIndexColumn('Unnamed: 42')).toBe(true);
    });

    it('preserves Unnamed: 0 columns when column values contain real user data rather than sequential numbers', () => {
      expect(DataUtils.isIndexColumn('Unnamed: 0', ['Alice', 'Bob', 'Charlie'])).toBe(false);
      expect(DataUtils.isIndexColumn('Unnamed: 0', [0, 1, 2])).toBe(true);
    });

    it('preserves pure numeric headers like 2024 or 101', () => {
      expect(DataUtils.isIndexColumn('2024')).toBe(false);
      expect(DataUtils.isIndexColumn('101')).toBe(false);
    });
  });

  describe('inferDataType (BUG-ING-09)', () => {
    describe('Strings starting with numbers (parseFloat false positive)', () => {
      it('infers string for street addresses starting with digits', () => {
        expect(DataUtils.inferDataType(['123 Elm St', '456 Oak Ave', '789 Pine Rd'])).toBe('string');
        expect(DataUtils.inferDataType(['10 Downing Street', '221B Baker St'])).toBe('string');
      });

      it('infers string for HTTP status messages or alphanumeric codes', () => {
        expect(DataUtils.inferDataType(['404 Not Found', '200 OK', '500 Server Error'])).toBe('string');
        expect(DataUtils.inferDataType(['1st place', '2nd place', '3rd place'])).toBe('string');
        expect(DataUtils.inferDataType(['3M', '7-Eleven', '4chan'])).toBe('string');
      });
    });

    describe('Numeric inference (integer vs decimal)', () => {
      it('infers integer for whole numbers', () => {
        expect(DataUtils.inferDataType(['1', '2', '3', '100', '-50'])).toBe('integer');
        expect(DataUtils.inferDataType([1, 2, 3, 100, -50])).toBe('integer');
      });

      it('infers decimal for numbers containing decimals', () => {
        expect(DataUtils.inferDataType(['3.14', '2.718', '0.001'])).toBe('decimal');
        expect(DataUtils.inferDataType(['10', '20.5', '30'])).toBe('decimal');
      });
    });

    describe('Boolean vs Binary Identifiers', () => {
      it('does NOT infer boolean for binary flags 0 and 1', () => {
        expect(DataUtils.inferDataType(['0', '1', '1', '0'])).toBe('integer');
        expect(DataUtils.inferDataType([0, 1, 1, 0])).toBe('integer');
      });

      it('infers boolean for literal true and false', () => {
        expect(DataUtils.inferDataType(['true', 'false', 'True', 'False'])).toBe('boolean');
        expect(DataUtils.inferDataType([true, false, true])).toBe('boolean');
        expect(DataUtils.inferDataType(['yes', 'no', 'YES', 'NO'])).toBe('boolean');
      });

      it('infers string when mixed with invalid boolean values', () => {
        expect(DataUtils.inferDataType(['true', 'false', 'unknown'])).toBe('string');
      });
    });

    describe('Date vs Pure Numbers (Date.parse false positive)', () => {
      it('does NOT infer date for small numbers or sequential IDs', () => {
        expect(DataUtils.inferDataType(['1', '2', '3', '4'])).toBe('integer');
        expect(DataUtils.inferDataType(['100', '200', '300'])).toBe('integer');
        expect(DataUtils.inferDataType(['2024', '2025', '2026'])).toBe('integer');
      });

      it('infers date for standard ISO and formatted calendar dates', () => {
        expect(DataUtils.inferDataType(['2025-01-15', '2025-02-20', '2025-12-31'])).toBe('date');
        expect(DataUtils.inferDataType(['2025-01-15T12:00:00Z', '2025-02-20T18:30:00.000Z'])).toBe('date');
        expect(DataUtils.inferDataType(['01/15/2025', '02/20/2025', '12/31/2025'])).toBe('date');
      });

      it('does not infer date for invalid calendar dates like leap year violations', () => {
        expect(DataUtils.inferDataType(['2023-02-29'])).toBe('string');
      });
    });

    describe('Semantic types (email, url, phone)', () => {
      it('infers email for email addresses', () => {
        expect(DataUtils.inferDataType(['alice@corp.com', 'bob.smith@university.edu'])).toBe('email');
      });

      it('infers url for web addresses', () => {
        expect(DataUtils.inferDataType(['https://normaflow.dev', 'http://example.com/api'])).toBe('url');
      });

      it('infers phone for standard phone numbers', () => {
        expect(DataUtils.inferDataType(['+1-800-555-0199', '(555) 234-5678', '555-123-4567'])).toBe('phone');
      });
    });

    describe('Degenerate and dirty samples', () => {
      it('handles nulls, undefined, and empty strings within samples', () => {
        expect(DataUtils.inferDataType([null, undefined, '', '42', '100'])).toBe('integer');
        expect(DataUtils.inferDataType([null, undefined, '', '   '])).toBe('string');
        expect(DataUtils.inferDataType([])).toBe('string');
      });
    });
  });

  describe('cleanValue (BUG-ING-10)', () => {
    it('converts standard null representations to empty string', () => {
      expect(DataUtils.cleanValue(null)).toBe('');
      expect(DataUtils.cleanValue(undefined)).toBe('');
      expect(DataUtils.cleanValue('')).toBe('');
      expect(DataUtils.cleanValue('null')).toBe('');
      expect(DataUtils.cleanValue('NULL')).toBe('');
      expect(DataUtils.cleanValue('undefined')).toBe('');
    });

    it('preserves legitimate zero and false values', () => {
      expect(DataUtils.cleanValue(0)).toBe('0');
      expect(DataUtils.cleanValue('0')).toBe('0');
      expect(DataUtils.cleanValue(false)).toBe('false');
      expect(DataUtils.cleanValue('false')).toBe('false');
    });

    it('trims leading and trailing whitespace on regular strings', () => {
      expect(DataUtils.cleanValue('   hello world   ')).toBe('hello world');
    });
  });

  describe('isAtomic (1NF check)', () => {
    it('returns true for atomic values', () => {
      expect(DataUtils.isAtomic('Laptop')).toBe(true);
      expect(DataUtils.isAtomic('12345')).toBe(true);
      expect(DataUtils.isAtomic('2025-01-01')).toBe(true);
      expect(DataUtils.isAtomic('John Doe')).toBe(true);
      expect(DataUtils.isAtomic('')).toBe(true);
      expect(DataUtils.isAtomic(null)).toBe(true);
    });

    it('returns false for non-atomic values containing delimiters or collections', () => {
      expect(DataUtils.isAtomic('Red, Blue, Green')).toBe(false);
      expect(DataUtils.isAtomic('A; B; C')).toBe(false);
      expect(DataUtils.isAtomic('Alpha | Beta')).toBe(false);
      expect(DataUtils.isAtomic('Reading and Writing')).toBe(false);
      expect(DataUtils.isAtomic('[1, 2, 3]')).toBe(false);
      expect(DataUtils.isAtomic('{"key": "value"}')).toBe(false);
    });
  });

  describe('normalizeName & Attribute Validation', () => {
    it('normalizes column names for SQL compatibility', () => {
      expect(DataUtils.normalizeName('First Name')).toBe('first_name');
      expect(DataUtils.normalizeName('Total-Amount-USD')).toBe('total_amount_usd');
      expect(DataUtils.normalizeName('___raw_data___')).toBe('raw_data');
    });

    it('detects SQL reserved words and invalid names', () => {
      expect(DataUtils.isValidAttributeName('valid_name')).toBe(true);
      expect(DataUtils.isValidAttributeName('select')).toBe(false);
      expect(DataUtils.isValidAttributeName('table')).toBe(false);
      expect(DataUtils.isValidAttributeName('123col')).toBe(false);
    });

    it('suggests safe attribute names for invalid or reserved identifiers', () => {
      expect(DataUtils.suggestValidAttributeName('select')).toBe('select_attr');
      expect(DataUtils.suggestValidAttributeName('123col')).toBe('attr_123col');
    });

    it('calculates numeric summary statistics', () => {
      const stats = DataUtils.calculateNumericStats([10, 20, 30, 40, 50]);
      expect(stats).not.toBeNull();
      expect(stats?.min).toBe(10);
      expect(stats?.max).toBe(50);
      expect(stats?.mean).toBe(30);
      expect(stats?.median).toBe(30);
      expect(stats?.count).toBe(5);

      expect(DataUtils.calculateNumericStats(['a', 'b'])).toBeNull();
    });
  });
});
