import { decodeBytes } from '../utils/encoding';
/**
 * CSV File Processor
 * Author: miskatul-anwar
 * Date: 2025-07-30 05:57:16 UTC
 */

import { DataUtils } from '../utils/dataUtils';

export interface CSVParseOptions {
  delimiter?: string;
  maxRows?: number;
  preserveIndexColumns?: boolean; // Default true: id, no, sn, idx preserved
  fileName?: string;
}

export interface CSVParseResult {
  data: Record<string, any>[];
  headers: string[];
  metadata: {
    originalRows: number;
    finalRows: number;
    originalColumns: number;
    finalColumns: number;
    fileName?: string;
    delimiter?: string;
    hasMultilineFields?: boolean;
  };
}

export interface StreamingCSVParserOptions {
  delimiter?: string;
  maxRows?: number;
  onRow: (row: Record<string, any>, index: number) => void;
  onHeaders?: (headers: string[]) => void;
}

/**
 * Sanitizes and disambiguates raw header names, guaranteeing global uniqueness
 * across the row namespace without collisions against pre-existing suffixed headers.
 */
export function sanitizeHeaders(raw: string[]): string[] {
  const allocated = new Set<string>();
  const baseCounts = new Map<string, number>();

  return raw.map((r, idx) => {
    let base = (typeof r === 'string' ? r : String(r ?? '')).trim();
    if (!base) {
      base = `column_${idx + 1}`;
    }

    let candidate = base;
    if (allocated.has(candidate)) {
      let count = baseCounts.get(base) || 1;
      while (allocated.has(`${base}_${count}`)) {
        count++;
      }
      candidate = `${base}_${count}`;
      baseCounts.set(base, count + 1);
    } else {
      baseCounts.set(base, 1);
    }

    allocated.add(candidate);
    return candidate;
  });
}

export class StreamingCSVParser {
  private delimiter: string | null = null;
  private headers: string[] | null = null;
  private activeColumnIndices: number[] | null = null;
  private inQuotes: boolean = false;
  private fieldIsQuoted: boolean = false;
  private currentField: string = '';
  private currentRow: { value: string; isQuoted: boolean }[] = [];
  private rowCount: number = 0;
  private isFirstChunk: boolean = true;
  private isFirstRow: boolean = true;
  private pendingChar: string | null = null;
  private readonly maxRows: number;
  private readonly onRow: (row: Record<string, any>, index: number) => void;
  private readonly onHeaders?: (headers: string[]) => void;

  constructor(options: StreamingCSVParserOptions) {
    this.delimiter = options.delimiter || null;
    this.maxRows = options.maxRows ?? Infinity;
    this.onRow = options.onRow;
    this.onHeaders = options.onHeaders;
  }

  public feed(chunk: string): boolean {
    let text = chunk;

    // Prepend any lookahead character deferred from previous chunk
    if (this.pendingChar !== null) {
      text = this.pendingChar + text;
      this.pendingChar = null;
    }

    if (this.isFirstChunk) {
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }
      if (text.length > 0) {
        this.isFirstChunk = false;
        if (!this.delimiter) {
          this.delimiter = CSVProcessor.detectDelimiter(text);
        }
      }
    }

    const delim = this.delimiter || ',';
    const len = text.length;
    let i = 0;

