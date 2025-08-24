/**
 * CSV File Processor
 * Author: miskatul-anwar
 * Date: 2025-07-30 05:57:16 UTC
 */

import { DataUtils } from '../utils/dataUtils';

export class CSVProcessor {
  static async processFile(file: File): Promise<{ data: any[]; metadata: any }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          if (!text || text.trim().length === 0) {
            throw new Error('Empty CSV file');
          }

          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            throw new Error('No valid data found in CSV file');
          }
          
          const headers = this.parseCSVLine(lines[0]);
          
          if (headers.length === 0) {
            throw new Error('No headers found in CSV file');
          }
          
          const data = lines.slice(1).map((line, _index) => {
            const values = this.parseCSVLine(line);
            const row: any = {};
            
            headers.forEach((header, i) => {
              const cleanHeader = header.trim();
              if (cleanHeader && !DataUtils.isIndexColumn(cleanHeader)) {
                row[cleanHeader] = DataUtils.cleanValue(values[i] || '');
              }
            });
            
            return row;
          }).filter(row => Object.keys(row).length > 0 && Object.values(row).some(val => val !== ''));
          
          if (data.length === 0) {
            throw new Error('No valid data rows found in CSV file');
          }
          
          resolve({
            data,
            metadata: {
              originalRows: lines.length - 1,
              finalRows: data.length,
              originalColumns: headers.length,
              finalColumns: Object.keys(data[0] || {}).length,
              fileName: file.name
            }
          });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }
}