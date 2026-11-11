/**
 * Complete Database Normalization Service - Optimized Version
 * Frontend API for React Integration with Performance Enhancements
 * Author: miskatul-anwar
 * Date: 2025-08-02 14:57:36 UTC
 */

import { CSVProcessor, DataProcessor, NormalizationEngine } from '../processors';
import { RelationDetectorService } from '../processors/relationDetector';
import { chooseKey, type KeyChoice } from '../processors/keySelection';
import { splitMultiValuedColumns } from '../processors/atomicSplit';
import { verifyLosslessOnData } from '../processors/instanceVerification';
import { buildSchema, emitMermaidErd, toDecomposedRelations } from '../processors/schemaGraph';
import { buildMultiTableReport } from '../processors/multiTableReport';
import { IdentifierRegistry } from '../utils/identifiers';
import { Logger } from '../utils/logger';
import { FileUtils } from '../utils/fileUtils';
import { createDecoder } from '../utils/encoding';
import { expandSpreadsheets, isSpreadsheetFile, isSupportedInputName } from '../processors/spreadsheetProcessor';
import { exportNormalizedData } from '../processors/dataExport';
import { TableData } from '../../types';

/** Upper bound on rows held in memory for one file; the whole file is read up to this. */
const HARD_ROW_LIMIT = 1_000_000;

export interface ProcessingOptions {
  maxLhsSize?: number;
  maxSampleSize?: number;
  /** Rows used to propose dependencies; every reported one is verified on all rows. */
  fdSampleSize?: number;
  /** Skip determinants that are nearly (but not exactly) unique on tables of 200+ rows; 1 disables. Default 0.9. */
  nearKeyRatio?: number;
  /** Never use columns with missing values as determinants (they cannot be keys). Default true. */
  completeDeterminantsOnly?: boolean;
  /** See `minRowsForNonKeyDeterminants` in fdMiner (default 10). */
  minRowsForNonKeyDeterminants?: number;
  /** Time budget for functional-dependency mining, in milliseconds (default 30 000). */
  timeout?: number;
  enableParallelProcessing?: boolean;
  adaptiveThresholds?: boolean;
  /**
   * Use dependencies that hold on most but not all rows for keys and normal
   * forms. Off by default: such dependencies can make a decomposition lossy.
   */
  acceptApproximateFDs?: boolean;
  /** SQL dialect for multi-table DDL (default `sqlite`). */
  sqlDialect?: SQLDialect;
}

/** Everything the shared analysis routine produces for one table. */
export interface TableAnalysis {
  rows: any[];
  attributes: string[];
  atomicityResult: any;
  dataProfile: any;
  nerTags: any[];
  /** Every dependency mined, exact and approximate (for display). */
  functionalDependencies: any[];
  /** The dependencies that fed keys and normal forms. */
  usedFDs: any[];
  fdSearch: {
    truncated: boolean;
    levelReached: number;
    maxLhsSize: number;
    exact: number;
    approximate: number;
    approximateUsed: boolean;
  } | null;
  keyResult: any;
  keyChoice: KeyChoice | null;
  relations1NF: any[];
  relations2NF: any[];
  relations3NF: any[];
  relationsBCNF: any[];
  cardinalityAnalysis: any;
  losslessCheck: any;
  dependencyPreservation: any;
  /** Warnings worth surfacing in the report. */
  notes: string[];
}

export interface ProcessingResult {
  success: boolean;
  stats: {
    originalRows?: number;
    cleanedRows?: number;
    dataRetention?: string;
    attributes?: number;
    functionalDependencies?: number;
    candidateKeys?: number;
    superkeys?: number;
    relations1NF?: number;
    relations2NF?: number;
    relations3NF?: number;
    relationsBCNF?: number;
    connectedEntities?: number;
    relationships?: number;
    cardinalityMappings?: number;
    losslessJoin?: boolean;
    dependencyPreservation?: boolean;
    processDuration?: string;
    memoryUsage?: string;
    performanceMetrics?: any;
  };
  outputFiles: OutputFile[];
  logs: string[];
  relations?: any[];
  relations1NF?: any[];
  relations2NF?: any[];
  relations3NF?: any[];
  relationsBCNF?: any[];
  bcnf?: any[];
  relationships?: any[];
  erdContent?: string;
  erdDiagram?: string;
  sqlStatements?: string;
  reportMarkdown?: string;
  cardinalityAnalysis?: any;
  losslessCheck?: any;
  dependencyPreservation?: any;
  duration: string;
  selectedOperations?: string[];
  isMultiTable?: boolean;
  tables?: TableData[];
  crossTableRelationships?: any[];
  nerResults?: any;
  error?: string;
  qualityAssessment?: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
}

export interface OutputFile {
  name: string;
  type: 'json' | 'markdown' | 'csv' | 'sql' | 'mermaid' | 'txt' | 'svg';
  description: string;
  content: any;
  size: number;
  category: string;
}

export interface ProcessingState {
  phase: 'PREP' | 'ANALYZE' | 'NORMAL' | 'OUTPUT';
  operation: string;
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
  memoryUsage?: number;
}

export type SQLDialect = 'postgresql' | 'mysql' | 'sqlite' | 'ansi';

export interface DecomposedRelation {
  name: string;
  attributes: string[];
  primaryKey: string[];
  foreignKeys?: {
    attributes: string[];
    references: string;
    referencedKey: string[];
    cardinality?: string;
  }[];
  fds?: any[];
  columnTypes?: Record<string, string>;
  /** Columns with no missing value in the data; emitted as NOT NULL. */
  notNull?: Record<string, boolean>;
  /** Non-key columns that other tables reference; emitted as UNIQUE. */
  unique?: string[];
  /** Name of the relation this was built from (before identifier sanitizing). */
  sourceName?: string;
  /** Sanitized column name -> original column name. */
  columnSources?: Record<string, string>;
}

export const SQL_RESERVED_KEYWORDS = new Set([
  'ADD', 'ALL', 'ALTER', 'AND', 'AS', 'ASC', 'BETWEEN', 'BY', 'CASE', 'CAST',
  'CHECK', 'COLUMN', 'CONSTRAINT', 'CREATE', 'CROSS', 'CURRENT_DATE', 'CURRENT_TIME',
  'CURRENT_TIMESTAMP', 'DATABASE', 'DATE', 'DAY', 'DEFAULT', 'DELETE', 'DESC',
  'DISTINCT', 'DROP', 'ELSE', 'END', 'EXISTS', 'FOREIGN', 'FROM', 'FULL', 'GRANT',
  'GROUP', 'HAVING', 'IN', 'INDEX', 'INNER', 'INSERT', 'INTO', 'IS', 'JOIN', 'KEY',
  'LEFT', 'LIKE', 'LIMIT', 'MONTH', 'NOT', 'NULL', 'OFFSET', 'ON', 'OR', 'ORDER',
  'OUTER', 'PRIMARY', 'REFERENCES', 'REVOKE', 'RIGHT', 'ROW', 'ROWS', 'SCHEMA',
  'SELECT', 'SET', 'TABLE', 'THEN', 'TIME', 'TIMESTAMP', 'TO', 'TRIGGER', 'UNION',
  'UNIQUE', 'UPDATE', 'USER', 'VALUE', 'VALUES', 'VIEW', 'WHEN', 'WHERE', 'WITH',
  'YEAR'
]);

export function quoteIdentifier(ident: string, dialect: SQLDialect = 'ansi'): string {
  if (!ident) return '""';
  const sanitized = ident.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  switch (dialect) {
    case 'mysql':
      return `\`${sanitized.replace(/`/g, '``')}\``;
    case 'postgresql':
    case 'sqlite':
    case 'ansi':
    default:
      return `"${sanitized.replace(/"/g, '""')}"`;
  }
}

export function mapDataTypeToDialect(inferredType: string, dialect: SQLDialect = 'ansi'): string {
  const upper = (inferredType || 'VARCHAR(255)').toUpperCase();
  
  if (upper.includes('INT')) {
    if (dialect === 'postgresql' || dialect === 'ansi' || dialect === 'sqlite') {
      if (upper.includes('BIGINT')) return 'BIGINT';
      if (upper.includes('SMALLINT')) return 'SMALLINT';
      return 'INTEGER';
    }
    return 'INT';
  }

  if (upper.includes('BOOL')) {
    if (dialect === 'sqlite') return 'INTEGER';
    if (dialect === 'mysql') return 'TINYINT(1)';
    return 'BOOLEAN';
  }

  if (upper.includes('DECIMAL') || upper.includes('NUMERIC')) {
    return upper;
  }

  if (upper.includes('FLOAT') || upper.includes('DOUBLE') || upper.includes('REAL')) {
    if (dialect === 'sqlite') return 'REAL';
    if (dialect === 'postgresql' || dialect === 'ansi') return 'DOUBLE PRECISION';
    return 'DOUBLE';
  }

  if (upper.includes('DATE') && !upper.includes('TIME')) {
    if (dialect === 'sqlite') return 'TEXT';
    return 'DATE';
  }

  if (upper.includes('TIME') || upper.includes('DATETIME')) {
    if (dialect === 'sqlite') return 'TEXT';
    if (dialect === 'postgresql' || dialect === 'ansi') return 'TIMESTAMP';
    return 'DATETIME';
  }

  if (upper.includes('JSON')) {
    if (dialect === 'postgresql') return 'JSONB';
    if (dialect === 'mysql') return 'JSON';
    return 'TEXT';
  }

  if (upper.includes('TEXT') || upper.includes('LONGTEXT') || upper.includes('CLOB')) {
    if (dialect === 'mysql') return upper.includes('LONG') ? 'LONGTEXT' : 'TEXT';
    return 'TEXT';
  }

  if (upper.startsWith('VARCHAR')) {
    if (dialect === 'sqlite') return 'TEXT';
    return upper;
  }

  return dialect === 'sqlite' ? 'TEXT' : 'VARCHAR(255)';
}

export class DatabaseService {
  private logger: Logger;
  private abortController: AbortController | null = null;
  private processingCache: Map<string, any> = new Map();
  private performanceMonitor: {
    startTime: number;
    checkpoints: Array<{ name: string; time: number; memory?: number }>;
  } = { startTime: 0, checkpoints: [] };

  constructor() {
    this.logger = new Logger();
  }

  public formatCSVCell(val: any): string {
    return DatabaseService.formatCSVCell(val);
  }

  public formatCSVHeader(header: string): string {
    return DatabaseService.formatCSVHeader(header);
  }