    while (i < len) {
      if (this.rowCount >= this.maxRows) return false;

      const char = text[i];

      if (this.inQuotes) {
        if (char === '"') {
          if (i + 1 < len) {
            if (text[i + 1] === '"') {
              this.currentField += '"';
              i += 2;
              continue;
            } else {
              this.inQuotes = false;
              i++;
              continue;
            }
          } else {
            // Reached chunk boundary on a quote inside quotes: defer until next chunk
            this.pendingChar = '"';
            i++;
            break;
          }
        } else if (char === '\\') {
          if (i + 1 < len) {
            if (text[i + 1] === '"') {
              this.currentField += '"';
              i += 2;
              continue;
            } else {
              this.currentField += char;
              i++;
              continue;
            }
          } else {
            // Reached chunk boundary on a backslash: defer until next chunk
            this.pendingChar = '\\';
            i++;
            break;
          }
        } else {
          this.currentField += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          if (this.currentField.trim() === '') {
            this.inQuotes = true;
            this.fieldIsQuoted = true;
            this.currentField = '';
            i++;
            continue;
          } else {
            this.currentField += char;
            i++;
            continue;
          }
        } else if (char === delim) {
          this.emitField();
          i++;
          continue;
        } else if (char === '\r') {
          if (i + 1 < len) {
            if (text[i + 1] === '\n') {
              i++; // Skip \n in CRLF pair
            }
            this.emitField();
            this.emitRow();
            i++;
            continue;
          } else {
            // Reached chunk boundary on \r: defer to check if next chunk starts with \n
            this.pendingChar = '\r';
            i++;
            break;
          }
        } else if (char === '\n') {
          this.emitField();
          this.emitRow();
          i++;
          continue;
        } else {
          this.currentField += char;
          i++;
          continue;
        }
      }
    }

    return this.rowCount < this.maxRows;
  }

  public finish(): void {
    if (this.pendingChar !== null) {
      if (this.inQuotes && this.pendingChar === '"') {
        // Stream finished with deferred quote: resolve as closing quote
        this.inQuotes = false;
      } else if (this.inQuotes && this.pendingChar === '\\') {
        this.currentField += '\\';
      } else if (!this.inQuotes && this.pendingChar === '\r') {
        this.emitField();
        this.emitRow();
      } else {
        this.currentField += this.pendingChar;
      }
      this.pendingChar = null;
    }

    if (this.inQuotes || this.fieldIsQuoted || this.currentField.length > 0 || this.currentRow.length > 0) {
      this.emitField();
      this.emitRow();
    }
  }

  private emitField(): void {
    const val = this.fieldIsQuoted ? this.currentField : this.currentField.trim();
    this.currentRow.push({ value: val, isQuoted: this.fieldIsQuoted });
    this.currentField = '';
    this.fieldIsQuoted = false;
  }

  private emitRow(): void {
    if (this.currentRow.length === 0 || this.currentRow.every(c => c.value === '')) {
      this.currentRow = [];
      return;
    }

    if (this.isFirstRow) {
      this.isFirstRow = false;
      this.headers = this.sanitizeHeaders(this.currentRow.map(c => c.value));
      this.activeColumnIndices = [];
      this.headers.forEach((h, idx) => {
        if (!DataUtils.isIndexColumn(h)) {
          this.activeColumnIndices!.push(idx);
        }
      });
      const activeHeaders = this.activeColumnIndices.map(idx => this.headers![idx]);
      this.onHeaders?.(activeHeaders);
      this.currentRow = [];
      return;
    }

    if (!this.headers) return;

    if (this.rowCount < this.maxRows) {
      const row: Record<string, any> = {};
      const indices = this.activeColumnIndices || this.headers.map((_, i) => i);
      const nullValues = ['null', 'undefined', 'n/a', 'nil', 'nan', '\\n'];
      indices.forEach((colIdx) => {
        const h = this.headers![colIdx];
        const cell = this.currentRow[colIdx];
        if (cell && cell.isQuoted) {
          if (nullValues.includes(cell.value.toLowerCase())) {
            row[h] = '';
          } else {
            row[h] = cell.value;
          }
        } else {
          row[h] = DataUtils.cleanValue(cell ? cell.value : '');
        }
      });
      this.rowCount++;
      this.onRow(row, this.rowCount);
    }
    this.currentRow = [];
  }

  private sanitizeHeaders(raw: string[]): string[] {
    return sanitizeHeaders(raw);
  }

  public getHeaders(): string[] {
    if (!this.headers) return [];
    const indices = this.activeColumnIndices || this.headers.map((_, i) => i);
    return indices.map(i => this.headers![i]);
  }
  public getDelimiter(): string { return this.delimiter || ','; }
  public getRowCount(): number { return this.rowCount; }
}

export class CSVProcessor {
  static readonly SUPPORTED_DELIMITERS = [',', ';', '\t', '|'] as const;
  static readonly StreamingParser = StreamingCSVParser;

  static sanitizeHeaders(raw: string[]): string[] {
    return sanitizeHeaders(raw);
  }

