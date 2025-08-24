/**
 * Data Processing Utilities
 * Author: miskatul-anwar
 * Date: 2025-07-30 05:40:38 UTC
 */

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
   * Check if a column name represents an index column
   */
  static isIndexColumn(columnName: string): boolean {
    if (!columnName || typeof columnName !== 'string') return true;
    
    const cleanKey = columnName.trim().toLowerCase();
    const indexPatterns = [
      /^\d+$/,                         // Pure numbers: 0, 1, 2
      /^unnamed:?\s*\d*$/i,           // Unnamed: 0, Unnamed: 1
      /^index$/i,                     // index
      /^idx$/i,                       // idx
      /^row_?num(ber)?$/i,           // row_num, row_number
      /^#/,                          // # prefixed columns
      /^seq(uence)?$/i,              // seq, sequence
      /^no\.?$/i,                    // no, no.
      /^s\.?n\.?$/i,                 // s.n, sn
      /^id$/i,                       // id (if it's just a simple incrementing ID)
    ];
    
    return cleanKey === '' || indexPatterns.some(pattern => pattern.test(cleanKey));
  }

  /**
   * Infer data type from sample values
   */
  static inferDataType(values: any[]): string {
    if (!values || values.length === 0) return 'string';
    
    const nonEmptyValues = values.filter(v => 
      v !== null && 
      v !== undefined && 
      v.toString().trim() !== ''
    );
    
    if (nonEmptyValues.length === 0) return 'string';
    
    const sampleSize = Math.min(nonEmptyValues.length, 50);
    const sample = nonEmptyValues.slice(0, sampleSize);
    
    // Check for boolean values
    const boolPattern = /^(true|false|yes|no|y|n|0|1|on|off)$/i;
    if (sample.every(v => boolPattern.test(v.toString()))) {
      return 'boolean';
    }
    
    // Check for numeric values
    const numericSample = sample.filter(v => {
      const num = parseFloat(v.toString());
      return !isNaN(num) && isFinite(num);
    });
    
    if (numericSample.length === sample.length) {
      const hasDecimals = sample.some(v => v.toString().includes('.'));
      return hasDecimals ? 'decimal' : 'integer';
    }
    
    // Check for date values
    const datePattern = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}|\d{4}\/\d{2}\/\d{2}/;
    const dateCount = sample.filter(v => {
      const str = v.toString();
      return datePattern.test(str) || !isNaN(Date.parse(str));
    }).length;
    
    if (dateCount >= sample.length * 0.8) { // 80% threshold for date detection
      return 'date';
    }
    
    // Check for email values
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (sample.every(v => emailPattern.test(v.toString()))) {
      return 'email';
    }
    
    // Check for URL values
    const urlPattern = /^https?:\/\/[^\s]+$/;
    if (sample.every(v => urlPattern.test(v.toString()))) {
      return 'url';
    }
    
    // Check for phone numbers
    const phonePattern = /^[\+]?[1-9][\d]{0,15}$|^\(\d{3}\)\s\d{3}-\d{4}$|^\d{3}-\d{3}-\d{4}$/;
    if (sample.every(v => phonePattern.test(v.toString().replace(/[\s\-\(\)]/g, '')))) {
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
    
    // Convert common null representations
    const nullValues = ['null', 'undefined', 'n/a', 'na', 'none', 'nil', ''];
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
      .map(attr => this.cleanValue(row[attr] || ''))
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