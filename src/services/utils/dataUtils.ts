/**
 * Data Processing Utilities
 * Author: miskatul-anwar
 * Date: 2025-07-30 05:40:38 UTC
 */

export interface IndexColumnOptions {
  /**
   * If true, allows treating recognized identifier column names (e.g. id, sn, no, idx)
   * as index columns if they are strictly sequential surrogate numbers.
   * Default: false (never discard legitimate primary keys).
   */
  allowDiscardPrimaryKey?: boolean;
}

export class DataUtils {
  /**
   * Normalize attribute names for database compatibility
   */
  static normalizeName(name: string): string {
    if (!name || typeof name !== 'string') return '';
    return name
      .replace(/[\s\-]+/g, "_")           // Replace spaces and hyphens with underscores
      .replace(/[^a-zA-Z0-9_]/g, "")      // Remove non-alphanumeric characters except underscore
      .replace(/^_+|_+$/g, "")            // Remove leading/trailing underscores
      .toLowerCase();                     // Convert to lowercase
  }

  /**
   * Check if a column name represents a surrogate index column artifact.
   * Protects legitimate primary key identifiers (id, sn, no, idx, index, etc.).
   */
  static isIndexColumn(
    columnName: string,
    values?: any[],
    options?: IndexColumnOptions
  ): boolean {
    if (!columnName || typeof columnName !== 'string' || columnName.trim() === '') {
      return true; // Empty headers cannot be retained as relational attributes
    }

    const cleanKey = columnName.trim();
    const lowerKey = cleanKey.toLowerCase();

    // 1. Protected identifiers that must NEVER be discarded as surrogate indices
    const isProtectedKey = (name: string): boolean => {
      const patterns = [
        /^id$/i,
        /^_id$/i,
        /^id_$/i,
        /^pk$/i,
        /^uuid$/i,
        /^guid$/i,
        /^sn$/i,
        /^s\.?n\.?$/i,
        /^s_n$/i,
        /^serial(_?no)?$/i,
        /^no$/i,
        /^no\.?$/i,
        /^num$/i,
        /^number$/i,
        /^idx$/i,
        /^index$/i,
        /^seq(uence)?$/i,
        /^row_?id$/i,
        /^row_?num(ber)?$/i,
        /^\d+$/,              // Pure numeric column headers like "2024", "101", "0", "1"
        /^[#$@%]/             // Symbol-prefixed headers like "#id", "#"
      ];
      return patterns.some(p => p.test(name));
    };

    const isProtected = isProtectedKey(lowerKey);

    if (!options?.allowDiscardPrimaryKey && isProtected) {
      return false;
    }

    // 2. Synthetic export artifact patterns (e.g. pandas df.to_csv artifacts)
    const artifactPatterns = [
      /^unnamed:?\s*\d*$/i,
      /^__index_level_\d+__$/i,
      /^_c\d+$/i
    ];
    const isArtifactName = artifactPatterns.some(p => p.test(lowerKey));
    const isDiscardablePrimaryKey = Boolean(options?.allowDiscardPrimaryKey) && isProtected;

    if (!isArtifactName && !isDiscardablePrimaryKey) {
      return false;
    }

    // 3. If values are provided, verify whether it is actually a sequential surrogate series
    if (values && values.length > 0) {
      const nonNullValues = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
      if (nonNullValues.length === 0) return isArtifactName;

      // Check if values represent 0-indexed or 1-indexed strictly sequential integers
      const firstVal = Number(nonNullValues[0]);
      if (!Number.isInteger(firstVal) || (firstVal !== 0 && firstVal !== 1)) {
        // Artifact name / PK name, but data is NOT sequential numbers (e.g. user missing header on real data)
        return false;
      }

      const isSequential = nonNullValues.every((v, i) => {
        const num = Number(v);
        return Number.isInteger(num) && num === firstVal + i;
      });

      return isSequential;
    }

    return isArtifactName;
  }

  /**
   * Infer data type from sample values with strict numeric and date validation.
   */
  static inferDataType(values: any[]): string {
    if (!values || values.length === 0) return 'string';

    const nullStrings = new Set(['null', 'undefined', 'nan', '\\n', '']);
    const nonEmptyValues = values.filter(v => {
      if (v === null || v === undefined) return false;
      const str = String(v).trim();
      if (str === '') return false;
      if (nullStrings.has(str.toLowerCase())) return false;
      return true;
    });

    if (nonEmptyValues.length === 0) return 'string';

    const sampleSize = Math.min(nonEmptyValues.length, 50);
    const sample = nonEmptyValues.slice(0, sampleSize);

    // 1. Boolean check (strictly true/false/yes/no, never 0/1 or ambiguous text)
    const isBool = (v: any) => typeof v === 'boolean' || /^(true|false|yes|no)$/i.test(String(v).trim());
    if (sample.every(isBool)) {
      return 'boolean';
    }

    // 2. Numeric check (strict whole-string numeric match, no greedy parseFloat)
    const strictNumericRegex = /^[-+]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][-+]?\d+)?$/;
    const isNumeric = (v: any) => {
      if (typeof v === 'number') return !isNaN(v) && isFinite(v);
      const str = String(v).trim();
      if (!strictNumericRegex.test(str)) return false;
      const num = Number(str);
      return !isNaN(num) && isFinite(num);
    };

