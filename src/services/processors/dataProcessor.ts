/**
 * Data Processing Engine
 * Author: miskatul-anwar
 * Date: 2025-07-30 05:57:16 UTC
 */

import { DataUtils } from '../utils/dataUtils';

export class DataProcessor {
  static async clean(data: any[]): Promise<any[]> {
    if (!data || data.length === 0) return [];
    
    // Remove empty rows and clean values
    const cleaned = data
      .filter(row => {
        const hasValidData = Object.values(row).some(value => 
          value !== null && value !== undefined && value.toString().trim() !== ''
        );
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
      .filter(row => Object.keys(row).length > 0);
    
    return cleaned;
  }

  static async checkAtomicity(data: any[]): Promise<any> {
    if (!data || data.length === 0) {
      return { atomicity: {}, violations: {} };
    }
    
    const attributes = Object.keys(data[0] || {});
    const atomicity: any = {};
    const violations: any = {};
    
    for (const attr of attributes) {
      const nonAtomicRows: any[] = [];
      const sample = data.slice(0, Math.min(data.length, 100));
      
      const isAtomic = sample.every((row, index) => {
        const value = row[attr];
        if (!value || value.toString().trim() === '') return true;
        
        const isAtomicValue = DataUtils.isAtomic(value);
        if (!isAtomicValue) {
          nonAtomicRows.push({
            row: index + 1,
            value: value.toString().substring(0, 100)
          });
          return false;
        }
        return true;
      });
      
      atomicity[attr] = isAtomic;
      if (!isAtomic) {
        violations[attr] = nonAtomicRows.slice(0, 5);
      }
    }
    
    return { atomicity, violations };
  }

  static async profileDataTypes(data: any[]): Promise<any> {
    if (!data || data.length === 0) return {};
    
    const attributes = Object.keys(data[0] || {});
    const types: any = {};
    
    for (const attr of attributes) {
      const values = data.map(row => row[attr]).filter(v => v && v.toString().trim() !== '');
      types[attr] = DataUtils.inferDataType(values);
    }
    
    return types;
  }
}