  static detectDelimiter(sample: string): string {
    if (!sample || typeof sample !== 'string') return ',';

    // Strip BOM if present
    const cleanSample = sample.charCodeAt(0) === 0xFEFF ? sample.slice(1) : sample;
    const sampleWindow = cleanSample.slice(0, 32768);

    // Extract up to 20 logical lines respecting quotes
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < sampleWindow.length && lines.length < 20; i++) {
      const char = sampleWindow[i];
      if (char === '"') {
        if (inQuotes && sampleWindow[i + 1] === '"') {
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
        currentLine += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && sampleWindow[i + 1] === '\n') {
          i++;
        }
        if (currentLine.trim().length > 0) {
          lines.push(currentLine);
        }
        currentLine = '';
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim().length > 0 && lines.length < 20) {
      lines.push(currentLine);
    }

    if (lines.length === 0) return ',';

    const weights: Record<string, number> = { ',': 0.4, ';': 0.3, '\t': 0.2, '|': 0.1 };
    let bestDelimiter = ',';
    let bestScore = -1;

    for (const delim of this.SUPPORTED_DELIMITERS) {
      const counts: number[] = [];

      for (const line of lines) {
        let count = 0;
        let lineInQuotes = false;
        for (let j = 0; j < line.length; j++) {
          const c = line[j];
          if (c === '"') {
            if (lineInQuotes && line[j + 1] === '"') {
              j++;
            } else {
              lineInQuotes = !lineInQuotes;
            }
          } else if (c === delim && !lineInQuotes) {
            count++;
          }
        }
        counts.push(count);
      }

      // Filter out lines where delimiter count is 0
      const validCounts = counts.filter(c => c > 0);
      if (validCounts.length === 0) continue;

      // Find mode of counts
      const freqMap = new Map<number, number>();
      let modeCount = 0;
      let modeFreq = 0;
      for (const c of validCounts) {
        const freq = (freqMap.get(c) || 0) + 1;
        freqMap.set(c, freq);
        if (freq > modeFreq) {
          modeFreq = freq;
          modeCount = c;
        }
      }

      const consistency = modeFreq / lines.length;
      const score = (consistency * 100) + (modeCount * 2) + (weights[delim] || 0);

      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = delim;
      }
    }