    if (sample.every(isNumeric)) {
      // Distinguish integer from decimal
      const hasDecimal = sample.some(v => {
        const str = String(v).trim();
        return str.includes('.') || /[eE]/.test(str);
      });
      return hasDecimal ? 'decimal' : 'integer';
    }

    // 3. Date check (anchored patterns + date validity, excluding pure numbers)
    const isDate = (v: any) => {
      const s = String(v).trim();
      if (strictNumericRegex.test(s)) return false; // Pure numbers are never dates

      const isoDate = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      const isoDateTime = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[T ]([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?$/i;
      const slashDate1 = /^(\d{4})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/;
      const slashDate2 = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(\d{4})$/;
      const dashDate = /^(0?[1-9]|[12]\d|3[01])-(0?[1-9]|1[0-2])-(\d{4})$/;

      let y: number, m: number, d: number;
      let match = s.match(isoDate) || s.match(slashDate1) || s.match(isoDateTime);
      if (match) {
        y = parseInt(match[1], 10);
        m = parseInt(match[2], 10);
        d = parseInt(match[3], 10);
      } else if ((match = s.match(slashDate2))) {
        m = parseInt(match[1], 10);
        d = parseInt(match[2], 10);
        y = parseInt(match[3], 10);
      } else if ((match = s.match(dashDate))) {
        const p1 = parseInt(match[1], 10);
        const p2 = parseInt(match[2], 10);
        y = parseInt(match[3], 10);
        if (p1 > 12) {
          d = p1;
          m = p2;
        } else {
          m = p1;
          d = p2;
        }
      } else {
        return false;
      }

      if (m < 1 || m > 12 || d < 1 || d > 31) return false;
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    };

    if (sample.every(isDate)) {
      return 'date';
    }

    // 4. Email check
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (sample.every(v => emailRegex.test(String(v).trim()))) {
      return 'email';
    }

    // 5. URL check
    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    if (sample.every(v => urlRegex.test(String(v).trim()))) {
      return 'url';
    }

    // 6. Phone check
    const phonePattern = /^(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}$/;
    if (sample.every(v => {
      const s = String(v).trim();
      return phonePattern.test(s) && (/[+\-()]/.test(s) || s.length >= 7);
    })) {
      return 'phone';
    }

    // Default to string
    return 'string';
  }

  /**
   * Clean and normalize data values
   */
  static cleanValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = value.toString().trim();
    
    // Convert common null representations (preserving '0', 'false', 'na', 'none')
    const nullValues = ['null', 'undefined', 'n/a', 'nil', 'nan', '\\n', ''];
    if (nullValues.includes(stringValue.toLowerCase())) {
      return '';
    }
    
    return stringValue;
  }

  /**
   * Check if a value is atomic (1NF compliant)
   */
  static isAtomic(value: any): boolean {
    if (!value) return true;
    
    const valueStr = value.toString().trim();
    if (valueStr === '') return true;
    
    // Check for common non-atomic patterns
    const nonAtomicPatterns = [
      /[,;|&+]/,                    // Delimiters
      /\s+and\s+/i,                // "and" separators
      /\s+or\s+/i,                 // "or" separators
      /[\[\]{}()]/,                // Brackets/parentheses indicating lists
      /^\{.*\}$/,                  // JSON-like objects
      /^\[.*\]$/,                  // Array-like structures
    ];
    
    // Check if value violates atomicity
    const hasDelimiters = nonAtomicPatterns.some(pattern => pattern.test(valueStr));
    
    // Also check for too many words (might indicate compound values)
    const wordCount = valueStr.split(/\s+/).length;
    const hasTooManyWords = wordCount > 5;
    
    return !hasDelimiters && !hasTooManyWords;
  }

  /**
   * Extract unique values from an array
   */
  static getUniqueValues(values: any[]): any[] {
    const seen = new Set();
    const unique: any[] = [];
    
    for (const value of values) {
      const cleanValue = this.cleanValue(value);
      if (!seen.has(cleanValue)) {
        seen.add(cleanValue);
        unique.push(cleanValue);
      }
    }
    
    return unique;
  }

  /**
   * Calculate value frequency distribution
   */
  static getValueFrequency(values: any[]): Map<any, number> {
    const frequency = new Map<any, number>();
    
    for (const value of values) {
      const cleanValue = this.cleanValue(value);
      frequency.set(cleanValue, (frequency.get(cleanValue) || 0) + 1);
    }
    
    return frequency;
  }