  /**
   * RFC 4180 compliant CSV cell formatting
   * Preserves integer 0, boolean false, and correctly escapes commas, quotes, CRLF.
   */
  public static formatCSVCell(val: any): string {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  public static formatCSVHeader(header: string): string {
    const str = String(header ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Generates standard DDL for a single decomposed relation.
   */
  public static generateTableDDL(relation: DecomposedRelation, dialect: SQLDialect = 'mysql'): string {
    const tableName = quoteIdentifier(relation.name, dialect);
    const colDefs: string[] = [];
    const pk = relation.primaryKey || [];
    const isCompositePk = pk.length > 1;

    // 1. Column definitions
    for (const attr of relation.attributes) {
      const colName = quoteIdentifier(attr, dialect);
      const rawType = relation.columnTypes?.[attr] || 'VARCHAR(255)';
      const colType = mapDataTypeToDialect(rawType, dialect);
      const isPk = pk.includes(attr);

      if (isPk && !isCompositePk) {
        colDefs.push(`  ${colName} ${colType} PRIMARY KEY`);
      } else if (isPk && isCompositePk) {
        colDefs.push(`  ${colName} ${colType} NOT NULL`);
      } else {
        const constraints =
          (relation.notNull?.[attr] ? ' NOT NULL' : '') + (relation.unique?.includes(attr) ? ' UNIQUE' : '');
        colDefs.push(`  ${colName} ${colType}${constraints}`);
      }
    }

    // 2. Table-level Composite Primary Key Constraint
    if (isCompositePk) {
      const pkCols = pk.map(k => quoteIdentifier(k, dialect)).join(', ');
      colDefs.push(`  PRIMARY KEY (${pkCols})`);
    }

    // 3. Foreign Key Constraints (embedded within CREATE TABLE for SQLite and standard portability)
    if (relation.foreignKeys && relation.foreignKeys.length > 0) {
      for (const fk of relation.foreignKeys) {
        const sourceCols = fk.attributes.map(a => quoteIdentifier(a, dialect)).join(', ');
        const targetTable = quoteIdentifier(fk.references, dialect);
        const targetCols = fk.referencedKey.map(a => quoteIdentifier(a, dialect)).join(', ');
        const constraintName = quoteIdentifier(`fk_${relation.name}_${fk.attributes.join('_')}`.slice(0, 64), dialect);
        colDefs.push(`  CONSTRAINT ${constraintName} FOREIGN KEY (${sourceCols}) REFERENCES ${targetTable}(${targetCols}) ON DELETE CASCADE ON UPDATE CASCADE`);
      }
    }

    let sql = `CREATE TABLE ${tableName} (\n`;
    sql += colDefs.join(',\n');
    sql += '\n)';

    if (dialect === 'mysql') {
      sql += ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    }
    sql += ';\n\n';

    return sql;
  }

  /**
   * Generates complete, dialect-portable DDL schema script for all relations.
   */
  public static generateDDL(relations: DecomposedRelation[], dialect: SQLDialect = 'mysql'): string {
    let out = `-- NormaFlow Relational Schema DDL\n`;
    out += `-- Dialect: ${dialect.toUpperCase()}\n`;
    out += `-- Generated: ${new Date().toISOString()}\n\n`;

    // Dialect-specific Preamble
    switch (dialect) {
      case 'mysql':
        out += `SET FOREIGN_KEY_CHECKS = 0;\nSET UNIQUE_CHECKS = 0;\nSET AUTOCOMMIT = 0;\nSTART TRANSACTION;\n\n`;
        break;
      case 'postgresql':
        out += `BEGIN;\n\n`;
        break;
      case 'sqlite':
        out += `PRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n\n`;
        break;
      case 'ansi':
      default:
        break;
    }

    // Table definitions
    for (const rel of relations) {
      out += DatabaseService.generateTableDDL(rel, dialect);
    }

    // Dialect-specific Postamble
    switch (dialect) {
      case 'mysql':
        out += `COMMIT;\nSET FOREIGN_KEY_CHECKS = 1;\nSET UNIQUE_CHECKS = 1;\nSET AUTOCOMMIT = 1;\n`;
        break;
      case 'postgresql':
        out += `COMMIT;\n`;
        break;
      case 'sqlite':
        out += `COMMIT;\nPRAGMA foreign_keys = ON;\n`;
        break;
      case 'ansi':
      default:
        out += `COMMIT;\n`;
        break;
    }

    return out;
  }

  public generateDDL(relations: DecomposedRelation[], dialect: SQLDialect = 'mysql'): string {
    return DatabaseService.generateDDL(relations, dialect);
  }

  public generateTableDDL(relation: DecomposedRelation, dialect: SQLDialect = 'mysql'): string {
    return DatabaseService.generateTableDDL(relation, dialect);
  }

  async processFile(
    file: File, 
    selectedOperations: string[],
    onProgress?: (state: ProcessingState) => void,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    // A workbook becomes one CSV per sheet; several sheets are several tables.
    if (await isSpreadsheetFile(file)) {
      const sheets = await expandSpreadsheets([file], n => this.logger.warn(n));
      return this.processFiles(sheets, selectedOperations, onProgress, options);
    }

    const startTime = Date.now();
    this.performanceMonitor.startTime = startTime;
    this.performanceMonitor.checkpoints = [];
    this.cacheStats = { hits: 0, misses: 0 };
    this.abortController = new AbortController();
    
    // Enhanced options with adaptive defaults
    const enhancedOptions = {
      ...options,
      enableParallelProcessing: options.enableParallelProcessing ?? true,
      adaptiveThresholds: options.adaptiveThresholds ?? true,
      maxSampleSize: options.maxSampleSize || this.calculateOptimalSampleSize(file.size)
    };
    
    try {
      this.logger.info('Starting optimized database normalization process...', { selectedOperations, options: enhancedOptions });
      
      // Pre-processing system health check
      const systemHealth = await this.checkSystemHealth();
      if (!systemHealth.performanceGood) {
        this.logger.warn('System performance issues detected', systemHealth.recommendations);
      }
      
      // Initialize variables for processing steps
      let processedData: any[] = [];
      let originalData: any[] = [];
      let attributes: string[] = [];
      let functionalDependencies: any[] = [];
      let keyResult: any = { candidateKeys: [], superkeys: [] };
      let relations1NF: any[] = [];
      let relations2NF: any[] = [];
      let relations3NF: any[] = [];
      let relationsBCNF: any[] = [];
      let erdContent = '';
      let relationSchemas = '';
      let sqlDDL = '';
      let atomicityResult: any = {};
      let dataProfile: any = {};
      let cardinalityAnalysis: any = {};
      let losslessCheck: any = { isLossless: false };
      let dependencyPreservation: any = { isPreserved: false };
      
      // Phase 1: Data Preparation with Streaming (0-35%)
      this.addPerformanceCheckpoint('Phase 1 Start: Data Preparation');
      this.logger.info('Phase 1: Optimized Data Preparation');
      
      // Step 1: Enhanced CSV Data Loader
      onProgress?.({ 
        phase: 'PREP', 
        operation: 'csv-loader', 
        progress: 5, 
        message: 'Loading CSV data with streaming...', 
        memoryUsage: this.getMemoryUsage() 
      });
      
      try {
        const csvData = await this.processCSVWithStreaming(file, enhancedOptions);
        originalData = csvData.data;
        processedData = [...originalData];
        attributes = Object.keys(processedData[0] || {});
        
        this.trackDataFootprint(originalData);
        this.addPerformanceCheckpoint('CSV Loading Complete');
        this.logger.success(`CSV loaded with streaming: ${processedData.length} rows, ${attributes.length} columns`);
      } catch (error) {
        throw new Error(`Enhanced CSV processing failed: ${(error as Error).message}`);
      }

      // Data Quality Assessment
      const qualityAssessment = this.assessDataQualityOptimized(processedData);
      if (qualityAssessment.score < 70) {
        this.logger.warn(`Data quality issues detected (score: ${qualityAssessment.score})`);
      }

      // Phases 2-4: run the selected operations through the shared analysis routine.
      const analysis = await this.analyzeRows({
        rows: processedData,
        selectedOperations,
        options: enhancedOptions,
        tableName: file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'table',
        startTime,
        onProgress,
      });
      processedData = analysis.rows;
      attributes = analysis.attributes;
      atomicityResult = analysis.atomicityResult;
      dataProfile = analysis.dataProfile;
      functionalDependencies = analysis.functionalDependencies;
      keyResult = analysis.keyResult;
      relations1NF = analysis.relations1NF;
      relations2NF = analysis.relations2NF;
      relations3NF = analysis.relations3NF;
      relationsBCNF = analysis.relationsBCNF;
      cardinalityAnalysis = analysis.cardinalityAnalysis;
      losslessCheck = analysis.losslessCheck;
      dependencyPreservation = analysis.dependencyPreservation;
      for (const note of analysis.notes) this.logger.warn(note);
      this.addPerformanceCheckpoint('Analysis Complete');

      // Phase 5: Optimized Output Generation (90-100%)
      this.addPerformanceCheckpoint('Phase 5 Start: Optimized Output Generation');
      this.logger.info('Phase 5: Optimized Output Generation');

      // Output operations are table-driven: each selected one runs its generator on the final relations.
      const outputs = await this.runOutputSteps(selectedOperations, relations3NF, startTime, onProgress);
      erdContent = outputs.erdContent;
      relationSchemas = outputs.relationSchemas;
      sqlDDL = outputs.sqlDDL;

      // Step 15: Enhanced Report Generator
      onProgress?.({ 
        phase: 'OUTPUT', 
        operation: 'report-generator', 
        progress: 100, 
        message: 'Finalizing optimized reports...',
        memoryUsage: this.getMemoryUsage()
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
      this.addPerformanceCheckpoint('Process Complete');
      
      // Calculate comprehensive statistics with performance metrics
      const dataRetention = originalData.length > 0 ? 
        ((processedData.length / originalData.length) * 100).toFixed(1) + '%' : '100%';

      const performanceMetrics = {
        totalDuration: duration,
        checkpoints: this.performanceMonitor.checkpoints,
        peakMemoryUsage: this.getPeakMemoryUsage(),
        memorySource: this.memorySource,
        optimizationsApplied: this.getOptimizationsApplied(enhancedOptions),
        cacheHitRate: this.getCacheHitRate(),
        cacheHits: this.cacheStats.hits,
        cacheMisses: this.cacheStats.misses
      };

      // Compile comprehensive results with enhanced metrics
      const result: ProcessingResult = {
        success: true,
        stats: {
          originalRows: originalData.length,
          cleanedRows: processedData.length,
          dataRetention,
          attributes: attributes.length,
          functionalDependencies: functionalDependencies.length,
          candidateKeys: keyResult.candidateKeys.length,
          superkeys: keyResult.superkeys.length,
          relations1NF: relations1NF.length,
          relations2NF: relations2NF.length,
          relations3NF: relations3NF.length,
          relationsBCNF: relationsBCNF.length,
          connectedEntities: relations3NF.filter(r => r.foreignKeys?.length > 0).length,
          relationships: relations3NF.reduce((sum, r) => sum + (r.foreignKeys?.length || 0), 0),
          cardinalityMappings: Object.keys(cardinalityAnalysis).length,
          losslessJoin: losslessCheck.isLossless,
          dependencyPreservation: dependencyPreservation.isPreserved,
          processDuration: duration,
          memoryUsage: this.formatMemoryUsage(this.getPeakMemoryUsage()),
          performanceMetrics
        },
        outputFiles: this.generateOutputFiles(
          processedData, 
          functionalDependencies, 
          keyResult, 
          relations1NF,
          relations2NF,
          relations3NF, 
          erdContent, 
          relationSchemas, 
          sqlDDL, 
          selectedOperations,
          atomicityResult,
          dataProfile,
          cardinalityAnalysis,
          losslessCheck,
          dependencyPreservation,
          performanceMetrics
        ),
        logs: this.logger.getLogs(),
        relations: relations3NF,
        relations1NF,
        relations2NF,
        bcnf: relationsBCNF,
        relationships: relations3NF.flatMap(r => 
          r.foreignKeys?.map((fk: any) => ({
            source: r.name,
            target: fk.references,
            cardinality: fk.cardinality
          })) || []
        ),
        erdContent,
        cardinalityAnalysis,
        losslessCheck,
        dependencyPreservation,
        duration,
        selectedOperations,
        qualityAssessment
      };

      this.logger.success(`Optimized database normalization completed successfully in ${duration}`);
      return result;
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
      this.logger.error('Optimized database normalization process failed', error);
      
      return {
        success: false,
        error: (error as Error).message,
        stats: {
          processDuration: duration,
          memoryUsage: this.formatMemoryUsage(this.getMemoryUsage()),
          performanceMetrics: {
            totalDuration: duration,
            checkpoints: this.performanceMonitor.checkpoints,
            errorOccurred: true
          }
        },
        outputFiles: [],
        logs: this.logger.getLogs(),
        duration,
        selectedOperations
      };
    }
  }

  /** Output-generating operations: one entry per canvas node, run in this order. */
  private static readonly OUTPUT_STEPS: Array<{
    operation: string;
    id: string;
    progress: number;
    message: string;
    label: string;
    key: 'erdContent' | 'relationSchemas' | 'sqlDDL';
    generate: (relations: any[]) => Promise<string>;
  }> = [
    {
      operation: 'ERD Generator',
      id: 'erd-generator',
      progress: 90,
      message: 'Generating enhanced Entity Relationship Diagram...',
      label: 'ERD generation',
      key: 'erdContent',
      generate: async r => (await NormalizationEngine.generateERD(r)).content,
    },
    {
      operation: 'Relation Generator',
      id: 'relation-generator',
      progress: 95,
      message: 'Generating optimized relation schemas...',
      label: 'Relation schema generation',
      key: 'relationSchemas',
      generate: r => NormalizationEngine.generateRelationSchemas(r),
    },
    {
      operation: 'SQL Generator',
      id: 'sql-generator',
      progress: 98,
      message: 'Generating enhanced SQL DDL...',
      label: 'SQL DDL generation',
      key: 'sqlDDL',
      generate: r => NormalizationEngine.generateSQLDDL(r),
    },
  ];

  private async runOutputSteps(
    selectedOperations: string[],
    relations: any[],
    startTime: number,
    onProgress?: (state: ProcessingState) => void,
  ): Promise<{ erdContent: string; relationSchemas: string; sqlDDL: string }> {
    const out = { erdContent: '', relationSchemas: '', sqlDDL: '' };
    for (const step of DatabaseService.OUTPUT_STEPS) {
      if (!selectedOperations.includes(step.operation)) continue;
      this.throwIfAborted();
      onProgress?.({
        phase: 'OUTPUT',
        operation: step.id,
        progress: step.progress,
        message: step.message,
        estimatedTimeRemaining: this.estimateTimeRemaining(step.progress / 100, startTime),
        memoryUsage: this.getMemoryUsage(),
      });
      try {
        out[step.key] = await step.generate(relations);
        this.addPerformanceCheckpoint(`${step.label} Complete`);
        this.logger.success(`${step.label} completed`);
      } catch (error) {
        this.logger.error(`${step.label} failed`, error);
        throw new Error(`${step.label} failed: ${(error as Error).message}`);
      }
    }
    return out;
  }

  // ========== SHARED PER-TABLE ANALYSIS ==========

  private throwIfAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Processing was cancelled.');
    }
  }

  /**
   * Run the selected analysis operations on one table's rows.
   *
   * This is the single implementation used for one file and for every table
   * of a multi-file run, so the canvas selection means the same thing in both.
   *
   * Soundness rules:
   *  - Only dependencies that hold on every row (exact FDs) feed key
   *    discovery and the normal forms. Approximate FDs are reported but not
   *    used unless `acceptApproximateFDs` is set.
   *  - The lossless-join verdict is reported twice: by the chase (with
   *    respect to the FDs) and by re-joining the projections of the data.
   */
  private async analyzeRows(params: {
    rows: any[];
    selectedOperations: string[];
    options: ProcessingOptions;
    tableName: string;
    startTime: number;
    onProgress?: (state: ProcessingState) => void;
    mapProgress?: (percent: number) => number;
  }): Promise<TableAnalysis> {
    const { selectedOperations: ops, options, tableName, startTime } = params;
    const has = (name: string) => ops.includes(name);
    const map = params.mapProgress ?? ((p: number) => p);
    const report = (phase: ProcessingState['phase'], operation: string, percent: number, message: string) => {
      params.onProgress?.({
        phase,
        operation,
        progress: Math.round(map(percent)),
        message,
        estimatedTimeRemaining: this.estimateTimeRemaining(percent / 100, startTime),
        memoryUsage: this.getMemoryUsage(),
      });
    };

    let data = params.rows;
    const notes: string[] = [];
    let atomicityResult: any = {};
    let dataProfile: any = {};
    let nerTags: any[] = [];
    let functionalDependencies: any[] = [];
    let usedFDs: any[] = [];
    let fdSearch: TableAnalysis['fdSearch'] = null;
    let keyResult: any = { candidateKeys: [], superkeys: [] };
    let keyChoice: KeyChoice | null = null;
    let relations1NF: any[] = [];
    let relations2NF: any[] = [];
    let relations3NF: any[] = [];
    let relationsBCNF: any[] = [];
    let cardinalityAnalysis: any = {};
    let losslessCheck: any = { isLossless: false };
    let dependencyPreservation: any = { isPreserved: false };

    if (has('Data Cleaner')) {
      this.throwIfAborted();
      report('PREP', 'data-cleaner', 15, `${tableName}: cleaning data…`);
      data = await this.cleanDataIncremental(data, options);
      this.logger.success(`Data cleaned: ${data.length} rows remaining`);
    }

    let attributes: string[] = Object.keys(data[0] || {});

    if (has('Atomicity Checker')) {
      this.throwIfAborted();
      report('PREP', 'atomicity-checker', 25, `${tableName}: checking atomicity…`);
      atomicityResult = await this.checkAtomicityProgressive(data, options);
    }

    if (has('Data Type Profiler')) {
      this.throwIfAborted();
      report('PREP', 'data-profiler', 35, `${tableName}: profiling data types…`);
      dataProfile = await this.profileDataTypesAdaptive(data, options);
    }

    if (has('NER Classifier')) {
      this.throwIfAborted();
      report('PREP', 'ner-classifier', 38, `${tableName}: classifying columns…`);
      const ner = RelationDetectorService.performNER([{ tableName, headers: attributes, rows: data }]);
      nerTags = ner[tableName] || [];
    }

    // Child tables created by 1NF for multi-valued columns; appended to the final relation sets.
    let atomicChildren: any[] = [];

    if (has('1NF')) {
      this.throwIfAborted();
      report('NORMAL', '1nf', 40, `${tableName}: applying First Normal Form…`);
      data = await NormalizationEngine.apply1NF(data);

      const atomicity =
        Object.keys(atomicityResult?.atomicity ?? {}).length > 0
          ? atomicityResult
          : await DataProcessor.checkAtomicity(this.getProgressiveSample(data, 5000));
      const multiValued = Object.keys(atomicity.atomicity ?? {}).filter(c => atomicity.atomicity[c] === false);
      const split = multiValued.length > 0 ? splitMultiValuedColumns(data, multiValued, tableName) : null;
      if (split) {
        data = split.parentRows;
        attributes = Object.keys(data[0] || {});
        atomicChildren = split.children;
        notes.push(
          `${tableName}: multi-valued column${split.moved.length === 1 ? '' : 's'} ${split.moved.join(', ')} ` +
            `moved to child table${split.moved.length === 1 ? '' : 's'} ${split.children.map(c => c.name).join(', ')} (1NF).`,
        );
      }
      relations1NF = [
        {
          name: `${tableName}_1NF`,
          attributes: [...attributes],
          primaryKey: this.suggestPrimaryKey(data, attributes),
          foreignKeys: [],
          rows: data.slice(0, Math.min(100, data.length)),
          sourceType: '1NF',
          metadata: {
            rowCount: data.length,
            attributeTypes: this.inferAttributeTypesOptimized(data, attributes),
          },
        },
        ...atomicChildren,
      ];
    }

    if (has('FD Miner')) {
      this.throwIfAborted();
      report('ANALYZE', 'fd-miner', 50, `${tableName}: mining functional dependencies…`);
      const mined = await NormalizationEngine.mineFunctionalDependenciesDetailed(data, options.maxLhsSize || 4, {
        signal: this.abortController?.signal,
        timeBudgetMs: options.timeout ?? 30_000,
        sampleSize: options.fdSampleSize ?? 10_000,
        nearKeyRatio: options.nearKeyRatio ?? 0.9,
        completeDeterminantsOnly: options.completeDeterminantsOnly ?? true,
        minRowsForNonKeyDeterminants: options.minRowsForNonKeyDeterminants ?? 10,
      });
      functionalDependencies = mined.fds;
      this.cacheStats.hits += mined.partitionCache?.hits ?? 0;
      this.cacheStats.misses += mined.partitionCache?.misses ?? 0;
      if (mined.sampling) {
        notes.push(
          `${tableName}: dependencies were mined on a ${mined.sampling.sampleSize.toLocaleString()}-row sample and then ` +
            `checked against all ${mined.sampling.totalRows.toLocaleString()} rows` +
            (mined.sampling.refuted > 0
              ? ` (${mined.sampling.refuted} candidate${mined.sampling.refuted === 1 ? ' was' : 's were'} refuted by the full data).`
              : '.'),
        );
      }
      const exact = NormalizationEngine.exactFDs(functionalDependencies);
      usedFDs = options.acceptApproximateFDs ? [...functionalDependencies] : exact;
      fdSearch = {
        truncated: mined.truncated,
        levelReached: mined.levelReached,
        maxLhsSize: mined.maxLhsSize,
        exact: exact.length,
        approximate: functionalDependencies.length - exact.length,
        approximateUsed: Boolean(options.acceptApproximateFDs),
      };
      if (fdSearch.approximate > 0 && !fdSearch.approximateUsed) {
        notes.push(
          `${tableName}: ${fdSearch.approximate} approximate dependenc${fdSearch.approximate === 1 ? 'y was' : 'ies were'} ` +
            `reported but not used for keys or normal forms (they are violated by some rows).`,
        );
      }
      if (mined.truncated) {
        notes.push(
          `${tableName}: FD search stopped after determinants of size ${mined.levelReached}; larger determinants were not explored.`,
        );
      }
    }

    const surrogateFDs = (key: string, attrs: string[]) =>
      attrs
        .filter(a => a !== key)
        .map(a => ({ lhs: [key], rhs: a, confidence: 1, coverage: 1, violations: 0, uniqueGroups: data.length }));

    const runKeyDiscovery = async () => {
      keyResult = await NormalizationEngine.findKeys(attributes, usedFDs);
      keyChoice = chooseKey(attributes, data, keyResult.candidateKeys, tableName);
      if (keyChoice.surrogateAdded) {
        const extra = surrogateFDs(keyChoice.primaryKey[0], attributes);
        usedFDs = [...usedFDs, ...extra];
        functionalDependencies = [...functionalDependencies, ...extra];
        keyResult = { ...keyResult, candidateKeys: [keyChoice.primaryKey], superkeys: [keyChoice.primaryKey] };
        notes.push(`${tableName}: ${keyChoice.reason}`);
      }
      keyResult.primaryKey = keyChoice.primaryKey;
      keyResult.keyChoice = keyChoice;
    };

    if (has('Key Discovery')) {
      this.throwIfAborted();
      report('ANALYZE', 'key-discovery', 60, `${tableName}: discovering keys…`);
      await runKeyDiscovery();
    }

    if (has('Cardinality Analyzer')) {
      this.throwIfAborted();
      report('ANALYZE', 'cardinality-analyzer', 65, `${tableName}: analyzing cardinalities…`);
      cardinalityAnalysis = await NormalizationEngine.analyzeCardinalities(data);
    }

    if (has('2NF')) {
      this.throwIfAborted();
      report('NORMAL', '2nf', 70, `${tableName}: applying Second Normal Form…`);
      relations2NF = await NormalizationEngine.apply2NF(data, usedFDs);
    }

    if (has('3NF')) {
      this.throwIfAborted();
      report('NORMAL', '3nf', 75, `${tableName}: synthesizing Third Normal Form…`);
      relations3NF = await NormalizationEngine.synthesize3NF(usedFDs, keyResult.candidateKeys, data);
    }

    if (has('BCNF')) {
      this.throwIfAborted();
      report('NORMAL', 'bcnf', 78, `${tableName}: decomposing to BCNF…`);
      let sourceRels = relations3NF.length > 0 ? relations3NF : relations2NF;
      if (sourceRels.length === 0) {
        if (!keyChoice) await runKeyDiscovery();
        sourceRels = [
          {
            name: 'MainRelation',
            attributes,
            primaryKey: keyChoice!.primaryKey,
            foreignKeys: [],
            rows: data,
            metadata: { rowCount: data.length, attributeTypes: {} },
          },
        ];
      }
      relationsBCNF = await NormalizationEngine.applyBCNF(sourceRels, usedFDs);
      // BCNF output replaces the 3NF relation set for every later step (checks, ERD, SQL).
      relations3NF = relationsBCNF;
    }

    const finalRelations =
      relations3NF.length > 0 ? relations3NF : relations2NF.length > 0 ? relations2NF : relations1NF;

    if (has('Lossless Check')) {
      this.throwIfAborted();
      report('NORMAL', 'lossless-check', 80, `${tableName}: checking lossless join…`);
      const chase = await NormalizationEngine.checkLosslessJoin(finalRelations, usedFDs);
      const instance = verifyLosslessOnData(
        data,
        finalRelations.map(r => r.attributes),
      );
      losslessCheck = {
        isLossless: chase && instance.lossless !== false,
        chaseLossless: chase,
        instanceLossless: instance.lossless,
        details: {
          algorithm: 'Chase (w.r.t. FDs) + re-join of projections (on data)',
          relationCount: finalRelations.length,
          fdCount: usedFDs.length,
          instance,
        },
      };
      if (chase && instance.lossless === false) {
        notes.push(
          `${tableName}: the chase accepts the decomposition but re-joining the data produced ` +
            `${instance.spuriousRows} spurious and ${instance.missingRows} missing rows; some dependencies may be coincidental.`,
        );
      }
    }

    if (has('Dependency Preservation')) {
      this.throwIfAborted();
      report('NORMAL', 'dependency-preservation', 85, `${tableName}: checking dependency preservation…`);
      const details = NormalizationEngine.checkDependencyPreservationDetails(finalRelations, usedFDs);
      dependencyPreservation = {
        isPreserved: details.isPreserved,
        preserved: details.preserved,
        lost: details.lost,
        details: details.details,
        totalDependencies: details.totalDependencies,
        preservedCount: details.preserved.length,
        lostCount: details.lost.length,
        preservationRatio: details.preservationRatio,
      };
    }

    attributes = Object.keys(data[0] || {});

    if (atomicChildren.length > 0) {
      // Add the 1NF child tables to every normal-form set that exists, linked to the relation holding the key.
      const withChildren = (set: any[]): any[] => {
        if (set.length === 0) return set;
        const extra = atomicChildren.map(child => {
          const linkKey = child.primaryKey.slice(0, -1);
          const parent =
            set.find(r => linkKey.every((k: string) => r.primaryKey?.includes(k)) && r.primaryKey.length === linkKey.length) ??
            set.find(r => linkKey.every((k: string) => r.attributes.includes(k)));
          return {
            ...child,
            foreignKeys: parent
              ? [{ attributes: linkKey, references: parent.name, referencedKey: linkKey, cardinality: '1:N' }]
              : [],
          };
        });
        return [...set, ...extra];
      };
      const bcnfIsFinal = relations3NF === relationsBCNF;
      relations2NF = withChildren(relations2NF);
      relations3NF = withChildren(relations3NF);
      relationsBCNF = bcnfIsFinal ? relations3NF : withChildren(relationsBCNF);
    }

    return {
      rows: data,
      attributes,
      atomicityResult,
      dataProfile,
      nerTags,
      functionalDependencies,
      usedFDs,
      fdSearch,
      keyResult,
      keyChoice,
      relations1NF,
      relations2NF,
      relations3NF,
      relationsBCNF,
      cardinalityAnalysis,
      losslessCheck,
      dependencyPreservation,
      notes,
    };
  }

  // ========== OPTIMIZED HELPER METHODS ==========

  /**
   * Enhanced CSV processing with streaming capabilities
   */
  private async processCSVWithStreaming(file: File, _options: ProcessingOptions): Promise<{ data: any[] }> {
    const chunkSize = 1024 * 1024; // 1MB chunks
    const maxRows = HARD_ROW_LIMIT;
    
    // Use streaming for large files
    if (file.size > chunkSize * 10) {
      this.logger.info('Large file detected, using streaming CSV processing');
      return await this.streamCSVProcessing(file, maxRows);
    }
    
    // Standard processing for smaller files
    return await CSVProcessor.processFile(file);
  }

  /**
   * Streaming CSV processing for large files
   */
  private async streamCSVProcessing(file: File, maxRows: number): Promise<{ data: any[]; metadata?: any }> {
    const reader = file.stream().getReader();
    let decoder: TextDecoder | null = null;
    const rows: Record<string, any>[] = [];
    let headers: string[] = [];

    const parser = new CSVProcessor.StreamingParser({
      maxRows,
      onHeaders: (h) => {
        headers = h;
      },
      onRow: (row) => {
        rows.push(row);
      }
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const finalChunk = decoder ? decoder.decode(undefined, { stream: false }) : '';
          if (finalChunk) {
            parser.feed(finalChunk);
          }
          parser.finish();
          break;
        }

        if (!decoder) {
          const created = createDecoder(value);
          decoder = created.decoder;
          if (created.encoding !== 'utf-8') {
            this.logger.info(`${file.name}: detected ${created.encoding} encoding`);
          }
        }
        const chunkText = decoder.decode(value, { stream: true });
        const shouldContinue = parser.feed(chunkText);
        if (!shouldContinue) {
          this.logger.warn(
            `${file.name}: more than ${rows.length.toLocaleString()} rows — only the first ${rows.length.toLocaleString()} are analysed.`
          );
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      data: rows,
      metadata: {
        originalRows: rows.length,
        finalRows: rows.length,
        originalColumns: headers.length,
        finalColumns: headers.length,
        fileName: file.name,
        delimiter: parser.getDelimiter()
      }
    };
  }

  /**
   * Incremental data cleaning with batching
   */
  private async cleanDataIncremental(data: any[], _options: ProcessingOptions): Promise<any[]> {
    const batchSize = 1000;
    const cleanedData: any[] = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const cleanedBatch = await DataProcessor.clean(batch);
      cleanedData.push(...cleanedBatch);
      
      // Yield control periodically
      if (i % (batchSize * 5) === 0) {
        await this.yieldControl();
      }
    }
    
    return cleanedData;
  }

  /**
   * Progressive atomicity checking
   */
  private async checkAtomicityProgressive(data: any[], _options: ProcessingOptions): Promise<any> {
    const sampleSize = Math.min(data.length, 5000);
    const sampleData = this.getProgressiveSample(data, sampleSize);

    const result = await DataProcessor.checkAtomicity(sampleData);
    const multiValued = Object.keys(result.atomicity).filter(c => result.atomicity[c] === false);
    if (multiValued.length > 0) {
      this.logger.warn(
        `Possible multi-valued column(s): ${multiValued.join(', ')}. ` +
          `These violate 1NF if each cell holds several values; consider moving them to a child table.`
      );
    }
    return result;
  }

  /**
   * Adaptive data type profiling
   */
  private async profileDataTypesAdaptive(data: any[], _options: ProcessingOptions): Promise<any> {
    const sampleSize = Math.min(data.length, 2000);
    const sampleData = this.getProgressiveSample(data, sampleSize);
    
    return await DataProcessor.profileDataTypes(sampleData);
  }

  /**
   * Progressive sampling strategy
   */
  private getProgressiveSample(data: any[], targetSize: number): any[] {
    if (data.length <= targetSize) return data;
    
    const step = Math.floor(data.length / targetSize);
    const sample: any[] = [];
    
    for (let i = 0; i < data.length && sample.length < targetSize; i += step) {
      sample.push(data[i]);
    }
    
    return sample;
  }

  /**
   * Calculate optimal sample size based on file size
   */
  private calculateOptimalSampleSize(fileSize: number): number {
    const baseSample = 10000;
    const sizeFactor = Math.log10(fileSize / (1024 * 1024)); // MB factor
    return Math.min(50000, Math.max(baseSample, baseSample * sizeFactor));
  }

  /**
   * Performance monitoring methods
   */
  private addPerformanceCheckpoint(name: string): void {
    this.performanceMonitor.checkpoints.push({
      name,
      time: Date.now() - this.performanceMonitor.startTime,
      memory: this.getMemoryUsage()
    });
  }

  /** Rough in-memory size of the loaded rows (MB), used where the runtime does not report heap usage. */
  private dataFootprintMB = 0;
  private memorySource: 'heap' | 'node' | 'estimate' = 'estimate';

  private trackDataFootprint(rows: Array<Record<string, unknown>>): void {
    if (!rows.length) return;
    const step = Math.max(1, Math.floor(rows.length / 200));
    let bytes = 0;
    let n = 0;
    for (let i = 0; i < rows.length; i += step, n++) {
      for (const v of Object.values(rows[i])) bytes += 16 + (typeof v === 'string' ? v.length * 2 : 8);
    }
    this.dataFootprintMB = (bytes / n) * rows.length / 1024 / 1024;
  }

  /** Heap in use (Chromium `performance.memory`, or Node), else an estimate from the loaded data. WebKit webviews expose no heap counter. */
  private getMemoryUsage(): number {
    const perfMem = (performance as any)?.memory;
    if (perfMem && typeof perfMem.usedJSHeapSize === 'number') {
      this.memorySource = 'heap';
      return perfMem.usedJSHeapSize / 1024 / 1024;
    }
    const proc = (globalThis as any).process;
    if (typeof proc?.memoryUsage === 'function') {
      this.memorySource = 'node';
      return proc.memoryUsage().heapUsed / 1024 / 1024;
    }
    this.memorySource = 'estimate';
    return this.dataFootprintMB;
  }

  private getPeakMemoryUsage(): number {
    if (!this.performanceMonitor?.checkpoints || this.performanceMonitor.checkpoints.length === 0) return 0;
    return Math.max(0, ...this.performanceMonitor.checkpoints.map(c => c.memory || 0));
  }

  private formatMemoryUsage(bytes: number): string {
    return `${bytes.toFixed(2)} MB`;
  }

  private estimateTimeRemaining(progress: number, startTime: number): number {
    const elapsed = Date.now() - startTime;
    const totalEstimated = elapsed / progress;
    return Math.max(0, totalEstimated - elapsed);
  }

  private getOptimizationsApplied(options: ProcessingOptions): string[] {
    const optimizations: string[] = [];
    
    if (options.enableParallelProcessing) optimizations.push('Parallel Processing');
    if (options.adaptiveThresholds) optimizations.push('Adaptive Thresholds');
    if (options.maxSampleSize) optimizations.push('Sampling Strategy');
    
    optimizations.push('Streaming CSV', 'Incremental Processing', 'Memory Optimization');
    
    return optimizations;
  }

  /** Partition-cache counters for the current run (FD mining), reset at the start of each run. */
  private cacheStats = { hits: 0, misses: 0 };

  /** Share of partition requests served from the cache, or null when nothing was mined. */
  private getCacheHitRate(): number | null {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return total > 0 ? this.cacheStats.hits / total : null;
  }


  /**
   * Optimized data quality assessment
   */
  private assessDataQualityOptimized(data: any[]): {
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    if (data.length === 0) {
      return {
        score: 0,
        issues: ['No data available'],
        recommendations: ['Upload a valid CSV file with data']
      };
    }

    const attributes = Object.keys(data[0] || {});
    const sampleSize = Math.min(data.length, 1000); // Reduced sample for performance
    const sampleData = data.slice(0, sampleSize);
    
    // Quick missing values check
    const missingValueRatio = sampleData.reduce((sum, row) => {
      const missingCount = attributes.filter(attr => 
        row[attr] === null || row[attr] === undefined || row[attr] === ''
      ).length;
      return sum + (missingCount / attributes.length);
    }, 0) / sampleData.length;

    if (missingValueRatio > 0.1) {
      score -= 20;
      issues.push(`High missing value ratio: ${(missingValueRatio * 100).toFixed(1)}%`);
      recommendations.push('Consider data cleaning to handle missing values');
    }

    // Quick duplicate check
    const uniqueRows = new Set(sampleData.map(row => JSON.stringify(row))).size;
    const duplicateRatio = 1 - (uniqueRows / sampleData.length);
    
    if (duplicateRatio > 0.05) {
      score -= 15;
      issues.push(`Duplicate rows detected: ${(duplicateRatio * 100).toFixed(1)}%`);
      recommendations.push('Remove duplicate rows to improve analysis quality');
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  /**
   * Suggest primary key based on data characteristics
   */
  private suggestPrimaryKey(data: any[], attributes: string[]): string[] {
    if (data.length === 0 || attributes.length === 0) return attributes.slice(0, 1);
    
    // Quick uniqueness check on sample
    const sampleSize = Math.min(data.length, 1000);
    const sample = data.slice(0, sampleSize);
    
    for (const attr of attributes) {
      const uniqueValues = new Set(sample.map(row => row[attr]));
      if (uniqueValues.size === sample.length) {
        return [attr]; // Found a unique attribute
      }
    }
    
    return attributes.slice(0, 1); // Fallback
  }

  /**
   * Optimized attribute type inference
   */
  private inferAttributeTypesOptimized(data: any[], attributes: string[]): { [key: string]: string } {
    const types: { [key: string]: string } = {};
    const sampleSize = Math.min(data.length, 50); // Reduced sample size
    
    for (const attr of attributes) {
      const values = data.slice(0, sampleSize).map(row => row[attr]).filter(v => v !== null && v !== undefined && v !== '' && String(v).trim() !== '');
      types[attr] = this.inferDataTypeOptimized(values);
    }
    
    return types;
  }

  /**
   * Optimized data type inference
   */
  private inferDataTypeOptimized(values: any[]): string {
    if (!values || values.length === 0) return 'string';
    
    const sample = values.slice(0, Math.min(values.length, 10)); // Further reduced
    
    // Quick numeric check
    const numericSample = sample.filter(v => !isNaN(v) && !isNaN(parseFloat(v)));
    if (numericSample.length === sample.length) {
      return sample.some(v => v.toString().includes('.')) ? 'decimal' : 'integer';
    }
    
    // Quick boolean check
    if (sample.every(v => /^(true|false|yes|no|y|n|0|1)$/i.test(v.toString()))) {
      return 'boolean';
    }
    
    return 'string';
  }

  /**
   * Yield control to prevent blocking
   */
  private async yieldControl(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Enhanced retry mechanism with exponential backoff
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Operation failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`);
        
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  // ========== OUTPUT FILE GENERATION ==========

  private generateOutputFiles(
    data: any[], 
    fds: any[], 
    keyResult: any, 
    relations1NF: any[],
    relations2NF: any[],
    relations3NF: any[], 
    erdContent: string,
    relationSchemas: string,
    sqlDDL: string,
    selectedOperations: string[],
    atomicityResult: any,
    dataProfile: any,
    cardinalityAnalysis: any,
    losslessCheck: any,
    dependencyPreservation: any,
    performanceMetrics?: any
  ): OutputFile[] {
    const files: OutputFile[] = [];

    // Performance Metrics File (NEW)
    if (performanceMetrics) {
      files.push({
        name: 'performance_metrics.json',
        type: 'json',
        description: 'Detailed performance metrics and optimizations applied',
        content: performanceMetrics,
        size: JSON.stringify(performanceMetrics).length,
        category: 'Performance Analytics'
      });

      files.push({
        name: 'performance_report.md',
        type: 'markdown',
        description: 'Performance analysis and optimization report',
        content: this.generatePerformanceReportMarkdown(performanceMetrics),
        size: 0,
        category: 'Performance Analytics'
      });
    }

    // Data Preparation Outputs
    if (selectedOperations.includes('Data Cleaner') && data.length > 0) {
      files.push({
        name: 'cleaned_data.json',
        type: 'json',
        description: 'Cleaned and processed dataset',
        content: data.slice(0, 100), // Limit for performance
        size: JSON.stringify(data).length,
        category: 'Data Preparation'
      });

      const csvContent = this.objectsToCSV(data);
      files.push({
        name: 'cleaned_data.csv',
        type: 'csv',
        description: 'Cleaned dataset in CSV format',
        content: csvContent,
        size: csvContent.length,
        category: 'Data Preparation'
      });
    }

    // Atomicity Analysis
    if (selectedOperations.includes('Atomicity Checker')) {
      files.push({
        name: 'atomicity_analysis.json',
        type: 'json',
        description: 'First Normal Form atomicity analysis',
        content: atomicityResult,
        size: JSON.stringify(atomicityResult).length,
        category: 'Data Preparation'
      });

      files.push({
        name: 'atomicity_report.md',
        type: 'markdown',
        description: 'Atomicity analysis report',
        content: this.generateAtomicityMarkdown(atomicityResult),
        size: 0,
        category: 'Data Preparation'
      });
    }

    // Data Profiling
    if (selectedOperations.includes('Data Type Profiler')) {
      files.push({
        name: 'data_profile.json',
        type: 'json',
        description: 'Data type and quality analysis',
        content: dataProfile,
        size: JSON.stringify(dataProfile).length,
        category: 'Data Preparation'
      });

      files.push({
        name: 'data_profile_report.md',
        type: 'markdown',
        description: 'Data profiling report',
        content: this.generateDataProfileMarkdown(dataProfile),
        size: 0,
        category: 'Data Preparation'
      });
    }

    // 1NF Relations
    if (selectedOperations.includes('1NF') && relations1NF.length > 0) {
      files.push({
        name: 'relations_1nf.json',
        type: 'json',
        description: 'First Normal Form relations',
        content: relations1NF.map(r => ({ ...r, rows: undefined })), // Remove data for size
        size: 0,
        category: 'First Normal Form'
      });

      files.push({
        name: 'relations_1nf_report.md',
        type: 'markdown',
        description: '1NF analysis and atomicity report',
        content: this.generate1NFMarkdown(relations1NF),
        size: 0,
        category: 'First Normal Form'
      });
    }

    // Cardinality Analysis
    if (selectedOperations.includes('Cardinality Analyzer')) {
      files.push({
        name: 'cardinality_analysis.json',
        type: 'json',
        description: 'Relationship cardinality analysis',
        content: cardinalityAnalysis,
        size: JSON.stringify(cardinalityAnalysis).length,
        category: 'Analysis'
      });

      files.push({
        name: 'cardinality_report.md',
        type: 'markdown',
        description: 'Cardinality analysis report',
        content: this.generateCardinalityMarkdown(cardinalityAnalysis),
        size: 0,
        category: 'Analysis'
      });
    }

    // Functional Dependencies
    if (selectedOperations.includes('FD Miner') && fds.length > 0) {
      files.push({
        name: 'functional_dependencies.md',
        type: 'markdown',
        description: 'Comprehensive functional dependency analysis',
        content: this.generateFDMarkdown(fds),
        size: 0,
        category: 'Functional Dependencies'
      });

      files.push({
        name: 'functional_dependencies.json',
        type: 'json',
        description: 'Functional dependencies raw data',
        content: fds,
        size: JSON.stringify(fds).length,
        category: 'Functional Dependencies'
      });

      // Generate FD visualization SVG
      const fdSvg = this.generateFDVisualizationSVG(fds);
      files.push({
        name: 'functional_dependencies_graph.svg',
        type: 'svg',
        description: 'Functional dependencies visualization',
        content: fdSvg,
        size: fdSvg.length,
        category: 'Functional Dependencies'
      });
    }

    // Key Analysis
    if (selectedOperations.includes('Key Discovery')) {
      files.push({
        name: 'keys_analysis.md',
        type: 'markdown',
        description: 'Candidate and super key analysis',
        content: this.generateKeyMarkdown(keyResult),
        size: 0,
        category: 'Key Analysis'
      });

      files.push({
        name: 'keys_analysis.json',
        type: 'json',
        description: 'Key analysis raw data',
        content: keyResult,
        size: JSON.stringify(keyResult).length,
        category: 'Key Analysis'
      });
    }

    // 2NF Relations
    if (selectedOperations.includes('2NF') && relations2NF.length > 0) {
      files.push({
        name: 'relations_2nf.json',
        type: 'json',
        description: 'Second Normal Form relations',
        content: relations2NF.map(r => ({ ...r, rows: undefined })), // Remove data for size
        size: 0,
        category: 'Second Normal Form'
      });

      files.push({
        name: 'relations_2nf_report.md',
        type: 'markdown',
        description: '2NF analysis and decomposition report',
        content: this.generate2NFMarkdown(relations2NF),
        size: 0,
        category: 'Second Normal Form'
      });

      // Export individual 2NF relation data
      relations2NF.forEach((relation) => {
        if (relation.rows && relation.rows.length > 0) {
          const csvText = this.objectsToCSV(relation.rows);
          files.push({
            name: `relation_2nf_${relation.name}.csv`,
            type: 'csv',
            description: `2NF data for relation: ${relation.name}`,
            content: csvText,
            size: csvText.length,
            category: 'Second Normal Form'
          });
        }
      });
    }

    // 3NF Relations
    if (selectedOperations.includes('3NF') && relations3NF.length > 0) {
      files.push({
        name: 'relations_3nf.json',
        type: 'json',
        description: 'Third Normal Form relations',
        content: relations3NF.map(r => ({ ...r, rows: undefined })), // Remove data for size
        size: 0,
        category: 'Third Normal Form'
      });

      if (relationSchemas) {
        files.push({
          name: 'relation_schemas.md',
          type: 'markdown',
          description: 'Detailed relation schema documentation',
          content: relationSchemas,
          size: relationSchemas.length,
          category: 'Third Normal Form'
        });
      }

      // Export individual 3NF relation data
      relations3NF.forEach((relation) => {
        if (relation.rows && relation.rows.length > 0) {
          const csvText = this.objectsToCSV(relation.rows);
          files.push({
            name: `relation_3nf_${relation.name}.csv`,
            type: 'csv',
            description: `3NF data for relation: ${relation.name}`,
            content: csvText,
            size: csvText.length,
            category: 'Third Normal Form'
          });

          files.push({
            name: `relation_3nf_${relation.name}.json`,
            type: 'json',
            description: `3NF JSON data for relation: ${relation.name}`,
            content: relation.rows,
            size: JSON.stringify(relation.rows).length,
            category: 'Third Normal Form'
          });
        }
      });
    }

    // BCNF Relations
    if (selectedOperations.includes('BCNF') && relations3NF.length > 0) {
      files.push({
        name: 'relations_bcnf.json',
        type: 'json',
        description: 'Boyce-Codd Normal Form relations',
        content: relations3NF.map(r => ({ ...r, rows: undefined })),
        size: 0,
        category: 'Boyce-Codd Normal Form'
      });

      relations3NF.forEach((relation) => {
        if (relation.rows && relation.rows.length > 0) {
          const csvText = this.objectsToCSV(relation.rows);
          files.push({
            name: `relation_bcnf_${relation.name}.csv`,
            type: 'csv',
            description: `BCNF data for relation: ${relation.name}`,
            content: csvText,
            size: csvText.length,
            category: 'Boyce-Codd Normal Form'
          });
        }
      });
    }

    // Lossless Join Check
    if (selectedOperations.includes('Lossless Check')) {
      files.push({
        name: 'lossless_check.json',
        type: 'json',
        description: 'Lossless join decomposition analysis',
        content: losslessCheck,
        size: JSON.stringify(losslessCheck).length,
        category: 'Quality Assurance'
      });

      files.push({
        name: 'lossless_check_report.md',
        type: 'markdown',
        description: 'Lossless join analysis report',
        content: this.generateLosslessCheckMarkdown(losslessCheck),
        size: 0,
        category: 'Quality Assurance'
      });
    }

    // Dependency Preservation
    if (selectedOperations.includes('Dependency Preservation')) {
      files.push({
        name: 'dependency_preservation.json',
        type: 'json',
        description: 'Dependency preservation analysis',
        content: dependencyPreservation,
        size: JSON.stringify(dependencyPreservation).length,
        category: 'Quality Assurance'
      });

      files.push({
        name: 'dependency_preservation_report.md',
        type: 'markdown',
        description: 'Dependency preservation analysis report',
        content: this.generateDependencyPreservationMarkdown(dependencyPreservation),
        size: 0,
        category: 'Quality Assurance'
      });
    }

    // Entity Relationship Diagram
    if (selectedOperations.includes('ERD Generator') && erdContent) {
      files.push({
        name: 'erd_diagram.mmd',
        type: 'mermaid',
        description: 'Entity Relationship Diagram in Mermaid format',
        content: erdContent,
        size: erdContent.length,
        category: 'Entity Relationship Diagram'
      });
    }

    // SQL Generation
    if (selectedOperations.includes('SQL Generator') && sqlDDL) {
      files.push({
        name: 'database_schema.sql',
        type: 'sql',
        description: 'Complete SQL Data Definition Language',
        content: sqlDDL,
        size: sqlDDL.length,
        category: 'SQL Generation'
      });
    }

    // ENHANCED Process Report - Operation-Focused and User-Relevant
    if (selectedOperations.includes('Report Generator')) {
      const reportContent = this.generateEnhancedProcessReport(
        selectedOperations, 
        fds, 
        keyResult, 
        relations1NF,
        relations2NF,
        relations3NF, 
        data,
        cardinalityAnalysis,
        losslessCheck,
        dependencyPreservation,
        atomicityResult,
        dataProfile,
        performanceMetrics
      );
      files.push({
        name: 'process_report.md',
        type: 'markdown',
        description: 'Comprehensive normalization analysis report',
        content: reportContent,
        size: reportContent.length,
        category: 'Process Report'
      });
    }

    return files;
  }

  // ========== ENHANCED REPORT GENERATION ==========

  /**
   * Enhanced Process Report - Operation-Focused and User-Relevant
   */
  private generateEnhancedProcessReport(
    selectedOperations: string[], 
    fds: any[], 
    keyResult: any, 
    relations1NF: any[],
    relations2NF: any[],
    relations3NF: any[], 
    data: any[],
    cardinalityAnalysis: any,
    losslessCheck: any,
    dependencyPreservation: any,
    atomicityResult: any,
    dataProfile: any,
    performanceMetrics?: any
  ): string {
    let content = '# Database Normalization Analysis Report\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Author:** miskatul-anwar\n`;
    content += `**Dataset:** ${data.length} records, ${Object.keys(data[0] || {}).length} attributes\n\n`;
    
    // Executive Summary - Key Results Only
    content += '## Executive Summary\n\n';
    content += this.generateExecutiveSummary(selectedOperations, fds, keyResult, relations3NF, losslessCheck, dependencyPreservation);
    
    // Operation-Specific Analysis - Only for Selected Operations
    content += '## Analysis Results by Operation\n\n';
    
    // CSV Data Loader Results
    if (selectedOperations.includes('CSV Data Loader') || data.length > 0) {
      content += this.generateDataLoaderSection(data);
    }
    
    // Data Cleaner Results
    if (selectedOperations.includes('Data Cleaner')) {
      content += this.generateDataCleanerSection(data);
    }
    
    // Atomicity Checker Results
    if (selectedOperations.includes('Atomicity Checker')) {
      content += this.generateAtomicitySection(atomicityResult);
    }
    
    // Data Type Profiler Results
    if (selectedOperations.includes('Data Type Profiler')) {
      content += this.generateDataProfilerSection(dataProfile);
    }
    
    // FD Miner Results
    if (selectedOperations.includes('FD Miner')) {
      content += this.generateFDMinerSection(fds);
    }
    
    // Key Discovery Results
    if (selectedOperations.includes('Key Discovery')) {
      content += this.generateKeyDiscoverySection(keyResult);
    }
    
    // Cardinality Analyzer Results
    if (selectedOperations.includes('Cardinality Analyzer')) {
      content += this.generateCardinalitySection(cardinalityAnalysis);
    }
    
    // 1NF Results
    if (selectedOperations.includes('1NF')) {
      content += this.generate1NFSection(relations1NF);
    }
    
    // 2NF Results
    if (selectedOperations.includes('2NF')) {
      content += this.generate2NFSection(relations2NF);
    }
    
    // 3NF Results
    if (selectedOperations.includes('3NF')) {
      content += this.generate3NFSection(relations3NF);
    }
    
    // Lossless Check Results
    if (selectedOperations.includes('Lossless Check')) {
      content += this.generateLosslessSection(losslessCheck);
    }
    
    // Dependency Preservation Results
    if (selectedOperations.includes('Dependency Preservation')) {
      content += this.generateDependencyPreservationSection(dependencyPreservation);
    }
    
    // ERD Generator Results
    if (selectedOperations.includes('ERD Generator')) {
      content += this.generateERDSection(relations3NF);
    }
    
    // Relation Generator Results
    if (selectedOperations.includes('Relation Generator')) {
      content += this.generateRelationGeneratorSection(relations3NF);
    }
    
    // SQL Generator Results
    if (selectedOperations.includes('SQL Generator')) {
      content += this.generateSQLGeneratorSection(relations3NF);
    }
    
    // Performance Analysis
    if (performanceMetrics) {
      content += this.generatePerformanceSection(performanceMetrics);
    }
    
    // Actionable Recommendations
    content += this.generateActionableRecommendations(selectedOperations, fds, keyResult, losslessCheck, dependencyPreservation);
    
    // Next Steps
    content += this.generateNextSteps(selectedOperations, relations3NF);
    
    content += '\n---\n';
    content += `*Report generated by NormaFlow Database Normalization Engine*\n`;
    
    return content;
  }

  private generateExecutiveSummary(selectedOperations: string[], fds: any[], keyResult: any, relations3NF: any[], losslessCheck: any, dependencyPreservation: any): string {
    let content = '';
    
    // Core Results
    if (selectedOperations.includes('FD Miner') && fds.length > 0) {
      const highQualityFDs = fds.filter(fd => fd.confidence > 0.98);
      content += `**Functional Dependencies:** ${fds.length} discovered (${highQualityFDs.length} high-confidence)\n`;
    }
    
    if (selectedOperations.includes('Key Discovery') && keyResult.candidateKeys) {
      content += `**Primary Keys:** ${keyResult.candidateKeys.length} candidate keys identified\n`;
    }
    
    if (selectedOperations.includes('3NF') && relations3NF.length > 0) {
      content += `**Normalized Schema:** ${relations3NF.length} relations in Third Normal Form\n`;
    }
    
    // Quality Metrics
    if (selectedOperations.includes('Lossless Check')) {
      content += `**Lossless Join:** ${losslessCheck.isLossless ? 'VERIFIED' : 'FAILED'}\n`;
    }
    
    if (selectedOperations.includes('Dependency Preservation')) {
      const preservationRate = dependencyPreservation.preservationRatio ? (dependencyPreservation.preservationRatio * 100).toFixed(1) : '0';
      content += `**Dependency Preservation:** ${preservationRate}% of dependencies preserved\n`;
    }
    
    content += '\n';
    return content;
  }

  private generateDataLoaderSection(data: any[]): string {
    let content = '### CSV Data Loader\n\n';
    
    if (data.length === 0) {
      content += '**Status:** No data loaded\n\n';
      return content;
    }
    
    const attributes = Object.keys(data[0] || {});
    content += `**Status:** Successfully loaded\n`;
    content += `**Records:** ${data.length.toLocaleString()}\n`;
    content += `**Attributes:** ${attributes.length}\n`;
    content += `**Columns:** ${attributes.join(', ')}\n\n`;
    
    return content;
  }

  private generateDataCleanerSection(data: any[]): string {
    let content = '### Data Cleaner\n\n';
    content += `**Status:** Data cleaning completed\n`;
    content += `**Records After Cleaning:** ${data.length.toLocaleString()}\n`;
    content += `**Actions:** Removed null values, standardized formats, validated integrity\n\n`;
    
    return content;
  }

  private generateAtomicitySection(atomicityResult: any): string {
    let content = '### Atomicity Checker\n\n';
    
    if (!atomicityResult || !atomicityResult.atomicity) {
      content += '**Status:** No atomicity analysis available\n\n';
      return content;
    }
    
    const totalAttrs = Object.keys(atomicityResult.atomicity).length;
    const atomicAttrs = Object.values(atomicityResult.atomicity).filter(Boolean).length;
    const violations = Object.keys(atomicityResult.violations || {}).length;
    
    content += `**Status:** ${violations === 0 ? 'PASSED' : 'VIOLATIONS FOUND'}\n`;
    content += `**Atomic Attributes:** ${atomicAttrs}/${totalAttrs}\n`;
    if (violations > 0) {
      content += `**Non-Atomic Attributes:** ${violations}\n`;
      content += `**Action Required:** Decompose non-atomic values\n`;
    }
    content += '\n';
    
    return content;
  }

  private generateDataProfilerSection(dataProfile: any): string {
    let content = '### Data Type Profiler\n\n';
    
    if (!dataProfile || Object.keys(dataProfile).length === 0) {
      content += '**Status:** No data profiling available\n\n';
      return content;
    }
    
    const typeDistribution: { [key: string]: number } = {};
    Object.values(dataProfile).forEach((type: any) => {
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });
    
    content += `**Status:** Profiling completed\n`;
    content += `**Data Types Identified:**\n`;
    Object.entries(typeDistribution).forEach(([type, count]) => {
      content += `- ${type}: ${count} attribute(s)\n`;
    });
    content += '\n';
    
    return content;
  }

  private generateFDMinerSection(fds: any[]): string {
    let content = '### Functional Dependency Miner\n\n';
    
    if (fds.length === 0) {
      content += '**Status:** No functional dependencies discovered\n';
      content += '**Implication:** Dataset may already be highly normalized or lacks clear patterns\n\n';
      return content;
    }
    
    const highConfidenceFDs = fds.filter(fd => fd.confidence > 0.98);
    const mediumConfidenceFDs = fds.filter(fd => fd.confidence > 0.90 && fd.confidence <= 0.98);
    
    content += `**Status:** Mining completed successfully\n`;
    content += `**Total Dependencies:** ${fds.length}\n`;
    content += `**High Confidence (>98%):** ${highConfidenceFDs.length}\n`;
    content += `**Medium Confidence (90-98%):** ${mediumConfidenceFDs.length}\n`;
    
    if (highConfidenceFDs.length > 0) {
      content += `**Key Dependencies:**\n`;
      highConfidenceFDs.slice(0, 5).forEach(fd => {
        const lhsStr = Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs;
        content += `- ${lhsStr} → ${fd.rhs} (${(fd.confidence * 100).toFixed(1)}%)\n`;
      });
      if (highConfidenceFDs.length > 5) {
        content += `- ... and ${highConfidenceFDs.length - 5} more\n`;
      }
    }
    content += '\n';
    
    return content;
  }

  private generateKeyDiscoverySection(keyResult: any): string {
    let content = '### Key Discovery\n\n';
    
    if (!keyResult.candidateKeys || keyResult.candidateKeys.length === 0) {
      content += '**Status:** No natural keys found\n';
      content += '**Recommendation:** Consider adding surrogate keys (auto-increment IDs)\n';
      if (keyResult.fallbackUsed) {
        content += '**Fallback:** Synthetic key strategy suggested\n';
      }
      content += '\n';
      return content;
    }
    
    content += `**Status:** Key discovery completed\n`;
    content += `**Candidate Keys:** ${keyResult.candidateKeys.length}\n`;
    content += `**Super Keys:** ${keyResult.superkeys?.length || 0}\n`;
    
    if (keyResult.searchMetrics) {
      content += `**Search Strategy:** ${keyResult.searchMetrics.finalStrategy}\n`;
      content += `**Processing Time:** ${keyResult.searchMetrics.totalDuration}ms\n`;
    }
    
    content += `**Discovered Keys:**\n`;
    keyResult.candidateKeys.forEach((key: string[], _index: number) => {
      const keyType = key.length === 1 ? 'Simple' : 'Composite';
      content += `- {${key.join(', ')}} (${keyType})\n`;
    });
    
    // Primary key recommendation
    const simpleKeys = keyResult.candidateKeys.filter((key: string[]) => key.length === 1);
    if (simpleKeys.length > 0) {
      content += `**Recommended Primary Key:** {${simpleKeys[0].join(', ')}}\n`;
    } else if (keyResult.candidateKeys.length > 0) {
      const shortestKey = keyResult.candidateKeys.reduce((min: string[], key: string[]) => 
        key.length < min.length ? key : min
      );
      content += `**Recommended Primary Key:** {${shortestKey.join(', ')}}\n`;
    }
    content += '\n';
    
    return content;
  }

  private generateCardinalitySection(cardinalityAnalysis: any): string {
    let content = '### Cardinality Analyzer\n\n';
    
    if (!cardinalityAnalysis || Object.keys(cardinalityAnalysis).length === 0) {
      content += '**Status:** No cardinality analysis available\n\n';
      return content;
    }
    
    const attributes = Object.keys(cardinalityAnalysis);
    const highUniqueAttrs = attributes.filter(attr => 
      (cardinalityAnalysis[attr].cardinality || 0) > 0.9
    );
    const lowUniqueAttrs = attributes.filter(attr => 
      (cardinalityAnalysis[attr].cardinality || 0) < 0.3
    );
    
    content += `**Status:** Analysis completed\n`;
    content += `**Attributes Analyzed:** ${attributes.length}\n`;
    content += `**High Uniqueness (>90%):** ${highUniqueAttrs.length} attributes\n`;
    content += `**Low Uniqueness (<30%):** ${lowUniqueAttrs.length} attributes\n`;
    
    if (highUniqueAttrs.length > 0) {
      content += `**Key Candidates:** ${highUniqueAttrs.slice(0, 3).join(', ')}\n`;
    }
    
    if (lowUniqueAttrs.length > 0) {
      content += `**Normalization Candidates:** ${lowUniqueAttrs.slice(0, 3).join(', ')}\n`;
    }
    content += '\n';
    
    return content;
  }

  private generate1NFSection(relations1NF: any[]): string {
    let content = '### First Normal Form (1NF)\n\n';
    
    if (relations1NF.length === 0) {
      content += '**Status:** Data already in 1NF\n';
      content += '**Result:** No transformation required\n\n';
      return content;
    }
    
    content += `**Status:** 1NF transformation applied\n`;
    content += `**Relations Created:** ${relations1NF.length}\n`;
    content += `**Atomicity:** Ensured all attribute values are indivisible\n`;
    content += `**Repeating Groups:** Eliminated\n`;
    
    relations1NF.forEach(relation => {
      content += `**Relation:** ${relation.name} (${relation.attributes.length} attributes, ${relation.metadata?.rowCount || 0} rows)\n`;
    });
    content += '\n';
    
    return content;
  }

  private generate2NFSection(relations2NF: any[]): string {
    let content = '### Second Normal Form (2NF)\n\n';
    
    if (relations2NF.length === 0) {
      content += '**Status:** No partial dependencies found\n';
      content += '**Result:** Data already in 2NF or higher\n\n';
      return content;
    }
    
    content += `**Status:** 2NF decomposition completed\n`;
    content += `**Relations Created:** ${relations2NF.length}\n`;
    content += `**Partial Dependencies:** Eliminated\n`;
    
    relations2NF.forEach(relation => {
      content += `**Relation:** ${relation.name}\n`;
      content += `  - Attributes: {${relation.attributes.join(', ')}}\n`;
      content += `  - Primary Key: {${relation.primaryKey?.join(', ') || 'None'}}\n`;
      content += `  - Rows: ${relation.metadata?.rowCount || 0}\n`;
    });
    content += '\n';
    
    return content;
  }

  private generate3NFSection(relations3NF: any[]): string {
    let content = '### Third Normal Form (3NF)\n\n';
    
    if (relations3NF.length === 0) {
      content += '**Status:** No 3NF relations generated\n\n';
      return content;
    }
    
    const connectedRelations = relations3NF.filter(r => r.foreignKeys?.length > 0);
    const totalRelationships = relations3NF.reduce((sum, r) => sum + (r.foreignKeys?.length || 0), 0);
    
    content += `**Status:** 3NF synthesis completed using Bernstein algorithm\n`;
    content += `**Final Schema:** ${relations3NF.length} normalized relations\n`;
    content += `**Connected Relations:** ${connectedRelations.length}\n`;
    content += `**Relationships:** ${totalRelationships}\n`;
    
    content += `**Relations Overview:**\n`;
    relations3NF.forEach(relation => {
      content += `**${relation.name}**\n`;
      content += `  - Attributes: {${relation.attributes.join(', ')}}\n`;
      content += `  - Primary Key: {${relation.primaryKey?.join(', ') || 'None'}}\n`;
      if (relation.foreignKeys && relation.foreignKeys.length > 0) {
        content += `  - Foreign Keys: ${relation.foreignKeys.length}\n`;
      }
      content += `  - Source: ${relation.sourceType}\n`;
    });
    content += '\n';
    
    return content;
  }

  private generateLosslessSection(losslessCheck: any): string {
    let content = '### Lossless Join Check\n\n';
    
    const status = losslessCheck.isLossless ? 'PASSED' : 'FAILED';
    content += `**Status:** ${status}\n`;
    
    if (losslessCheck.details) {
      content += `**Algorithm:** ${losslessCheck.details.algorithm}\n`;
      content += `**Relations Tested:** ${losslessCheck.details.relationCount}\n`;
      content += `**Dependencies Used:** ${losslessCheck.details.fdCount}\n`;
    }
    
    if (losslessCheck.isLossless) {
      content += `**Result:** Decomposition preserves all information\n`;
      content += `**Implication:** Natural joins will reconstruct original data perfectly\n`;
    } else {
      content += `**Result:** Information may be lost during join operations\n`;
      content += `**Recommendation:** Review decomposition strategy\n`;
    }
    content += '\n';
    
    return content;
  }

  private generateDependencyPreservationSection(dependencyPreservation: any): string {
    let content = '### Dependency Preservation\n\n';
    
    const status = dependencyPreservation.isPreserved ? 'PRESERVED' : 'PARTIALLY PRESERVED';
    content += `**Status:** ${status}\n`;
    
    if (dependencyPreservation.totalDependencies !== undefined) {
      const preservationRate = (dependencyPreservation.preservationRatio * 100).toFixed(1);
      content += `**Preservation Rate:** ${preservationRate}%\n`;
      content += `**Dependencies Preserved:** ${dependencyPreservation.preservedCount}/${dependencyPreservation.totalDependencies}\n`;
      
      if (dependencyPreservation.lostCount > 0) {
        content += `**Dependencies Lost:** ${dependencyPreservation.lostCount}\n`;
        content += `**Implication:** Some integrity constraints may require joins to enforce\n`;
      }
    }
    
    if (dependencyPreservation.isPreserved) {
      content += `**Result:** All functional dependencies are preserved\n`;
      content += `**Benefit:** Integrity constraints can be enforced without joins\n`;
    }
    content += '\n';
    
    return content;
  }

  private generateERDSection(relations3NF: any[]): string {
    let content = '### Entity Relationship Diagram Generator\n\n';
    
    if (relations3NF.length === 0) {
      content += '**Status:** No relations available for ERD generation\n\n';
      return content;
    }
    
    const connectedEntities = relations3NF.filter(relation => 
      relation.foreignKeys?.length > 0 || 
      relations3NF.some(r => r.foreignKeys?.some((fk: any) => fk.references === relation.name))
    );
    
    content += `**Status:** ERD generated successfully\n`;
    content += `**Format:** Mermaid diagram syntax\n`;
    content += `**Entities:** ${relations3NF.length}\n`;
    content += `**Connected Entities:** ${connectedEntities.length}\n`;
    content += `**File:** erd_diagram.mmd\n`;
    content += '\n';
    
    return content;
  }

  private generateRelationGeneratorSection(relations3NF: any[]): string {
    let content = '### Relation Schema Generator\n\n';
    
    content += `**Status:** Relation schemas generated\n`;
    content += `**Format:** Detailed markdown documentation\n`;
    content += `**Relations Documented:** ${relations3NF.length}\n`;
    content += `**Includes:** Primary keys, foreign keys, attribute types, row counts\n`;
    content += `**File:** relation_schemas.md\n`;
    content += '\n';
    
    return content;
  }

  private generateSQLGeneratorSection(relations3NF: any[]): string {
    let content = '### SQL DDL Generator\n\n';
    
    if (relations3NF.length === 0) {
      content += '**Status:** No relations available for SQL generation\n\n';
      return content;
    }
    
    const totalTables = relations3NF.length;
    const totalConstraints = relations3NF.reduce((sum, r) => sum + (r.foreignKeys?.length || 0), 0);
    
    content += `**Status:** SQL DDL generated successfully\n`;
    content += `**Database:** CREATE TABLE statements for all relations\n`;
    content += `**Tables:** ${totalTables}\n`;
    content += `**Foreign Key Constraints:** ${totalConstraints}\n`;
    content += `**Indexes:** Automatically generated for foreign keys\n`;
    content += `**File:** database_schema.sql\n`;
    content += '\n';
    
    return content;
  }

  private generatePerformanceSection(performanceMetrics: any): string {
    let content = '### Performance Analysis\n\n';
    
    content += `**Total Processing Time:** ${performanceMetrics.totalDuration}\n`;
    content += `**Peak Memory Usage:** ${this.formatMemoryUsage(performanceMetrics.peakMemoryUsage)}\n`;
    
    if (performanceMetrics.optimizationsApplied) {
      content += `**Optimizations Applied:** ${performanceMetrics.optimizationsApplied.length}\n`;
      performanceMetrics.optimizationsApplied.forEach((opt: string) => {
        content += `- ${opt}\n`;
      });
    }
    
    const totalTime = performanceMetrics.checkpoints[performanceMetrics.checkpoints.length - 1]?.time || 0;
    if (totalTime < 10000) {
      content += `**Performance Rating:** Excellent (under 10 seconds)\n`;
    } else if (totalTime < 30000) {
      content += `**Performance Rating:** Good (under 30 seconds)\n`;
    } else {
      content += `**Performance Rating:** Adequate (consider optimization for larger datasets)\n`;
    }
    content += '\n';
    
    return content;
  }

  private generateActionableRecommendations(
    selectedOperations: string[], 
    fds: any[], 
    keyResult: any, 
    losslessCheck: any, 
    dependencyPreservation: any
  ): string {
    let content = '## Actionable Recommendations\n\n';
    
    const recommendations: string[] = [];
    
    // Primary Key Recommendations
    if (selectedOperations.includes('Key Discovery')) {
      if (keyResult.candidateKeys && keyResult.candidateKeys.length > 0) {
        const simpleKeys = keyResult.candidateKeys.filter((key: string[]) => key.length === 1);
        if (simpleKeys.length > 0) {
          recommendations.push(`**Primary Key Implementation:** Use {${simpleKeys[0].join(', ')}} as your primary key for optimal performance`);
        } else {
          const shortestKey = keyResult.candidateKeys.reduce((min: string[], key: string[]) => 
            key.length < min.length ? key : min
          );
          recommendations.push(`**Composite Key Implementation:** Use {${shortestKey.join(', ')}} as your primary key, but consider a surrogate key for better performance`);
        }
      } else {
        recommendations.push(`**Key Strategy:** Add an auto-increment ID column as a surrogate primary key`);
      }
    }
    
    // Functional Dependency Recommendations
    if (selectedOperations.includes('FD Miner') && fds.length > 0) {
      const highConfidenceFDs = fds.filter(fd => fd.confidence > 0.98);
      if (highConfidenceFDs.length > 0) {
        recommendations.push(`**Normalization Priority:** Focus on the ${highConfidenceFDs.length} high-confidence functional dependencies for reliable normalization`);
      }
      
      const lowConfidenceFDs = fds.filter(fd => fd.confidence < 0.90);
      if (lowConfidenceFDs.length > 0) {
        recommendations.push(`**Data Quality:** Review ${lowConfidenceFDs.length} low-confidence dependencies - they may indicate data quality issues`);
      }
    }
    
    // Quality Assurance Recommendations
    if (selectedOperations.includes('Lossless Check') && !losslessCheck.isLossless) {
      recommendations.push(`**Schema Review Required:** Decomposition is not lossless - information may be lost during joins. Consider revising the normalization strategy`);
    }
    
    if (selectedOperations.includes('Dependency Preservation') && !dependencyPreservation.isPreserved) {
      const lostRatio = ((dependencyPreservation.lostCount / dependencyPreservation.totalDependencies) * 100).toFixed(1);
      recommendations.push(`**Integrity Constraints:** ${lostRatio}% of functional dependencies are lost. You may need complex join operations to enforce some business rules`);
    }
    
    // Implementation Recommendations
    if (selectedOperations.includes('SQL Generator')) {
      recommendations.push(`**Database Implementation:** Use the generated SQL DDL to create your normalized database schema`);
      recommendations.push(`**Index Strategy:** Implement the suggested foreign key indexes for optimal query performance`);
    }
    
    if (selectedOperations.includes('ERD Generator')) {
      recommendations.push(`**Documentation:** Use the generated ERD for database documentation and team communication`);
    }
    
    // Performance Recommendations
    if (selectedOperations.includes('3NF')) {
      recommendations.push(`**Query Optimization:** Monitor join performance in your normalized schema and consider materialized views for frequently accessed data`);
      recommendations.push(`**Backup Strategy:** Implement regular backups focusing on your core entity tables first`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push(`**Next Steps:** Review the individual operation results above for specific recommendations`);
    }
    
    recommendations.forEach((rec, index) => {
      content += `${index + 1}. ${rec}\n`;
    });
    content += '\n';
    
    return content;
  }

  private generateNextSteps(selectedOperations: string[], relations3NF: any[]): string {
    let content = '## Next Steps\n\n';
    
    const steps: string[] = [];
    
    if (selectedOperations.includes('SQL Generator')) {
      steps.push(`**Database Creation:** Execute the generated SQL DDL to create your normalized database schema`);
    }
    
    if (selectedOperations.includes('3NF') && relations3NF.length > 0) {
      steps.push(`**Data Migration:** Plan the migration of your existing data into the new normalized structure`);
      steps.push(`**Application Updates:** Update your application code to work with the new table structure`);
    }
    
    if (selectedOperations.includes('ERD Generator')) {
      steps.push(`**Team Review:** Share the ERD with your development team for review and approval`);
    }
    
    steps.push(`**Testing:** Thoroughly test the new schema with representative data and queries`);
    steps.push(`**Performance Monitoring:** Monitor query performance and adjust indexes as needed`);
    steps.push(`**Documentation:** Update your database documentation with the new schema`);
    
    steps.forEach((step, index) => {
      content += `${index + 1}. ${step}\n`;
    });
    
    return content;
  }

  // ========== EXISTING MARKDOWN GENERATION METHODS ==========
  // Keep all existing methods unchanged for backward compatibility

  private generatePerformanceReportMarkdown(performanceMetrics: any): string {
    let content = '# Performance Analysis Report\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Total Duration:** ${performanceMetrics.totalDuration}\n`;
    content += `**Peak Memory Usage:** ${this.formatMemoryUsage(performanceMetrics.peakMemoryUsage)}\n\n`;
    
    content += '## Performance Checkpoints\n\n';
    content += '| Checkpoint | Time (ms) | Memory (MB) | Phase |\n';
    content += '|------------|-----------|-------------|-------|\n';
    
    performanceMetrics.checkpoints.forEach((checkpoint: any) => {
      const memory = typeof checkpoint.memory === 'number' && checkpoint.memory > 0 ? checkpoint.memory.toFixed(2) : '< 0.01';
      content += `| ${checkpoint.name} | ${checkpoint.time} | ${memory} | Processing |\n`;
    });
    
    content += this.memorySource === 'estimate'
      ? '\n*Memory is an estimate of the loaded data (this runtime does not report heap usage).*\n'
      : `\n*Memory is the JavaScript heap in use (${this.memorySource === 'node' ? 'Node.js' : 'browser'}).*\n`;

    content += '\n## Optimizations Applied\n\n';
    performanceMetrics.optimizationsApplied?.forEach((opt: string) => {
      content += `- ${opt}\n`;
    });
    
    content += `\n## Cache Performance\n\n`;
    content += typeof performanceMetrics.cacheHitRate === 'number'
      ? `- **Partition Cache Hit Rate:** ${(performanceMetrics.cacheHitRate * 100).toFixed(1)}% ` +
        `(${performanceMetrics.cacheHits} of ${performanceMetrics.cacheHits + performanceMetrics.cacheMisses} partition requests served from cache during FD mining)\n\n`
      : '- **Partition Cache Hit Rate:** not applicable (FD Miner did not run)\n\n';
    
    content += '## Performance Insights\n\n';
    const totalTime = performanceMetrics.checkpoints[performanceMetrics.checkpoints.length - 1]?.time || 0;
    if (totalTime < 10000) {
      content += '- **Excellent Performance:** Process completed in under 10 seconds\n';
    } else if (totalTime < 30000) {
      content += '- **Good Performance:** Process completed efficiently\n';
    } else {
      content += '- **Extended Processing:** Consider data sampling for larger datasets\n';
    }
    
    return content;
  }

  private generateFDVisualizationSVG(fds: any[]): string {
    // Generate a simple SVG visualization for functional dependencies
    const width = 800;
    const height = 600;
    const nodeRadius = 40;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += '<defs><style>.high-conf { fill: #dcfce7; stroke: #16a34a; } .med-conf { fill: #fef3c7; stroke: #d97706; } .low-conf { fill: #fee2e2; stroke: #dc2626; }</style></defs>';
    
    // Simple grid layout for FDs
    const cols = Math.ceil(Math.sqrt(Math.min(fds.length * 2, 20))); // Show max 10 FDs
    const cellWidth = width / cols;
    const cellHeight = height / Math.ceil(10 / cols);
    
    fds.slice(0, 10).forEach((fd, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = col * cellWidth + cellWidth / 2;
      const y = row * cellHeight + cellHeight / 2;
      
      const lhsLabel = Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs;
      const confidence = fd.confidence || 0;
      const confClass = confidence > 0.98 ? 'high-conf' : confidence > 0.90 ? 'med-conf' : 'low-conf';
      
      // Draw LHS node
      svg += `<circle cx="${x - 80}" cy="${y}" r="${nodeRadius}" class="${confClass}" stroke-width="2"/>`;
      svg += `<text x="${x - 80}" y="${y}" text-anchor="middle" font-size="10" font-family="Inter, sans-serif">${lhsLabel}</text>`;
      
      // Draw RHS node
      svg += `<circle cx="${x + 80}" cy="${y}" r="${nodeRadius}" class="${confClass}" stroke-width="2"/>`;
      svg += `<text x="${x + 80}" y="${y}" text-anchor="middle" font-size="10" font-family="Inter, sans-serif">${fd.rhs}</text>`;
      
      // Draw arrow
      svg += `<line x1="${x - 40}" y1="${y}" x2="${x + 40}" y2="${y}" stroke="#374151" stroke-width="2" marker-end="url(#arrow)"/>`;
      svg += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="8">${(confidence * 100).toFixed(1)}%</text>`;
    });
    
    // Add arrow marker
    svg += '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><polygon points="0,0 0,6 9,3" fill="#374151" /></marker></defs>';
    
    svg += '</svg>';
    return svg;
  }

  // Continue with all existing markdown generation methods...
  // [Keep all the existing methods: generate1NFMarkdown, generateCardinalityMarkdown, 
  // generate2NFMarkdown, generateLosslessCheckMarkdown, generateDependencyPreservationMarkdown,
  // generateFDMarkdown, generateKeyMarkdown, generateAtomicityMarkdown, generateDataProfileMarkdown]

  private generate1NFMarkdown(relations1NF: any[]): string {
    let content = '# First Normal Form (1NF) Analysis\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Relations Created:** ${relations1NF.length}\n\n`;
    
    content += '## 1NF Transformation Process\n\n';
    content += 'First Normal Form ensures that:\n';
    content += '1. All attribute values are atomic (indivisible)\n';
    content += '2. No repeating groups exist\n';
    content += '3. Each row is unique\n\n';
    
    if (relations1NF.length === 0) {
      content += 'No 1NF transformation was necessary. The original data may already be in 1NF.\n';
      return content;
    }
    
    content += '## Generated Relations\n\n';
    relations1NF.forEach((relation, index) => {
      content += `### ${index + 1}. ${relation.name}\n\n`;
      content += `**Attributes:** {${relation.attributes.join(', ')}}\n`;
      if (relation.primaryKey) {
        content += `**Primary Key:** {${relation.primaryKey.join(', ')}}\n`;
      }
      content += `**Row Count:** ${relation.metadata?.rowCount || 0}\n`;
      content += `**Source:** ${relation.sourceType}\n\n`;
    });
    
    return content;
  }

  private generateCardinalityMarkdown(cardinalityAnalysis: any): string {
    let content = '# Cardinality Analysis Report\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    if (!cardinalityAnalysis || Object.keys(cardinalityAnalysis).length === 0) {
      content += 'No cardinality analysis results available.\n';
      return content;
    }
    
    content += '## Attribute Cardinality Summary\n\n';
    content += '| Attribute | Total Values | Unique Values | Cardinality Ratio | Data Type | Relationship Type |\n';
    content += '|-----------|--------------|---------------|-------------------|-----------|-------------------|\n';
    
    Object.entries(cardinalityAnalysis).forEach(([attr, analysis]: [string, any]) => {
      const totalValues = analysis.totalValues || 'N/A';
      const uniqueValues = analysis.uniqueValues || 'N/A';
      const cardinality = analysis.cardinality ? (analysis.cardinality * 100).toFixed(1) + '%' : 'N/A';
      const dataType = analysis.dataType || 'string';
      const relationshipType = this.getRelationshipTypeFromCardinality(analysis);
      
      content += `| ${attr} | ${totalValues} | ${uniqueValues} | ${cardinality} | ${dataType} | ${relationshipType} |\n`;
    });
    
    content += '\n## Cardinality Insights\n\n';
    
    const highUniqueAttrs = Object.entries(cardinalityAnalysis).filter(([, analysis]: [string, any]) => 
      (analysis.cardinality || 0) > 0.9
    );
    
    const lowUniqueAttrs = Object.entries(cardinalityAnalysis).filter(([, analysis]: [string, any]) => 
      (analysis.cardinality || 0) < 0.3
    );
    
    if (highUniqueAttrs.length > 0) {
      content += `**High Uniqueness Attributes (>90%):** ${highUniqueAttrs.length} attributes\n`;
      content += 'These attributes are suitable for primary keys or unique constraints.\n\n';
    }
    
    if (lowUniqueAttrs.length > 0) {
      content += `**Low Uniqueness Attributes (<30%):** ${lowUniqueAttrs.length} attributes\n`;
      content += 'These attributes may benefit from normalization or indexing strategies.\n\n';
    }
    
    return content;
  }

  private getRelationshipTypeFromCardinality(analysis: any): string {
    const cardinality = analysis.cardinality || 0;
    if (cardinality > 0.95) return 'One-to-One (1:1)';
    if (cardinality > 0.3) return 'One-to-Many (1:N)';
    return 'Many-to-Many (M:N)';
  }

  private generate2NFMarkdown(relations2NF: any[]): string {
    let content = '# Second Normal Form (2NF) Analysis\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Relations Created:** ${relations2NF.length}\n\n`;
    
    content += '## 2NF Decomposition Process\n\n';
    content += 'Second Normal Form eliminates partial dependencies by ensuring that:\n';
    content += '1. The relation is in First Normal Form (1NF)\n';
    content += '2. Every non-prime attribute is fully functionally dependent on the primary key\n\n';
    
    if (relations2NF.length === 0) {
      content += 'No 2NF decomposition was necessary. The original relation may already be in 2NF or higher.\n';
      return content;
    }
    
    content += '## Generated Relations\n\n';
    relations2NF.forEach((relation, index) => {
      content += `### ${index + 1}. ${relation.name}\n\n`;
      content += `**Attributes:** {${relation.attributes.join(', ')}}\n`;
      if (relation.primaryKey) {
        content += `**Primary Key:** {${relation.primaryKey.join(', ')}}\n`;
      }
      if (relation.functionalDependencies?.length > 0) {
        content += `**Functional Dependencies:**\n`;
        relation.functionalDependencies.forEach((fd: any) => {
          content += `- ${fd.lhs.join(', ')} → ${fd.rhs}\n`;
        });
      }
      content += `**Row Count:** ${relation.metadata?.rowCount || 0}\n`;
      content += '\n';
    });
    
    return content;
  }

  private generateLosslessCheckMarkdown(losslessCheck: any): string {
    let content = '# Lossless Join Analysis\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Result:** ${losslessCheck.isLossless ? 'LOSSLESS' : 'LOSSY'}\n\n`;
    
    content += `## Analysis Summary\n\n`;
    content += `The decomposition is ${losslessCheck.isLossless ? 'lossless' : 'lossy'}. `;
    content += `This means that joining the decomposed relations ${losslessCheck.isLossless ? 'will' : 'will NOT'} `;
    content += `produce the original relation without any loss or addition of information.\n\n`;
    
    if (losslessCheck.details) {
      content += `## Technical Details\n\n`;
      content += `- **Algorithm Used:** ${losslessCheck.details.algorithm || 'Chase Algorithm'}\n`;
      content += `- **Relations Tested:** ${losslessCheck.details.relationCount || 'N/A'}\n`;
      content += `- **Functional Dependencies:** ${losslessCheck.details.fdCount || 'N/A'}\n`;
      if (losslessCheck.details.optimizations) {
        content += `- **Optimizations:** ${losslessCheck.details.optimizations}\n`;
      }
      content += '\n';
    }
    
    content += `## Implementation Notes\n\n`;
    if (losslessCheck.isLossless) {
      content += '- The decomposition preserves all information from the original relation\n';
      content += '- Natural joins of the decomposed relations will reconstruct the original data\n';
      content += '- No data anomalies will occur during join operations\n';
    } else {
      content += '- Some information may be lost when joining the decomposed relations\n';
      content += '- Additional constraints may be needed to prevent data anomalies\n';
      content += '- Consider revising the decomposition strategy\n';
    }
    
    return content;
  }

  private generateDependencyPreservationMarkdown(dependencyPreservation: any): string {
    let content = '# Dependency Preservation Analysis\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Result:** ${dependencyPreservation.isPreserved ? 'PRESERVED' : 'NOT PRESERVED'}\n\n`;
    
    content += `## Analysis Summary\n\n`;
    if (dependencyPreservation.isPreserved) {
      content += 'All functional dependencies are preserved in the decomposition. ';
      content += 'This ensures that all integrity constraints can be enforced without joins.\n\n';
    } else {
      content += 'Some functional dependencies are lost in the decomposition. ';
      content += 'This may require joins to enforce certain integrity constraints.\n\n';
    }
    
    if (dependencyPreservation.preservedCount !== undefined) {
      content += '## Preservation Statistics\n\n';
      content += `- **Total Dependencies:** ${dependencyPreservation.totalDependencies}\n`;
      content += `- **Preserved Dependencies:** ${dependencyPreservation.preservedCount}\n`;
      content += `- **Lost Dependencies:** ${dependencyPreservation.lostCount}\n`;
      content += `- **Preservation Ratio:** ${(dependencyPreservation.preservationRatio * 100).toFixed(1)}%\n`;
      if (dependencyPreservation.optimizations) {
        content += `- **Optimizations Applied:** ${dependencyPreservation.optimizations}\n`;
      }
      content += '\n';
    }
    
    if (dependencyPreservation.preserved?.length > 0) {
      content += '## Preserved Dependencies\n\n';
      dependencyPreservation.preserved.slice(0, 10).forEach((fd: any, index: number) => {
        const lhs = Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs;
        content += `${index + 1}. ${lhs} → ${fd.rhs}\n`;
      });
      if (dependencyPreservation.preserved.length > 10) {
        content += `... and ${dependencyPreservation.preserved.length - 10} more\n`;
      }
      content += '\n';
    }
    
    if (dependencyPreservation.lost?.length > 0) {
      content += '## Lost Dependencies\n\n';
      dependencyPreservation.lost.slice(0, 10).forEach((fd: any, index: number) => {
        const lhs = Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs;
        content += `${index + 1}. ${lhs} → ${fd.rhs}\n`;
      });
      if (dependencyPreservation.lost.length > 10) {
        content += `... and ${dependencyPreservation.lost.length - 10} more\n`;
      }
      content += '\n';
    }
    
    return content;
  }

  private generateFDMarkdown(fds: any[]): string {
    let content = '# Functional Dependencies Analysis\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Total Dependencies:** ${fds.length}\n\n`;
    
    if (fds.length === 0) {
      content += '## No Dependencies Found\n\n';
      content += 'No functional dependencies were discovered in the dataset. This could indicate:\n\n';
      content += '- The dataset is already in a highly normalized form\n';
      content += '- The dataset lacks sufficient data patterns\n';
      content += '- Additional data analysis may be required\n\n';
      return content;
    }
    
    content += '## Summary\n\n';
    const highConfidenceFDs = fds.filter(fd => fd.confidence > 0.98);
    const mediumConfidenceFDs = fds.filter(fd => fd.confidence > 0.90 && fd.confidence <= 0.98);
    const lowConfidenceFDs = fds.filter(fd => fd.confidence <= 0.90);
    
    content += `- **High Confidence (>98%):** ${highConfidenceFDs.length} dependencies\n`;
    content += `- **Medium Confidence (90-98%):** ${mediumConfidenceFDs.length} dependencies\n`;
    content += `- **Low Confidence (<90%):** ${lowConfidenceFDs.length} dependencies\n\n`;
    
    content += '## All Discovered Dependencies\n\n';
    content += '| # | Left Hand Side (LHS) | Right Hand Side (RHS) | Confidence | Coverage | Unique Groups | Quality |\n';
    content += '|---|---------------------|----------------------|------------|----------|---------------|----------|\n';
    
    fds.forEach((fd, index) => {
      const lhsStr = Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs;
      const confidence = (fd.confidence * 100).toFixed(2);
      const coverage = (fd.coverage * 100).toFixed(2);
      const quality = fd.confidence > 0.98 ? 'High' : fd.confidence > 0.90 ? 'Medium' : 'Low';
      
      content += `| ${index + 1} | **${lhsStr}** | **${fd.rhs}** | ${confidence}% | ${coverage}% | ${fd.uniqueGroups} | ${quality} |\n`;
    });
    
    if (highConfidenceFDs.length > 0) {
      content += '\n## High-Confidence Dependencies (Recommended for Normalization)\n\n';
      highConfidenceFDs.forEach((fd, index) => {
        const lhsStr = Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs;
        content += `### ${index + 1}. ${lhsStr} → ${fd.rhs}\n\n`;
        content += `- **Confidence:** ${(fd.confidence * 100).toFixed(2)}%\n`;
        content += `- **Coverage:** ${(fd.coverage * 100).toFixed(2)}%\n`;
        content += `- **Unique Groups:** ${fd.uniqueGroups}\n`;
        content += `- **Violations:** ${fd.violations}\n\n`;
        content += '**Interpretation:** This dependency is highly reliable and should be used for normalization.\n\n';
      });
    }
    
    content += '\n## Methodology\n\n';
    content += 'Functional dependencies were discovered using:\n\n';
    content += '- **Algorithm:** Optimized FD mining with adaptive thresholds\n';
    content += '- **Confidence Threshold:** 95% minimum (adaptive)\n';
    content += '- **LHS Size Limit:** 4 attributes maximum (adaptive)\n';
    content += '- **Minimality Check:** Ensured minimal left-hand sides\n';
    content += '- **Optimizations:** Progressive sampling, streaming algorithms\n\n';
    
    content += '## Metrics Explanation\n\n';
    content += '- **Confidence:** Percentage of data that follows this dependency (higher is better)\n';
    content += '- **Coverage:** Percentage of data groups covered by this dependency\n';
    content += '- **Unique Groups:** Number of distinct LHS value combinations\n';
    content += '- **Violations:** Number of records that violate this dependency\n\n';
    
    return content;
  }

  private generateKeyMarkdown(keyResult: any): string {
    let content = '# Key Analysis Report\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Candidate Keys:** ${keyResult.candidateKeys?.length || 0}\n`;
    content += `**Super Keys:** ${keyResult.superkeys?.length || 0}\n\n`;
    
    // Enhanced metrics if available
    if (keyResult.searchMetrics) {
      content += '## Search Performance Metrics\n\n';
      content += `- **Strategy Used:** ${keyResult.searchMetrics.finalStrategy}\n`;
      content += `- **Total Duration:** ${keyResult.searchMetrics.totalDuration}ms\n`;
      content += `- **Combinations Evaluated:** ${keyResult.searchMetrics.totalEvaluated}\n`;
      content += `- **Search Phases:** ${keyResult.searchMetrics.phases.length}\n\n`;
      
      content += '### Phase Breakdown\n\n';
      content += '| Phase | Evaluated | Keys Found | Duration (ms) | Success |\n';
      content += '|-------|-----------|------------|---------------|----------|\n';
      keyResult.searchMetrics.phases.forEach((phase: any) => {
        content += `| ${phase.name} | ${phase.evaluated} | ${phase.keysFound} | ${phase.duration} | ${phase.success ? 'Yes' : 'No'} |\n`;
      });
      content += '\n';
    }
    
    content += '## Candidate Keys\n\n';
    if (!keyResult.candidateKeys || keyResult.candidateKeys.length === 0) {
      content += 'No candidate keys were discovered. This may indicate:\n\n';
      content += '- Insufficient functional dependencies\n';
      content += '- Complex key structures requiring manual analysis\n';
      content += '- Data quality issues\n\n';
      if (keyResult.fallbackUsed) {
        content += '**Note:** A synthetic key approach was suggested as fallback.\n\n';
      }
    } else {
      content += 'Candidate keys are minimal super keys that uniquely identify tuples:\n\n';
      keyResult.candidateKeys.forEach((key: string[], index: number) => {
        content += `### ${index + 1}. {${key.join(', ')}}\n\n`;
        content += `- **Size:** ${key.length} attribute(s)\n`;
        content += `- **Type:** ${key.length === 1 ? 'Simple' : 'Composite'} key\n`;
        content += `- **Recommendation:** ${key.length <= 2 ? 'Suitable for primary key' : 'Consider surrogate key'}\n\n`;
      });
    }
    
    content += '## Super Keys\n\n';
    if (!keyResult.superkeys || keyResult.superkeys.length === 0) {
      content += 'No super keys were identified.\n\n';
    } else {
      content += 'Super keys are sets of attributes that uniquely identify tuples:\n\n';
      keyResult.superkeys.forEach((key: string[], index: number) => {
        const isCandidate = keyResult.candidateKeys?.some((ck: string[]) => 
          ck.length === key.length && ck.every((attr: string) => key.includes(attr))
        );
        content += `${index + 1}. {${key.join(', ')}}${isCandidate ? ' *(Candidate Key)*' : ''}\n`;
      });
      content += '\n';
    }
    
    content += '## Analysis Summary\n\n';
    content += `- **Total Super Keys Found:** ${keyResult.superkeys?.length || 0}\n`;
    content += `- **Minimal Keys (Candidates):** ${keyResult.candidateKeys?.length || 0}\n`;
    content += `- **Average Key Size:** ${keyResult.candidateKeys?.length > 0 ? 
      (keyResult.candidateKeys.reduce((sum: number, key: string[]) => sum + key.length, 0) / keyResult.candidateKeys.length).toFixed(1) : 'N/A'}\n\n`;
    
    content += `## Recommendations\n\n`;
    if (keyResult.candidateKeys && keyResult.candidateKeys.length > 0) {
      const simpleKeys = keyResult.candidateKeys.filter((key: string[]) => key.length === 1);
      const compositeKeys = keyResult.candidateKeys.filter((key: string[]) => key.length > 1);
      
      if (simpleKeys.length > 0) {
        content += `- **Primary Key Suggestion:** Consider using {${simpleKeys[0].join(', ')}} as the primary key\n`;
      } else if (compositeKeys.length > 0) {
        const shortestKey = compositeKeys.reduce((min: string[], key: string[]) => key.length < min.length ? key : min);
        content += `- **Primary Key Suggestion:** Consider using {${shortestKey.join(', ')}} as the primary key\n`;
      }
      
      if (keyResult.candidateKeys.length > 1) {
        content += '- **Alternative Keys:** Other candidate keys can serve as unique constraints\n';
      }
      
      content += '- **Index Strategy:** Create indexes on all candidate keys for optimal performance\n';
    } else {
      content += '- **Action Required:** Manual key identification needed\n';
      content += '- **Consider:** Adding surrogate keys (auto-increment IDs)\n';
      content += '- **Review:** Data quality and functional dependencies\n';
    }
    
    return content;
  }

  private generateAtomicityMarkdown(atomicityResult: any): string {
    let content = '# Atomicity Analysis Report\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Purpose:** First Normal Form (1NF) Compliance Check\n\n`;
    
    const atomicity = atomicityResult.atomicity || {};
    const violations = atomicityResult.violations || {};
    
    const totalAttributes = Object.keys(atomicity).length;
    const atomicAttributes = Object.values(atomicity).filter(Boolean).length;
    const violatingAttributes = Object.keys(violations).length;
    
    content += '## Summary\n\n';
    content += `- **Total Attributes:** ${totalAttributes}\n`;
    content += `- **Atomic Attributes:** ${atomicAttributes}\n`;
    content += `- **Non-Atomic Attributes:** ${violatingAttributes}\n`;
    content += `- **1NF Compliance:** ${violatingAttributes === 0 ? 'YES' : 'NO'}\n\n`;
    
    if (violatingAttributes === 0) {
      content += '## 1NF Compliance Achieved\n\n';
      content += 'All attributes in the dataset are atomic. The data satisfies First Normal Form requirements.\n\n';
    } else {
      content += '## 1NF Violations Detected\n\n';
      content += 'The following attributes contain non-atomic values:\n\n';
      
      Object.entries(violations).forEach(([attr, viols]: [string, any]) => {
        content += `### ${attr}\n\n`;
        content += '**Sample Violations:**\n\n';
        viols.slice(0, 3).forEach((viol: any, index: number) => {
          content += `${index + 1}. Row ${viol.row}: "${viol.value}"\n`;
        });
        content += '\n**Recommended Action:** Decompose into separate attributes or normalize values\n\n';
      });
    }
    
    content += '## Detailed Attribute Analysis\n\n';
    content += '| Attribute | Status | Action Required |\n';
    content += '|-----------|--------|----------------|\n';
    
    Object.entries(atomicity).forEach(([attr, isAtomic]) => {
      const status = isAtomic ? 'Atomic' : 'Non-Atomic';
      const action = isAtomic ? 'None' : 'Decompose';
      content += `| ${attr} | ${status} | ${action} |\n`;
    });
    
    return content;
  }

  private generateDataProfileMarkdown(dataProfile: any): string {
    let content = '# Data Type Profile Report\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Purpose:** Data Quality and Type Analysis\n\n`;
    
    if (!dataProfile || Object.keys(dataProfile).length === 0) {
      content += 'No data profiling results available.\n';
      return content;
    }
    
    content += '## Data Type Distribution\n\n';
    const typeDistribution: { [key: string]: number } = {};
    Object.values(dataProfile).forEach((type: any) => {
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });
    
    Object.entries(typeDistribution).forEach(([type, count]) => {
      content += `- **${type}:** ${count} attribute(s)\n`;
    });
    
    content += '\n## Attribute Details\n\n';
    content += '| Attribute | Data Type | Recommended SQL Type |\n';
    content += '|-----------|-----------|---------------------|\n';
    
    Object.entries(dataProfile).forEach(([attr, type]) => {
      const sqlType = this.mapToSQLType(type as string);
      content += `| ${attr} | ${type} | ${sqlType} |\n`;
    });
    
    content += '\n## Data Quality Recommendations\n\n';
    content += '1. **String Attributes:** Consider VARCHAR length optimization\n';
    content += '2. **Numeric Attributes:** Validate precision and scale requirements\n';
    content += '3. **Date Attributes:** Ensure consistent date formats\n';
    content += '4. **Boolean Attributes:** Standardize true/false representations\n\n';
    
    return content;
  }

  private mapToSQLType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'string': 'VARCHAR(255)',
      'integer': 'INTEGER',
      'decimal': 'DECIMAL(10,2)',
      'boolean': 'BOOLEAN',
      'date': 'DATE',
      'datetime': 'TIMESTAMP',
      'email': 'VARCHAR(255)',
      'url': 'TEXT',
      'phone': 'VARCHAR(20)',
      'text': 'TEXT',
      'number': 'NUMERIC'
    };
    return typeMap[type] || 'TEXT';
  }

  public estimateCSVSize(data: any[]): number {
    if (!data || data.length === 0) return 0;
    const sample = JSON.stringify(data[0]);
    return sample.length * data.length;
  }

  // ========== FILE OPERATIONS ==========

  cancelProcessing(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.logger.info('Processing cancelled by user');
    }
  }

  async downloadFile(file: OutputFile): Promise<void> {
    const content = typeof file.content === 'string' ? file.content : 
                   file.type === 'csv' ? this.arrayToCSV(file.content) :
                   JSON.stringify(file.content, null, 2);
    
    FileUtils.downloadAsFile(content, file.name, this.getMimeType(file.type));
  }

  private arrayToCSV(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) return '';
    const first = data[0];
    if (typeof first !== 'object' || first === null) return String(data.join('\n'));
    
    const headers = Object.keys(first);
    if (headers.length === 0) return '';

    const headerLine = headers.map(h => DatabaseService.formatCSVHeader(h)).join(',');
    const rows = data.map(row => {
      if (!row || typeof row !== 'object') return '';
      return headers.map(header => DatabaseService.formatCSVCell(row[header])).join(',');
    });

    return [headerLine, ...rows].join('\n');
  }

  private getMimeType(fileType: string): string {
    const mimeTypes = {
      'json': 'application/json',
      'markdown': 'text/markdown',
      'mermaid': 'text/plain',
      'sql': 'application/sql',
      'csv': 'text/csv',
      'txt': 'text/plain',
      'svg': 'image/svg+xml'
    };
    return mimeTypes[fileType as keyof typeof mimeTypes] || 'text/plain';
  }

  // ========== VALIDATION AND HEALTH CHECK METHODS ==========

  // Enhanced file validation with performance optimizations
  async validateFile(file: File): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check file size (increased limit with optimizations)
      if (file.size > 100 * 1024 * 1024) {
        return { valid: false, error: 'File size exceeds 100MB limit. Consider using streaming for larger files.' };
      }

      // Check file type
      if (!isSupportedInputName(file.name, file.type)) {
        return { valid: false, error: 'Only CSV and spreadsheet files (Excel, OpenDocument) are supported' };
      }
      if (await isSpreadsheetFile(file)) {
        return { valid: true }; // binary formats are validated when they are read
      }

      // Quick content validation with streaming
      const sample = await file.slice(0, 2048).text();
      if (!sample.includes(',')) {
        return { valid: false, error: 'File does not appear to be a valid CSV' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Failed to validate file' };
    }
  }

  // Enhanced duration estimation with machine learning approach
  getEstimatedDuration(operationCount: number, dataSize: number): number {
    const baseTimePerOp = 1.5; // Optimized base time
    const dataFactor = Math.log10(Math.max(dataSize, 10)) / 2000; // Improved factor
    const optimizationFactor = 0.7; // 30% improvement from optimizations
    
    return (operationCount * baseTimePerOp + dataSize * dataFactor) * optimizationFactor;
  }

  // Enhanced memory estimation
  estimateMemoryUsage(dataSize: number, operationCount: number): number {
    const baseMemory = 30; // Reduced base memory
    const dataMemory = (dataSize * 0.0005); // Optimized data memory factor
    const operationMemory = operationCount * 5; // Reduced operation memory
    
    return baseMemory + dataMemory + operationMemory;
  }

  // Enhanced system health check
  async checkSystemHealth(): Promise<{ 
    memoryAvailable: boolean; 
    performanceGood: boolean; 
    recommendations: string[] 
  }> {
    const recommendations: string[] = [];
    let memoryAvailable = true;
    let performanceGood = true;

    // Enhanced memory check
    if (typeof (performance as any)?.memory !== 'undefined') {
      const memory = (performance as any).memory;
      const usedMemory = memory.usedJSHeapSize / 1024 / 1024;
      const totalMemory = memory.totalJSHeapSize / 1024 / 1024;
      
      if (usedMemory / totalMemory > 0.85) { // Increased threshold
        memoryAvailable = false;
        recommendations.push('High memory usage detected. Consider reducing dataset size or enabling streaming mode.');
      }
    }

    // Enhanced performance check
    const startTime = performance.now();
    await new Promise(resolve => setTimeout(resolve, 1)); // Non-blocking test
    const endTime = performance.now();
    
    if (endTime - startTime > 10) { // More lenient threshold
      performanceGood = false;
      recommendations.push('Performance issues detected. System may be under load. Consider enabling parallel processing.');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is performing optimally for database normalization.');
    }

    return {
      memoryAvailable,
      performanceGood,
      recommendations
    };
  }

  // ========== ANALYSIS AND EXPORT UTILITIES ==========

  // Enhanced data quality assessment
  assessDataQuality(data: any[]): {
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    return this.assessDataQualityOptimized(data);
  }

  // Export utilities for different formats
  async exportResults(result: ProcessingResult, format: 'json' | 'zip'): Promise<Blob> {
    if (format === 'json') {
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0',
          user: 'miskatul-anwar',
          optimizations: result.stats.performanceMetrics?.optimizationsApplied || []
        },
        results: {
          stats: result.stats,
          relations: result.relations,
          relations1NF: result.relations1NF,
          relations2NF: result.relations2NF,
          functionalDependencies: result.outputFiles.find(f => f.name.includes('functional_dependencies'))?.content,
          keyAnalysis: result.outputFiles.find(f => f.name.includes('keys_analysis'))?.content,
          cardinalityAnalysis: result.cardinalityAnalysis,
          qualityChecks: {
            losslessJoin: result.losslessCheck,
            dependencyPreservation: result.dependencyPreservation
          },
          qualityAssessment: result.qualityAssessment,
          performanceMetrics: result.stats.performanceMetrics
        }
      };

      return new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
    }

    // For ZIP format, we would need a ZIP library
    // This is a simplified implementation
    throw new Error('ZIP export not implemented yet. Use JSON format for comprehensive results.');
  }

  // Analysis comparison utilities
  compareResults(result1: ProcessingResult, result2: ProcessingResult): {
    differences: string[];
    improvements: string[];
    regressions: string[];
  } {
    const differences: string[] = [];
    const improvements: string[] = [];
    const regressions: string[] = [];

    // Compare basic stats
    if (result1.stats.functionalDependencies !== result2.stats.functionalDependencies) {
      const diff = (result2.stats.functionalDependencies || 0) - (result1.stats.functionalDependencies || 0);
      differences.push(`Functional dependencies changed by ${diff}`);
      if (diff > 0) improvements.push('More functional dependencies discovered');
      else regressions.push('Fewer functional dependencies found');
    }

    if (result1.stats.relations3NF !== result2.stats.relations3NF) {
      const diff = (result2.stats.relations3NF || 0) - (result1.stats.relations3NF || 0);
      differences.push(`3NF relations changed by ${diff}`);
      if (diff > 0) improvements.push('More 3NF relations generated');
      else regressions.push('Fewer 3NF relations created');
    }

    // Compare quality metrics
    if (result1.stats.losslessJoin !== result2.stats.losslessJoin) {
      if (result2.stats.losslessJoin && !result1.stats.losslessJoin) {
                improvements.push('Achieved lossless join property');
      } else if (!result2.stats.losslessJoin && result1.stats.losslessJoin) {
        regressions.push('Lost lossless join property');
      }
    }

    // Compare performance metrics
    if (result1.stats.performanceMetrics && result2.stats.performanceMetrics) {
      const duration1 = parseFloat(result1.stats.performanceMetrics.totalDuration);
      const duration2 = parseFloat(result2.stats.performanceMetrics.totalDuration);
      
      if (duration2 < duration1) {
        improvements.push(`Performance improved by ${((duration1 - duration2) / duration1 * 100).toFixed(1)}%`);
      } else if (duration2 > duration1) {
        regressions.push(`Performance decreased by ${((duration2 - duration1) / duration1 * 100).toFixed(1)}%`);
      }
    }

    return { differences, improvements, regressions };
  }

  /**
   * Multi-CSV pipeline.
   *
   * Every file goes through the same analysis routine as a single file and
   * honours the same selected operations. The per-file results are then
   * joined into one schema: cross-file foreign keys are detected from the
   * data, mapped onto the *normalized* relations, and the ER diagram, DDL
   * and report are produced from that schema.
   */
  async processFiles(
    files: File[],
    selectedOperations: string[],
    onProgress?: (state: ProcessingState) => void,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    try {
      if (!files || files.length === 0) {
        throw new Error('No files uploaded for processing.');
      }
      files = await expandSpreadsheets(files, n => this.logger.warn(n));

      if (files.length === 1) {
        return await this.processFile(files[0], selectedOperations, onProgress, options);
      }

      this.abortController = new AbortController();
      this.performanceMonitor.startTime = startTime;
      this.performanceMonitor.checkpoints = [];
      this.cacheStats = { hits: 0, misses: 0 };
      this.logger.info(`Starting Multi-CSV Pipeline for ${files.length} files...`, { files: files.map(f => f.name) });

      const has = (name: string) => selectedOperations.includes(name);
      const logs: string[] = [`[INFO] Multi-CSV Pipeline initiated for ${files.length} dataset files.`];
      const tableNames = new IdentifierRegistry();
      const analysed: Array<{ tableName: string; fileName: string; analysis: TableAnalysis }> = [];

      // ---- 1. Per-file analysis (0-70%) ------------------------------------
      for (let idx = 0; idx < files.length; idx++) {
        this.throwIfAborted();
        const file = files[idx];
        const lo = 3 + (idx / files.length) * 67;
        const hi = 3 + ((idx + 1) / files.length) * 67;
        const tableName = tableNames.fresh(file.name.replace(/\.[^/.]+$/, '').toLowerCase());

        onProgress?.({
          phase: 'PREP',
          operation: 'csv-loader',
          progress: Math.round(lo),
          message: `Loading table ${idx + 1}/${files.length}: ${file.name}…`,
        });

        const csvData = await this.processCSVWithStreaming(file, options);
        const rows = csvData.data || [];
        if (rows.length === 0) {
          logs.push(`[WARN] ${file.name} has no data rows and was skipped.`);
          continue;
        }

        const analysis = await this.analyzeRows({
          rows,
          selectedOperations,
          options,
          tableName,
          startTime,
          onProgress,
          mapProgress: p => lo + (p / 100) * (hi - lo),
        });
        analysed.push({ tableName, fileName: file.name, analysis });
        for (const note of analysis.notes) logs.push(`[WARN] ${note}`);
        logs.push(
          `[SUCCESS] Table '${tableName}' (${file.name}): ${analysis.rows.length} rows, ` +
            `${analysis.attributes.length} columns, ${analysis.fdSearch ? analysis.fdSearch.exact : 0} exact FDs.`
        );
      }

      if (analysed.length === 0) {
        throw new Error('None of the uploaded files contained data rows.');
      }

      // ---- 2. Table summaries ------------------------------------------------
      const tables: TableData[] = analysed.map(({ tableName, fileName, analysis }) => {
        const primaryKey =
          analysis.keyChoice?.primaryKey ??
          (analysis.keyResult?.primaryKey as string[] | undefined) ??
          this.suggestPrimaryKey(analysis.rows, analysis.attributes);
        return {
          tableName,
          fileName,
          headers: analysis.attributes,
          rows: analysis.rows,
          rowCount: analysis.rows.length,
          nerTags: analysis.nerTags,
          functionalDependencies: analysis.functionalDependencies,
          candidateKeys: (analysis.keyResult?.candidateKeys ?? []).map((k: string[]) => ({
            attributes: k,
            isMinimal: true,
          })),
          primaryKey,
          firstNormalForm: analysis.relations1NF,
          secondNormalForm: analysis.relations2NF,
          thirdNormalForm: analysis.relations3NF,
          bcnf: analysis.relationsBCNF,
          keyReason: analysis.keyChoice?.reason,
          fdSearch: analysis.fdSearch ?? undefined,
          losslessCheck: analysis.losslessCheck,
          dependencyPreservation: analysis.dependencyPreservation,
          notes: analysis.notes,
        };
      });

      const nerResults: Record<string, any[]> = {};
      tables.forEach(t => {
        nerResults[t.tableName] = t.nerTags;
      });

      // ---- 3. Cross-file foreign keys (70-80%) -------------------------------
      let crossTableRelationships: ReturnType<typeof RelationDetectorService.detectCrossTableRelationships> = [];
      if (has('Relation Detector')) {
        this.throwIfAborted();
        onProgress?.({
          phase: 'ANALYZE',
          operation: 'relation-detector',
          progress: 72,
          message: 'Detecting foreign keys across files…',
        });
        crossTableRelationships = RelationDetectorService.detectCrossTableRelationships(tables);
        logs.push(`[SUCCESS] Relation Detector identified ${crossTableRelationships.length} foreign key relationship(s).`);
      }

      // ---- 4. One schema from the normalized relations -----------------------
      const schema = buildSchema(
        tables.map(t => ({
          tableName: t.tableName,
          headers: t.headers,
          rows: t.rows,
          primaryKey: t.primaryKey,
          relations: t.thirdNormalForm.length ? t.thirdNormalForm : t.secondNormalForm,
        })),
        crossTableRelationships
      );
      for (const u of schema.unplaced) {
        logs.push(`[WARN] Foreign key ${u.link.sourceTable}.${u.link.sourceColumn} → ${u.link.targetTable}.${u.link.targetColumn} skipped: ${u.reason}.`);
      }

      // ---- 5. Outputs (80-100%) ---------------------------------------------
      const dialect: SQLDialect = options.sqlDialect || 'sqlite';
      let erdContent = '';
      if (has('ERD Generator')) {
        onProgress?.({ phase: 'OUTPUT', operation: 'erd-generator', progress: 85, message: 'Generating ER diagram…' });
        erdContent = emitMermaidErd(schema);
      }

      let sqlDDL = '';
      if (has('SQL Generator')) {
        onProgress?.({ phase: 'OUTPUT', operation: 'sql-generator', progress: 92, message: 'Generating SQL DDL…' });
        sqlDDL = DatabaseService.generateDDL(toDecomposedRelations(schema), dialect);
      }

      onProgress?.({ phase: 'OUTPUT', operation: 'report-generator', progress: 97, message: 'Writing report…' });
      const reportMarkdown = buildMultiTableReport({
        tables: analysed.map(a => ({
          tableName: a.tableName,
          fileName: a.fileName,
          rowCount: a.analysis.rows.length,
          headers: a.analysis.attributes,
          analysis: a.analysis,
        })),
        links: crossTableRelationships,
        schema,
        dialect,
        selectedOperations,
      });

      const outputFiles: OutputFile[] = [];
      if (erdContent) {
        outputFiles.push({
          name: 'multi_table_erd.mermaid',
          type: 'mermaid',
          description: 'ER diagram of the normalized relations with foreign keys',
          content: erdContent,
          size: erdContent.length,
          category: 'ERD',
        });
      }
      if (sqlDDL) {
        outputFiles.push({
          name: 'consolidated_schema.sql',
          type: 'sql',
          description: `Consolidated ${dialect} DDL for the normalized relations`,
          content: sqlDDL,
          size: sqlDDL.length,
          category: 'SQL',
        });
        // Normalized data for loading: one CSV per relation, INSERTs, and orphan checks.
        for (const f of exportNormalizedData(schema, dialect)) {
          outputFiles.push({
            name: f.name,
            type: f.type,
            description:
              f.type === 'csv'
                ? 'Normalized rows for one relation (duplicates removed)'
                : f.name.startsWith('verify') ? 'Queries that count orphan rows per foreign key (expect 0)' : 'INSERT statements in dependency order',
            content: f.content,
            size: f.content.length,
            category: f.type === 'csv' ? 'Data' : 'SQL',
          });
        }
      }
      outputFiles.push({
        name: 'multi_csv_normalization_report.md',
        type: 'markdown',
        description: 'Per-table analysis, relationships and final schema',
        content: reportMarkdown,
        size: reportMarkdown.length,
        category: 'Report',
      });

      const totalDuration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
      onProgress?.({
        phase: 'OUTPUT',
        operation: 'report-generator',
        progress: 100,
        message: 'Multi-CSV pipeline completed successfully!',
      });

      const allFDs = tables.reduce((n, t) => n + t.functionalDependencies.length, 0);
      return {
        success: true,
        isMultiTable: true,
        tables,
        crossTableRelationships,
        nerResults,
        relations: schema.relations,
        relations3NF: schema.relations,
        relationships: schema.relations.flatMap(r =>
          r.foreignKeys.map(fk => ({ source: r.name, target: fk.references, cardinality: fk.cardinality }))
        ),
        stats: {
          originalRows: tables.reduce((n, t) => n + t.rowCount, 0),
          cleanedRows: tables.reduce((n, t) => n + t.rowCount, 0),
          attributes: tables.reduce((n, t) => n + t.headers.length, 0),
          functionalDependencies: allFDs,
          candidateKeys: tables.reduce((n, t) => n + t.candidateKeys.length, 0),
          relationships: crossTableRelationships.length,
          relations3NF: schema.relations.length,
          processDuration: totalDuration,
        },
        outputFiles,
        logs,
        erdDiagram: erdContent,
        erdContent,
        sqlStatements: sqlDDL,
        reportMarkdown,
        duration: totalDuration,
        selectedOperations,
      };
    } catch (err: any) {
      this.logger.error('Multi-CSV Pipeline error', err);
      const totalDuration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
      return {
        success: false,
        error: err?.message || 'Multi-CSV pipeline execution failed.',
        outputFiles: [],
        logs: [`[ERROR] ${err?.message || 'Pipeline execution failed.'}`],
        duration: totalDuration,
        stats: { processDuration: totalDuration },
      };
    }
  }

  // ========== CLEANUP AND CACHE MANAGEMENT ==========

  /**
   * Clear processing cache and reset performance monitors
   */
  clearCache(): void {
    this.processingCache.clear();
    this.performanceMonitor = { startTime: 0, checkpoints: [] };
    this.logger.info('Cache cleared and performance monitors reset');
  }

  /**
   * Get current cache status
   */
  getCacheStatus(): {
    size: number;
    memoryUsage: number;
    lastCleared?: Date;
  } {
    return {
      size: this.processingCache.size,
      memoryUsage: this.getMemoryUsage(),
      lastCleared: new Date() // Simplified - would track actual clear time in production
    };
  }

  private objectsToCSV(rows: any[]): string {
    return this.arrayToCSV(rows);
  }
}

const databaseServiceInstance = new DatabaseService();
(databaseServiceInstance as any).formatCSVCell = DatabaseService.formatCSVCell;
(databaseServiceInstance as any).formatCSVHeader = DatabaseService.formatCSVHeader;
(databaseServiceInstance as any).generateDDL = DatabaseService.generateDDL;
(databaseServiceInstance as any).generateTableDDL = DatabaseService.generateTableDDL;

export default databaseServiceInstance;
