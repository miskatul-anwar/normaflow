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
      const nonAtomicRows: any[] = [];
      const sample = data.slice(0, Math.min(data.length, 100));
      
      for (let index = 0; index < sample.length; index++) {
        const row = sample[index];
        const value = row[attr];
        if (value === null || value === undefined || value.toString().trim() === '') continue;
        
        const isAtomicValue = DataUtils.isAtomic(value);
        if (!isAtomicValue) {
          nonAtomicRows.push({
            row: index + 1,
            value: value.toString().substring(0, 100)
          });
        }
      }
      
      const isAtomic = nonAtomicRows.length === 0;
      atomicity[attr] = isAtomic;
      if (!isAtomic) {
        violations[attr] = nonAtomicRows.slice(0, 5);
      }
    }
    
    return { atomicity, violations };
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