  /**
   * Check data quality metrics
   */
  static analyzeDataQuality(values: any[]): {
    totalCount: number;
    nullCount: number;
    uniqueCount: number;
    completeness: number;
    uniqueness: number;
    mostFrequent: { value: any; count: number };
  } {
    const totalCount = values.length;
    const cleanValues = values.map(v => this.cleanValue(v));
    const nullCount = cleanValues.filter(v => v === '').length;
    const nonNullValues = cleanValues.filter(v => v !== '');
    const uniqueValues = this.getUniqueValues(nonNullValues);
    const frequency = this.getValueFrequency(nonNullValues);
    
    // Find most frequent value
    let mostFrequent = { value: null, count: 0 };
    for (const [value, count] of frequency.entries()) {
      if (count > mostFrequent.count) {
        mostFrequent = { value, count };
      }
    }
    
    return {
      totalCount,
      nullCount,
      uniqueCount: uniqueValues.length,
      completeness: totalCount > 0 ? (totalCount - nullCount) / totalCount : 0,
      uniqueness: nonNullValues.length > 0 ? uniqueValues.length / nonNullValues.length : 0,
      mostFrequent
    };
  }

  /**
   * Generate a hash for a set of values (for duplicate detection)
   */
  static generateRowHash(row: any, attributes: string[]): string {
    return attributes
      .map(attr => this.cleanValue(row[attr] ?? ''))
      .join('||');
  }

  /**
   * Remove duplicate rows based on specified attributes
   */
  static removeDuplicates(data: any[], attributes: string[]): any[] {
    const seen = new Set<string>();
    const result: any[] = [];
    
    for (const row of data) {
      const hash = this.generateRowHash(row, attributes);
      if (!seen.has(hash)) {
        seen.add(hash);
        result.push(row);
      }
    }
    
    return result;
  }

  /**
   * Validate attribute name for database compatibility
   */
  static isValidAttributeName(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    
    // Check if name is a SQL reserved word
    const reservedWords = [
      'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop',
      'alter', 'table', 'index', 'view', 'database', 'schema', 'primary', 'foreign',
      'key', 'constraint', 'null', 'not', 'unique', 'default', 'check', 'references'
    ];
    
    const normalizedName = name.toLowerCase().trim();
    if (reservedWords.includes(normalizedName)) {
      return false;
    }
    
    // Check for valid identifier pattern
    const validPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    return validPattern.test(name);
  }

  /**
   * Suggest a valid attribute name from an invalid one
   */
  static suggestValidAttributeName(name: string): string {
    if (!name || typeof name !== 'string') return 'attribute';
    
    let suggested = this.normalizeName(name);
    
    // Ensure it starts with a letter
    if (!/^[a-zA-Z]/.test(suggested)) {
      suggested = 'attr_' + suggested;
    }
    
    // Handle reserved words
    const reservedWords = [
      'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop',
      'alter', 'table', 'index', 'view', 'database', 'schema', 'primary', 'foreign',
      'key', 'constraint', 'null', 'not', 'unique', 'default', 'check', 'references'
    ];
    
    if (reservedWords.includes(suggested.toLowerCase())) {
      suggested = suggested + '_attr';
    }
    
    return suggested || 'attribute';
  }

  /**
   * Format value for display
   */
  static formatValueForDisplay(value: any, maxLength: number = 50): string {
    if (value === null || value === undefined) {
      return '<null>';
    }
    
    const stringValue = value.toString();
    if (stringValue.length <= maxLength) {
      return stringValue;
    }
    
    return stringValue.substring(0, maxLength - 3) + '...';
  }

  /**
   * Parse CSV-like delimited values
   */
  static parseDelimitedValue(value: string, delimiter: string = ','): string[] {
    if (!value || typeof value !== 'string') return [];
    
    return value
      .split(delimiter)
      .map(v => v.trim())
      .filter(v => v.length > 0);
  }

  /**
   * Check if two values are semantically equal
   */
  static areValuesEqual(value1: any, value2: any): boolean {
    const clean1 = this.cleanValue(value1).toLowerCase();
    const clean2 = this.cleanValue(value2).toLowerCase();
    
    return clean1 === clean2;
  }

  /**
   * Generate statistics for numeric values
   */
  static calculateNumericStats(values: any[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
    count: number;
  } | null {
    const numericValues = values
      .map(v => parseFloat(this.cleanValue(v)))
      .filter(v => !isNaN(v) && isFinite(v));
    
    if (numericValues.length === 0) return null;
    
    const sorted = [...numericValues].sort((a, b) => a - b);
    const count = numericValues.length;
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    
    const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    
    const median = count % 2 === 0 
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];
    
    return {
      min: sorted[0],
      max: sorted[count - 1],
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      stdDev: Number(stdDev.toFixed(2)),
      count
    };
  }
}