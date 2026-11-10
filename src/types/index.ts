/**
 * Centralized Type Definitions for NormaFlow (Multi-CSV & AI Pipeline Enhanced)
 * Author: miskatul-anwar
 */

export type PhaseType = 'PREP' | 'ANALYZE' | 'NORMAL' | 'OUTPUT';

export interface OperationDefinition {
  phase: PhaseType;
  id: string;
  order: number;
  dependencies: string[];
  description: string;
}

export interface ProcessingPhase {
  name: string;
  operations: string[];
  completed: boolean;
}

export interface ForeignKey {
  attributes: string[];
  references: string;
  referencedKey: string[];
  cardinality: string;
}

export interface RelationSchema {
  name: string;
  attributes: string[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
  rows: any[];
  sourceType?: string;
  sourceTable?: string;
  metadata: {
    rowCount: number;
    attributeTypes: { [key: string]: string };
  };
  originalFD?: {
    lhs: string[];
    rhs: string;
    confidence: number;
  };
}

export interface FunctionalDependency {
  lhs: string[];
  rhs: string;
  confidence: number;
  coverage: number;
  violations: number;
  uniqueGroups?: number;
  sourceTable?: string;
  isAiEnriched?: boolean;
}

export interface CandidateKey {
  attributes: string[];
  isMinimal: boolean;
  sourceTable?: string;
}

export interface Relationship {
  source: string;
  target: string;
  sourceKey: string[];
  targetKey: string[];
  cardinality: string;
  type: 'identifying' | 'non-identifying';
  strength: number;
}

export type EntityType = 
  | 'PRIMARY_KEY_ID'
  | 'FOREIGN_KEY_REF'
  | 'PERSON_NAME'
  | 'EMAIL'
  | 'URL'
  | 'UUID'
  | 'PHONE_NUMBER'
  | 'LOCATION_ADDRESS'
  | 'DATE_TIMESTAMP'
  | 'CURRENCY_PRICE'
  | 'ORGANIZATION_COMPANY'
  | 'PRODUCT_ITEM'
  | 'CATEGORY_TYPE'
  | 'NUMERIC_METRIC'
  | 'BOOLEAN_FLAG'
  | 'GENERAL_TEXT';

export interface EntityTag {
  columnName: string;
  tableName: string;
  entityType: EntityType;
  confidence: number;
  sampleValues: string[];
  description: string;
}

export interface CrossTableRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  /** Composite foreign key: all referencing columns, in key order (first equals `sourceColumn`). */
  sourceColumns?: string[];
  /** Composite foreign key: all referenced key columns, aligned with `sourceColumns`. */
  targetColumns?: string[];
  cardinality: '1:1' | '1:N' | 'N:M';
  confidence: number;
  matchRatio: number;
  detectedBy: 'NER_PATTERN' | 'VALUE_OVERLAP' | 'HEURISTIC';
  /** True when some referencing cells are missing (the FK column is nullable). */
  optional?: boolean;
  /** Share of the referenced key's values that are actually referenced. */
  coverage?: number;
  /** 0..1 name similarity between the two columns (a scoring feature). */
  nameScore?: number;
}

export interface TableData {
  tableName: string;
  fileName: string;
  headers: string[];
  rows: any[];
  rowCount: number;
  nerTags: EntityTag[];
  functionalDependencies: FunctionalDependency[];
  candidateKeys: CandidateKey[];
  primaryKey: string[];
  firstNormalForm: RelationSchema[];
  secondNormalForm: RelationSchema[];
  thirdNormalForm: RelationSchema[];
  bcnf?: RelationSchema[];
  /** Why this primary key was chosen (or why a surrogate was added). */
  keyReason?: string;
  /** How the FD search went: counts, and whether it was cut short. */
  fdSearch?: {
    truncated: boolean;
    levelReached: number;
    maxLhsSize: number;
    exact: number;
    approximate: number;
    approximateUsed: boolean;
  };
  losslessCheck?: any;
  dependencyPreservation?: any;
  /** Warnings produced while analysing this table. */
  notes?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence?: number;
  missingOperations?: string[];
  recommendations?: string[];
  requiredNormalForm?: string;
}

export interface ProcessingOptions {
  enableParallelProcessing?: boolean;
  chunkSize?: number;
  sampleSize?: number;
  strictValidation?: boolean;
  maxFdLhsSize?: number;
  enableNER?: boolean;
  enableRelationDetection?: boolean;
}

export interface ProcessingProgress {
  phase: string;
  operation: string;
  percentage: number;
  step: number;
  totalSteps: number;
  details?: string;
}

export interface OutputFile {
  name: string;
  content: string;
  type: 'sql' | 'markdown' | 'json' | 'mermaid' | 'text' | 'csv';
  category: string;
}

export interface ProcessingResults {
  success: boolean;
  error?: string;
  isMultiTable?: boolean;
  tables?: TableData[];
  crossTableRelationships?: CrossTableRelationship[];
  nerResults?: { [tableName: string]: EntityTag[] };
  cleanedData?: any[];
  atomicityResult?: any;
  typeProfile?: any;
  functionalDependencies?: FunctionalDependency[];
  candidateKeys?: CandidateKey[];
  primaryKey?: string[];
  cardinalities?: any;
  firstNormalForm?: RelationSchema[];
  secondNormalForm?: RelationSchema[];
  thirdNormalForm?: RelationSchema[];
  bcnf?: RelationSchema[];
  losslessCheck?: any;
  dependencyPreservation?: any;
  erdDiagram?: string;
  relations?: RelationSchema[];
  sqlStatements?: string;
  reportMarkdown?: string;
  outputFiles?: OutputFile[];
  logs?: string[];
  metrics?: {
    executionTimeMs: number;
    memoryUsedMB: number;
    rowCount: number;
    columnCount: number;
    tablesProcessedCount?: number;
  };
}