    return bestDelimiter;
  }

  static parseCSVCells(text: string, delimiter: string): { rows: { value: string; isQuoted: boolean }[][]; hasMultiline: boolean } {
    const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const rows: { value: string; isQuoted: boolean }[][] = [];
    let currentRow: { value: string; isQuoted: boolean }[] = [];
    let currentField = '';
    let inQuotes = false;
    let fieldIsQuoted = false;
    let hasMultiline = false;

    const len = cleanText.length;
    let i = 0;

    while (i < len) {
      const char = cleanText[i];

      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < len && cleanText[i + 1] === '"') {
            currentField += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        } else if (char === '\\' && i + 1 < len && cleanText[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          if (char === '\n' || char === '\r') {
            hasMultiline = true;
          }
          currentField += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          if (currentField.trim() === '') {
            inQuotes = true;
            fieldIsQuoted = true;
            currentField = '';
            i++;
            continue;
          } else {
            currentField += char;
            i++;
            continue;
          }
        } else if (char === delimiter) {
          currentRow.push({
            value: fieldIsQuoted ? currentField : currentField.trim(),
            isQuoted: fieldIsQuoted
          });
          currentField = '';
          fieldIsQuoted = false;
          i++;
          continue;
        } else if (char === '\r') {
          if (i + 1 < len && cleanText[i + 1] === '\n') {
            i++;
          }
          currentRow.push({
            value: fieldIsQuoted ? currentField : currentField.trim(),
            isQuoted: fieldIsQuoted
          });
          currentField = '';
          fieldIsQuoted = false;
          rows.push(currentRow);
          currentRow = [];
          i++;
          continue;
        } else if (char === '\n') {
          currentRow.push({
            value: fieldIsQuoted ? currentField : currentField.trim(),
            isQuoted: fieldIsQuoted
          });
          currentField = '';
          fieldIsQuoted = false;
          rows.push(currentRow);
          currentRow = [];
          i++;
          continue;
        } else {
          currentField += char;
          i++;
          continue;
        }
      }
    }

    if (inQuotes || fieldIsQuoted || currentField.length > 0 || currentRow.length > 0) {
      currentRow.push({
        value: fieldIsQuoted ? currentField : currentField.trim(),
        isQuoted: fieldIsQuoted
      });
      rows.push(currentRow);
    }

    return { rows, hasMultiline };
  }

  static parseCSVRows(text: string, delimiter: string): { rows: string[][]; hasMultiline: boolean } {
    const { rows: cellRows, hasMultiline } = this.parseCSVCells(text, delimiter);
    const rows = cellRows.map(r => r.map(c => c.value));
    return { rows, hasMultiline };
  }

  static parse(text: string, options: CSVParseOptions = {}): CSVParseResult {
    if (!text || text.trim().length === 0) {
      throw new Error('Empty CSV file');
    }

    const delimiter = options.delimiter || this.detectDelimiter(text);
    const { rows: cellRows, hasMultiline } = this.parseCSVCells(text, delimiter);

    // Filter out completely blank lines
    const nonEmptyCellRows = cellRows.filter(r => r.length > 0 && r.some(cell => cell.value.length > 0));
    if (nonEmptyCellRows.length === 0) {
      throw new Error('No valid data found in CSV file');
    }

    const rawHeaders = nonEmptyCellRows[0].map(c => c.value);
    const headers = sanitizeHeaders(rawHeaders);

    const dataCellRows = nonEmptyCellRows.slice(1);
    
    // Check which columns should be retained (drops only surrogate export artifacts like Unnamed: 0)
    const columnValuesMap = new Map<number, any[]>();
    headers.forEach((_, colIdx) => {
      columnValuesMap.set(colIdx, dataCellRows.map(r => r[colIdx]?.value));
    });

    const activeColumnIndices: number[] = [];
    headers.forEach((header, colIdx) => {
      const colValues = columnValuesMap.get(colIdx) || [];
      const isIndex = DataUtils.isIndexColumn(header, colValues, {
        allowDiscardPrimaryKey: options.preserveIndexColumns === false
      });
      if (!isIndex) {
        activeColumnIndices.push(colIdx);
      }
    });

    const finalHeaders = activeColumnIndices.map(idx => headers[idx]);

    const maxRows = options.maxRows ?? dataCellRows.length;
    const targetRows = dataCellRows.slice(0, maxRows);

    const nullValues = ['null', 'undefined', 'n/a', 'nil', 'nan', '\\n'];
    const data: Record<string, any>[] = [];
    for (const r of targetRows) {
      const row: Record<string, any> = {};
      for (const colIdx of activeColumnIndices) {
        const header = headers[colIdx];
        const cell = r[colIdx];
        if (cell && cell.isQuoted) {
          if (nullValues.includes(cell.value.toLowerCase())) {
            row[header] = '';
          } else {
            row[header] = cell.value;
          }
        } else {
          row[header] = DataUtils.cleanValue(cell ? cell.value : '');
        }
      }
      data.push(row);
    }

    return {
      data,
      headers: finalHeaders,
      metadata: {
        originalRows: dataCellRows.length,
        finalRows: data.length,
        originalColumns: headers.length,
        finalColumns: finalHeaders.length,
        fileName: options.fileName,
        delimiter,
        hasMultilineFields: hasMultiline
      }
    };
  }

  static parseCSV(text: string, options: CSVParseOptions = {}): CSVParseResult {
    return this.parse(text, options);
  }

  static async processFile(file: File, options: CSVParseOptions = {}): Promise<CSVParseResult> {
    let text: string;
    if (typeof file.arrayBuffer === 'function') {
      text = decodeBytes(new Uint8Array(await file.arrayBuffer())).text;
    } else {
      text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(decodeBytes(new Uint8Array(e.target?.result as ArrayBuffer)).text);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
      });
    }

    return this.parse(text, { ...options, fileName: file.name });
  }

  static createStreamingParser(options: StreamingCSVParserOptions): StreamingCSVParser {
    return new StreamingCSVParser(options);
  }
}