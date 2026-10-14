import { describe, expect, it } from 'vitest';
import { DataUtils } from '../services/utils/dataUtils';
import { DataProcessor } from '../services/processors/dataProcessor';

describe('Adversarial Stress Test Suite: DataUtils & DataProcessor', () => {
  // =========================================================================
  // 1. SCIENTIFIC NOTATION STRESS TESTS
  // =========================================================================
  describe('1. Scientific Notation Parsing & Type Inference', () => {
    it('infers decimal for standard positive exponents', () => {
      expect(DataUtils.inferDataType(['1e5', '2e6', '3e10'])).toBe('decimal');
      expect(DataUtils.inferDataType(['1E5', '2E6', '3E10'])).toBe('decimal');
      expect(DataUtils.inferDataType(['1e+5', '2e+6', '3e+10'])).toBe('decimal');
      expect(DataUtils.inferDataType(['1E+5', '2E+6', '3E+10'])).toBe('decimal');
    });

    it('infers decimal for negative exponents', () => {
      expect(DataUtils.inferDataType(['1e-5', '2e-6', '3e-10'])).toBe('decimal');
      expect(DataUtils.inferDataType(['1E-5', '2E-6', '3E-10'])).toBe('decimal');
      expect(DataUtils.inferDataType(['2.5e-3', '7.89E-8'])).toBe('decimal');
    });

    it('infers decimal for scientific notation with signs and decimals in mantissa', () => {
      expect(DataUtils.inferDataType(['+1.23e4', '-4.56E-7', '3.14159e+2'])).toBe('decimal');
      expect(DataUtils.inferDataType(['-0.001e-2', '+0.5e3'])).toBe('decimal');
    });

    it('infers decimal for leading dot with exponents', () => {
      expect(DataUtils.inferDataType(['.5e2', '.123e-4', '-.5E3', '+.25e-1'])).toBe('decimal');
    });

    it('infers decimal for zero base with exponents', () => {
      expect(DataUtils.inferDataType(['0e0', '0E5', '-0e-2', '0.0e0'])).toBe('decimal');
    });

    it('infers decimal for extreme finite exponents near IEEE 754 boundaries', () => {
      expect(DataUtils.inferDataType(['1.79e308', '1e-300'])).toBe('decimal');
      expect(DataUtils.inferDataType(['5e-324'])).toBe('decimal');
    });

    it('rejects malformed scientific notation as string (never decimal or integer)', () => {
      // Incomplete exponent
      expect(DataUtils.inferDataType(['1e', '2e+', '3E-'])).toBe('string');
      // Missing mantissa
      expect(DataUtils.inferDataType(['e5', 'E-3', '.e5', '+e2'])).toBe('string');
      // Decimal in exponent
      expect(DataUtils.inferDataType(['1e2.5', '1E-1.2'])).toBe('string');
      // Multiple exponents
      expect(DataUtils.inferDataType(['1e2e3', '1e5E2'])).toBe('string');
      // Overflow to Infinity in JS
      expect(DataUtils.inferDataType(['1e309', '1e999999999'])).toBe('string');
      // Alphanumeric with e
      expect(DataUtils.inferDataType(['room1e', 'hex0x1e', 'apple5e2'])).toBe('string');
    });
  });

  // =========================================================================
  // 2. LEADING/TRAILING DOTS & NUMERIC BOUNDARIES
  // =========================================================================
  describe('2. Leading/Trailing Dots, Signs, and Boundaries', () => {
    it('infers decimal for floats with leading dot', () => {
      expect(DataUtils.inferDataType(['.5', '.75', '.12345'])).toBe('decimal');
      expect(DataUtils.inferDataType(['-.5', '+.75', '-.001'])).toBe('decimal');
    });

    it('infers decimal for floats with trailing dot', () => {
      expect(DataUtils.inferDataType(['5.', '10.', '100.'])).toBe('decimal');
      expect(DataUtils.inferDataType(['-5.', '+10.'])).toBe('decimal');
    });

    it('rejects lone dot or multiple dots as string', () => {
      expect(DataUtils.inferDataType(['.'])).toBe('string');
      expect(DataUtils.inferDataType(['..', '...', '1.2.3'])).toBe('string');
      expect(DataUtils.inferDataType(['192.168.1.1'])).toBe('string');
    });

    it('correctly classifies signed integers', () => {
      expect(DataUtils.inferDataType(['+0', '-0', '0'])).toBe('integer');
      expect(DataUtils.inferDataType(['+1', '+42', '+999999'])).toBe('integer');
      expect(DataUtils.inferDataType(['-1', '-42', '-999999'])).toBe('integer');
    });

    it('rejects multiple or misplaced signs as string', () => {
      expect(DataUtils.inferDataType(['--5', '++5', '+-5', '-+5'])).toBe('string');
      expect(DataUtils.inferDataType(['5-', '5+', '1-2'])).toBe('string');
    });
  });

  // =========================================================================
  // 3. DIRTY TEXT WITH NUMBERS (AVOIDING GREEDY PARSEFLOAT)
  // =========================================================================
  describe('3. Dirty Text with Numbers (Greedy parseFloat Prevention)', () => {
    it('infers string for street addresses starting with digits', () => {
      const addresses = [
        '10 Downing Street',
        '221B Baker St',
        '742 Evergreen Terrace',
        '1600 Pennsylvania Avenue NW',
        '350 5th Ave'
      ];
      expect(DataUtils.inferDataType(addresses)).toBe('string');
    });

    it('infers string for units, currencies, and percentages', () => {
      expect(DataUtils.inferDataType(['100 meters', '50 km', '25 kg', '12 px'])).toBe('string');
      expect(DataUtils.inferDataType(['$100', '€50', '£20', '100 USD', '50 EUR'])).toBe('string');
      expect(DataUtils.inferDataType(['100%', '50.5%', '0%'])).toBe('string');
    });

    it('infers string for HTTP status codes, room numbers, and error messages', () => {
      expect(DataUtils.inferDataType(['404 Not Found', '200 OK', '500 Server Error'])).toBe('string');
      expect(DataUtils.inferDataType(['Room 404', 'Gate 12', 'Terminal 3', 'Apt 4B'])).toBe('string');
      expect(DataUtils.inferDataType(['Error 0', 'Code 101', 'Warning 42'])).toBe('string');
    });

    it('infers string for ordinals and alphanumeric brands', () => {
      expect(DataUtils.inferDataType(['1st', '2nd', '3rd', '4th', '100th'])).toBe('string');
      expect(DataUtils.inferDataType(['3M', '7-Eleven', '4chan', 'Web3', 'B2B'])).toBe('string');
      expect(DataUtils.inferDataType(['v1.0.0', 'release-2.5', 'build#42'])).toBe('string');
    });

    it('infers string for formatted numbers containing commas or spaces', () => {
      expect(DataUtils.inferDataType(['1,000', '1,000,000', '2,500.50'])).toBe('string');
      expect(DataUtils.inferDataType(['1 000', '10 000'])).toBe('string');
    });
  });

  // =========================================================================
  // 4. BINARY ARRAYS VS BOOLEANS
  // =========================================================================
  describe('4. Binary Identifiers vs Boolean Values', () => {
    it('infers integer (NEVER boolean) for binary flags [0, 1] as numbers', () => {
      expect(DataUtils.inferDataType([0, 1])).toBe('integer');
      expect(DataUtils.inferDataType([0, 0, 0, 0])).toBe('integer');
      expect(DataUtils.inferDataType([1, 1, 1, 1])).toBe('integer');
      expect(DataUtils.inferDataType([0, 1, 1, 0, 1])).toBe('integer');
    });

    it('infers integer (NEVER boolean) for binary flags ["0", "1"] as strings', () => {
      expect(DataUtils.inferDataType(['0', '1'])).toBe('integer');
      expect(DataUtils.inferDataType(['0', '0'])).toBe('integer');
      expect(DataUtils.inferDataType(['1', '1'])).toBe('integer');
      expect(DataUtils.inferDataType(['0', '1', '1', '0'])).toBe('integer');
    });

    it('infers boolean for standard boolean literals and case variants', () => {
      expect(DataUtils.inferDataType([true, false])).toBe('boolean');
      expect(DataUtils.inferDataType([true, true])).toBe('boolean');
      expect(DataUtils.inferDataType([false, false])).toBe('boolean');
      expect(DataUtils.inferDataType(['true', 'false'])).toBe('boolean');
      expect(DataUtils.inferDataType(['TRUE', 'FALSE'])).toBe('boolean');
      expect(DataUtils.inferDataType(['True', 'False'])).toBe('boolean');
      expect(DataUtils.inferDataType(['yes', 'no'])).toBe('boolean');
      expect(DataUtils.inferDataType(['YES', 'NO'])).toBe('boolean');
      expect(DataUtils.inferDataType(['Yes', 'No'])).toBe('boolean');
    });

    it('infers string for ambiguous or mixed boolean text', () => {
      expect(DataUtils.inferDataType(['true', 'false', 'maybe'])).toBe('string');
      expect(DataUtils.inferDataType(['yes', 'no', 'perhaps'])).toBe('string');
      expect(DataUtils.inferDataType(['true', 1])).toBe('string');
      expect(DataUtils.inferDataType(['false', 0])).toBe('string');
      expect(DataUtils.inferDataType(['on', 'off'])).toBe('string');
      expect(DataUtils.inferDataType(['t', 'f'])).toBe('string');
      expect(DataUtils.inferDataType(['y', 'n'])).toBe('string');
    });
  });

  // =========================================================================
  // 5. CALENDAR DATES VS INVALID DATES & PURE NUMBERS
  // =========================================================================
  describe('5. Calendar Dates, Leap Years, and Invalid Dates', () => {
    it('infers date for valid leap-year Feb 29 (divisible by 4, 400)', () => {
      expect(DataUtils.inferDataType(['2024-02-29'])).toBe('date');
      expect(DataUtils.inferDataType(['2020-02-29'])).toBe('date');
      expect(DataUtils.inferDataType(['2000-02-29'])).toBe('date'); // 400-year leap rule
      expect(DataUtils.inferDataType(['2024/02/29'])).toBe('date');
      expect(DataUtils.inferDataType(['02/29/2024'])).toBe('date');
    });

    it('rejects invalid Feb 29 on non-leap years (century non-leap and regular non-leap)', () => {
      expect(DataUtils.inferDataType(['2023-02-29'])).toBe('string');
      expect(DataUtils.inferDataType(['2025-02-29'])).toBe('string');
      expect(DataUtils.inferDataType(['2021-02-29'])).toBe('string');
      expect(DataUtils.inferDataType(['1900-02-29'])).toBe('string'); // 100-year non-leap rule
      expect(DataUtils.inferDataType(['2100-02-29'])).toBe('string'); // 100-year non-leap rule
      expect(DataUtils.inferDataType(['02/29/2023'])).toBe('string');
    });

    it('rejects calendar days exceeding month capacity', () => {
      expect(DataUtils.inferDataType(['2024-02-30'])).toBe('string');
      expect(DataUtils.inferDataType(['2024-04-31'])).toBe('string'); // April has 30 days
      expect(DataUtils.inferDataType(['2024-06-31'])).toBe('string'); // June has 30 days
      expect(DataUtils.inferDataType(['2024-09-31'])).toBe('string'); // September has 30 days
      expect(DataUtils.inferDataType(['2024-11-31'])).toBe('string'); // November has 30 days
    });

    it('rejects out-of-range months and days', () => {
      expect(DataUtils.inferDataType(['2024-00-15'])).toBe('string');
      expect(DataUtils.inferDataType(['2024-13-15'])).toBe('string');
      expect(DataUtils.inferDataType(['2024-01-00'])).toBe('string');
      expect(DataUtils.inferDataType(['2024-01-32'])).toBe('string');
      expect(DataUtils.inferDataType(['00/15/2024'])).toBe('string');
      expect(DataUtils.inferDataType(['13/15/2024'])).toBe('string');
    });

    it('infers date for full ISO-8601 datetimes with timezone offsets', () => {
      expect(DataUtils.inferDataType(['2024-05-15T08:30:00Z'])).toBe('date');
      expect(DataUtils.inferDataType(['2024-05-15 08:30:00'])).toBe('date');
      expect(DataUtils.inferDataType(['2024-05-15T08:30:00.123Z'])).toBe('date');
      expect(DataUtils.inferDataType(['2024-05-15T08:30:00+02:00'])).toBe('date');
      expect(DataUtils.inferDataType(['2024-05-15T08:30:00-05:00'])).toBe('date');
    });

    it('never misclassifies pure numeric years or small numbers as date', () => {
      expect(DataUtils.inferDataType(['2024', '2025', '2026'])).toBe('integer');
      expect(DataUtils.inferDataType(['1999', '2000', '2001'])).toBe('integer');
      expect(DataUtils.inferDataType(['1', '2', '3'])).toBe('integer');
      expect(DataUtils.inferDataType(['100', '200', '300'])).toBe('integer');
      expect(DataUtils.inferDataType(['-2024', '-2025'])).toBe('integer');
    });
  });

  // =========================================================================
  // 6. ZERO AND FALSE VALUE PRESERVATION
  // =========================================================================
  describe('6. Falsy Value Preservation in cleanValue, clean, and profileDataTypes', () => {
    it('preserves 0 and false in DataUtils.cleanValue', () => {
      expect(DataUtils.cleanValue(0)).toBe('0');
      expect(DataUtils.cleanValue('0')).toBe('0');
      expect(DataUtils.cleanValue(-0)).toBe('0');
      expect(DataUtils.cleanValue(0.0)).toBe('0');
      expect(DataUtils.cleanValue('0.0')).toBe('0.0');
      expect(DataUtils.cleanValue(false)).toBe('false');
      expect(DataUtils.cleanValue('false')).toBe('false');
    });

    it('converts null, undefined, NaN, and empty strings to empty string', () => {
      expect(DataUtils.cleanValue(null)).toBe('');
      expect(DataUtils.cleanValue(undefined)).toBe('');
      expect(DataUtils.cleanValue('')).toBe('');
      expect(DataUtils.cleanValue('   ')).toBe('');
      expect(DataUtils.cleanValue('null')).toBe('');
      expect(DataUtils.cleanValue('NULL')).toBe('');
      expect(DataUtils.cleanValue('undefined')).toBe('');
      expect(DataUtils.cleanValue('n/a')).toBe('');
      expect(DataUtils.cleanValue('N/A')).toBe('');
      expect(DataUtils.cleanValue('nil')).toBe('');
      expect(DataUtils.cleanValue('nan')).toBe('');
      expect(DataUtils.cleanValue('NaN')).toBe('');
      expect(DataUtils.cleanValue('\\n')).toBe('');
    });

    it('preserves rows with zero and false values in DataProcessor.clean', async () => {
      const input = [
        { id: 1, count: 0, active: false, score: 0.0 },
        { id: 2, count: '0', active: 'false', score: '0.0' },
        { id: null, count: undefined, active: '', score: 'null' }, // should be dropped
        { id: 3, count: 10, active: true, score: 99.5 }
      ];

      const cleaned = await DataProcessor.clean(input);
      expect(cleaned).toHaveLength(3);

      expect(cleaned[0]).toEqual({
        id: '1',
        count: '0',
        active: 'false',
        score: '0'
      });

      expect(cleaned[1]).toEqual({
        id: '2',
        count: '0',
        active: 'false',
        score: '0.0'
      });

      expect(cleaned[2]).toEqual({
        id: '3',
        count: '10',
        active: 'true',
        score: '99.5'
      });
    });

    it('correctly profiles columns with zero or false values in DataProcessor.profileDataTypes', async () => {
      const data = [
        { zero_int: 0, zero_str: '0', zero_dec: '0.0', bool_val: false, bool_str: 'false' },
        { zero_int: 0, zero_str: '0', zero_dec: '0.00', bool_val: true, bool_str: 'true' }
      ];

      const types = await DataProcessor.profileDataTypes(data);
      expect(types.zero_int).toBe('integer');
      expect(types.zero_str).toBe('integer');
      expect(types.zero_dec).toBe('decimal');
      expect(types.bool_val).toBe('boolean');
      expect(types.bool_str).toBe('boolean');
    });

    it('handles empty datasets and degenerate rows in DataProcessor.clean', async () => {
      expect(await DataProcessor.clean([])).toEqual([]);
      expect(await DataProcessor.clean(null as any)).toEqual([]);
      expect(await DataProcessor.clean(undefined as any)).toEqual([]);
      expect(await DataProcessor.clean([{ '': '' }, { ' ': ' ' }])).toEqual([]);
      expect(await DataProcessor.clean([{ a: null }, { b: undefined }])).toEqual([]);
    });
  });

  // =========================================================================
  // 7. INDEX COLUMN FILTERING (ZERO FALSE POSITIVES)
  // =========================================================================
  describe('7. Index Column Filtering & Primary Key Protection', () => {
    it('protects ALL relational primary key column names (zero false positives)', () => {
      const protectedNames = [
        // Standard identifiers
        'id', 'ID', 'Id', 'iD', '_id', 'id_', 'pk', 'PK', 'uuid', 'UUID', 'guid', 'GUID',
        // Serial / Sequence
        'sn', 'SN', 's.n', 's.n.', 's_n', 'serial', 'serial_no', 'serialno',
        // Number identifiers
        'no', 'NO', 'No', 'no.', 'No.', 'num', 'NUM', 'number', 'NUMBER',
        // Index / Sequence
        'idx', 'IDX', 'index', 'INDEX', 'seq', 'SEQ', 'sequence', 'SEQUENCE',
        // Row identifiers
        'row_id', 'ROW_ID', 'row_num', 'row_number', 'ROW_NUMBER',
        // Pure numbers
        '2024', '101', '0', '1', '999',
        // Symbol prefixes
        '#id', '#ID', '#', '$id', '@id', '%id',
        // Business domain identifiers
        'customer_id', 'order_id', 'user_id', 'product_uuid', 'account_no', 'invoice_sn'
      ];

      for (const name of protectedNames) {
        expect(DataUtils.isIndexColumn(name), `Expected "${name}" NOT to be flagged as index column`).toBe(false);
      }
    });

    it('identifies synthetic export artifacts as index columns when values are sequential or omitted', () => {
      expect(DataUtils.isIndexColumn('')).toBe(true);
      expect(DataUtils.isIndexColumn('   ')).toBe(true);
      expect(DataUtils.isIndexColumn('Unnamed: 0')).toBe(true);
      expect(DataUtils.isIndexColumn('unnamed: 1')).toBe(true);
      expect(DataUtils.isIndexColumn('Unnamed: 42')).toBe(true);
      expect(DataUtils.isIndexColumn('__index_level_0__')).toBe(true);
      expect(DataUtils.isIndexColumn('_c0')).toBe(true);
      expect(DataUtils.isIndexColumn('_c10')).toBe(true);

      // With sequential numeric values (0, 1, 2, ...)
      expect(DataUtils.isIndexColumn('Unnamed: 0', [0, 1, 2, 3])).toBe(true);
      expect(DataUtils.isIndexColumn('Unnamed: 0', ['0', '1', '2', '3'])).toBe(true);
      expect(DataUtils.isIndexColumn('Unnamed: 0', [1, 2, 3, 4])).toBe(true);
      expect(DataUtils.isIndexColumn('Unnamed: 0', [null, 0, 1, 2])).toBe(true);
      expect(DataUtils.isIndexColumn('Unnamed: 0', [])).toBe(true);
    });

    it('does NOT drop synthetic artifact name when values contain user data or non-sequential series', () => {
      // User data under Unnamed header
      expect(DataUtils.isIndexColumn('Unnamed: 0', ['Alice', 'Bob', 'Charlie'])).toBe(false);
      // Non-sequential integers (e.g. 10, 20, 30)
      expect(DataUtils.isIndexColumn('Unnamed: 0', [10, 20, 30])).toBe(false);
      // Step size != 1
      expect(DataUtils.isIndexColumn('Unnamed: 0', [0, 2, 4, 6])).toBe(false);
      // Constant values
      expect(DataUtils.isIndexColumn('Unnamed: 0', [0, 0, 0, 0])).toBe(false);
    });
  });

  // =========================================================================
  // 8. ATOMICITY (1NF) & COMPATIBILITY HELPERS
  // =========================================================================
  describe('8. Atomicity (1NF) & Attribute Name Normalization', () => {
    it('correctly assesses atomicity for primitive values', () => {
      expect(DataUtils.isAtomic(0)).toBe(true);
      expect(DataUtils.isAtomic(false)).toBe(true);
      expect(DataUtils.isAtomic('SingleWord')).toBe(true);
      expect(DataUtils.isAtomic('Two Words')).toBe(true);
      expect(DataUtils.isAtomic('')).toBe(true);
      expect(DataUtils.isAtomic(null)).toBe(true);
      expect(DataUtils.isAtomic(undefined)).toBe(true);
    });

    it('identifies non-atomic multi-valued attributes', () => {
      expect(DataUtils.isAtomic('Red, Green, Blue')).toBe(false);
      expect(DataUtils.isAtomic('Item 1; Item 2')).toBe(false);
      expect(DataUtils.isAtomic('Option A | Option B')).toBe(false);
      expect(DataUtils.isAtomic('Alpha & Beta')).toBe(false);
      expect(DataUtils.isAtomic('Cat and Dog')).toBe(false);
      expect(DataUtils.isAtomic('Yes or No')).toBe(false);
      expect(DataUtils.isAtomic('[1, 2, 3]')).toBe(false);
      expect(DataUtils.isAtomic('{"key": "value"}')).toBe(false);
      expect(DataUtils.isAtomic('(10, 20)')).toBe(false);
    });

    it('identifies non-atomic values in DataProcessor.checkAtomicity', async () => {
      const data = [
        { id: 1, tags: 'react, vite, tailwind', role: 'admin' },
        { id: 2, tags: 'rust; tauri', role: 'user' },
        { id: 3, tags: 'node', role: 'manager' }
      ];

      const result = await DataProcessor.checkAtomicity(data);
      expect(result.atomicity.id).toBe(true);
      expect(result.atomicity.role).toBe(true);
      expect(result.atomicity.tags).toBe(false);
      expect(result.violations.tags).toHaveLength(2);
      expect(result.violations.tags[0].row).toBe(1);
      expect(result.violations.tags[1].row).toBe(2);
    });

    it('normalizes attribute names and suggests valid SQL names', () => {
      expect(DataUtils.normalizeName('First Name')).toBe('first_name');
      expect(DataUtils.normalizeName('User-ID-123')).toBe('user_id_123');
      expect(DataUtils.normalizeName('$$$Price$$$')).toBe('price');

      expect(DataUtils.isValidAttributeName('select')).toBe(false);
      expect(DataUtils.isValidAttributeName('from')).toBe(false);
      expect(DataUtils.isValidAttributeName('where')).toBe(false);
      expect(DataUtils.isValidAttributeName('valid_column')).toBe(true);

      expect(DataUtils.suggestValidAttributeName('select')).toBe('select_attr');
      expect(DataUtils.suggestValidAttributeName('123abc')).toBe('attr_123abc');
    });

    it('computes numeric statistics accurately even with 0 and negative values', () => {
      const stats = DataUtils.calculateNumericStats([-10, 0, 10, 20]);
      expect(stats).not.toBeNull();
      expect(stats?.min).toBe(-10);
      expect(stats?.max).toBe(20);
      expect(stats?.mean).toBe(5);
      expect(stats?.median).toBe(5);
      expect(stats?.count).toBe(4);
    });

    it('evaluates semantic equality correctly', () => {
      expect(DataUtils.areValuesEqual(0, '0')).toBe(true);
      expect(DataUtils.areValuesEqual(false, 'false')).toBe(true);
      expect(DataUtils.areValuesEqual('  Hello  ', 'hello')).toBe(true);
      expect(DataUtils.areValuesEqual(null, undefined)).toBe(true);
      expect(DataUtils.areValuesEqual('null', '')).toBe(true);
    });
  });

  // =========================================================================
  // 9. HIGH-THROUGHPUT RANDOMIZED PROPERTY-BASED GENERATOR
  // =========================================================================
  describe('9. High-Throughput Property-Based Generator Stress Test (1000 Cases)', () => {
    it('consistently and accurately infers types for 1,000 synthetic boundary samples', () => {
      // 1. Random Integers
      for (let i = 0; i < 200; i++) {
        const intVal = Math.floor(Math.random() * 2000000) - 1000000;
        expect(DataUtils.inferDataType([String(intVal)])).toBe('integer');
        expect(DataUtils.inferDataType([intVal])).toBe('integer');
      }

      // 2. Random Decimals
      for (let i = 0; i < 200; i++) {
        const floatVal = (Math.random() * 10000 - 5000).toFixed(4);
        expect(DataUtils.inferDataType([floatVal])).toBe('decimal');
      }

      // 3. Random Scientific Notation
      for (let i = 0; i < 200; i++) {
        const mantissa = (Math.random() * 9 + 1).toFixed(2);
        const exp = Math.floor(Math.random() * 50) + 1;
        const sign = Math.random() > 0.5 ? '+' : '-';
        const sciStr = `${mantissa}e${sign}${exp}`;
        expect(DataUtils.inferDataType([sciStr])).toBe('decimal');
      }

      // 4. Random Street Addresses (must NEVER be integer or decimal)
      const streetTypes = ['St', 'Ave', 'Blvd', 'Rd', 'Lane', 'Way'];
      for (let i = 0; i < 200; i++) {
        const num = Math.floor(Math.random() * 9999) + 1;
        const type = streetTypes[i % streetTypes.length];
        const addr = `${num} Main ${type}`;
        expect(DataUtils.inferDataType([addr])).toBe('string');
      }

      // 5. Random Binary Flags (must NEVER be boolean)
      for (let i = 0; i < 100; i++) {
        const len = Math.floor(Math.random() * 10) + 2;
        const binarySample = Array.from({ length: len }, () => (Math.random() > 0.5 ? 1 : 0));
        expect(DataUtils.inferDataType(binarySample)).toBe('integer');
      }

      // 6. Random Calendar Dates
      const validLeapYears = [1980, 1984, 1988, 1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024];
      for (const year of validLeapYears) {
        expect(DataUtils.inferDataType([`${year}-02-29`])).toBe('date');
      }

      const invalidLeapYears = [1981, 1982, 1983, 1985, 1900, 1999, 2001, 2002, 2003, 2021, 2022, 2023];
      for (const year of invalidLeapYears) {
        expect(DataUtils.inferDataType([`${year}-02-29`])).toBe('string');
      }
    });
  });
});
