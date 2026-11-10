/**
 * Data Processing Engine
 * Author: miskatul-anwar
 * Date: 2025-07-30 05:57:16 UTC
 */

import { DataUtils } from '../utils/dataUtils';

export class DataProcessor {
  static async clean(data: any[]): Promise<any[]> {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    
    // Remove empty rows and clean values
    const cleaned = data
      .filter(row => {
        if (!row || typeof row !== 'object') return false;
        const hasValidData = Object.values(row).some(value => {
          if (value === null || value === undefined) return false;
          return DataUtils.cleanValue(value) !== '';
        });
        return hasValidData;
      })
      .map(row => {
        const cleanedRow: any = {};
        Object.entries(row).forEach(([key, value]) => {
          const cleanKey = key.trim();
          if (cleanKey) {
            cleanedRow[cleanKey] = DataUtils.cleanValue(value);
          }
        });
        return cleanedRow;
      })
      .filter(row => Object.keys(row).length > 0 && Object.values(row).some(val => val !== ''));
    
    return cleaned;
  }

  static async checkAtomicity(data: any[]): Promise<any> {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { atomicity: {}, violations: {} };
    }
    
    const attributes = Object.keys(data[0] || {});
    const atomicity: any = {};
    const violations: any = {};

    for (const attr of attributes) {
      const listLike: any[] = [];
      let nonEmpty = 0;
      let tokenWords = 0;
      let tokenCount = 0;

      for (let index = 0; index < data.length; index++) {
        const value = data[index][attr];
        if (value === null || value === undefined) continue;
        const text = value.toString().trim();
        if (text === '') continue;
        nonEmpty++;

        const tokens = DataProcessor.listTokens(text);
        if (tokens) {
          listLike.push({ row: index + 1, value: text.substring(0, 100) });
          for (const t of tokens) {
            tokenCount++;
            tokenWords += t.split(/\s+/).length;
          }
        }
      }

      // A column is multi-valued only when a large share of its values are lists
      // of short items, and it is not free text (names, addresses, descriptions).
      const share = nonEmpty > 0 ? listLike.length / nonEmpty : 0;
      const avgWords = tokenCount > 0 ? tokenWords / tokenCount : 0;
      const freeText = DataProcessor.FREE_TEXT_COLUMN.test(attr) || avgWords > 2;
      const isAtomic = !(share >= 0.3 && !freeText);

      atomicity[attr] = isAtomic;
      if (!isAtomic) {
        violations[attr] = listLike.slice(0, 5);
      }
    }

    return { atomicity, violations };
  }

  /** Column names whose values legitimately contain commas, "and", brackets, etc. */
  private static readonly FREE_TEXT_COLUMN =
    /(^|[_\s-])(name|address|street|city|location|desc|description|comment|note|notes|title|text|remark|remarks|phone|email|url|summary|bio)($|[_\s-])/i;

  /**
   * Split `text` into list items if it looks like a list: a JSON array, or
   * two or more short items separated by `;`, `|`, `,` or ` / `. Returns
   * `null` for ordinary scalar text. Words such as "and"/"or", ampersands,
   * plus signs and parentheses are not list evidence on their own.
   */
  static listTokens(text: string): string[] | null {
    if (/^\[.*\]$/.test(text)) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        // not JSON; fall through to delimiter detection
      }
    }
    for (const delimiter of [';', '|', ',', ' / ']) {
      if (!text.includes(delimiter)) continue;
      const tokens = text.split(delimiter).map(t => t.trim()).filter(Boolean);
      if (tokens.length >= 2 && tokens.every(t => t.split(/\s+/).length <= 3)) return tokens;
    }
    return null;
  }

  static async profileDataTypes(data: any[]): Promise<any> {
    if (!data || !Array.isArray(data) || data.length === 0) return {};
    
    const attributes = Object.keys(data[0] || {});
    const types: any = {};
    
    for (const attr of attributes) {
      const values = data
        .map(row => row[attr])
        .filter(v => v !== null && v !== undefined && String(v).trim() !== '');
      types[attr] = DataUtils.inferDataType(values);
    }
    
    return types;
  }
}