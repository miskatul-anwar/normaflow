import { OperationDefinition } from '../types';

export const OPERATIONS: Record<string, OperationDefinition> = {
  'CSV Data Loader': {
    phase: 'PREP',
    id: 'csv-loader',
    order: 1,
    dependencies: [],
    description: 'Loads CSV files'
  },
  'Data Cleaner': {
    phase: 'PREP',
    id: 'data-cleaner',
    order: 2,
    dependencies: ['CSV Data Loader'],
    description: 'Strips nulls and cleans formatting'
  },
  'Atomicity Checker': {
    phase: 'PREP',
    id: 'atomicity-checker',
    order: 3,
    dependencies: ['Data Cleaner'],
    description: 'Validates scalar values'
  },
  'Data Type Profiler': {
    phase: 'PREP',
    id: 'data-profiler',
    order: 4,
    dependencies: ['Atomicity Checker'],
    description: 'Infers column datatypes'
  },
  'NER Classifier': {
    phase: 'PREP',
    id: 'ner-classifier',
    order: 5,
    dependencies: ['Data Type Profiler'],
    description: 'Classifies semantic entities'
  },
  '1NF': {
    phase: 'NORMAL',
    id: '1nf',
    order: 6,
    dependencies: ['Data Type Profiler'],
    description: 'Enforces First Normal Form'
  },
  'FD Miner': {
    phase: 'ANALYZE',
    id: 'fd-miner',
    order: 7,
    dependencies: ['1NF'],
    description: 'Mines functional dependencies'
  },
  'Key Discovery': {
    phase: 'ANALYZE',
    id: 'key-discovery',
    order: 8,
    dependencies: ['FD Miner'],
    description: 'Finds primary and candidate keys'
  },
  'Relation Detector': {
    phase: 'ANALYZE',
    id: 'relation-detector',
    order: 9,
    dependencies: ['Key Discovery'],
    description: 'Detects foreign key links'
  },
  'Ollama AI Analyst': {
    phase: 'ANALYZE',
    id: 'ollama-ai-analyst',
    order: 10,
    dependencies: ['FD Miner'],
    description: 'Evaluates schema with local LLM'
  },
  'Cardinality Analyzer': {
    phase: 'ANALYZE',
    id: 'cardinality-analyzer',
    order: 11,
    dependencies: ['Key Discovery'],
    description: 'Calculates relationship cardinality'
  },
  '2NF': {
    phase: 'NORMAL',
    id: '2nf',
    order: 12,
    dependencies: ['1NF', 'FD Miner'],
    description: 'Enforces Second Normal Form'
  },
  '3NF': {
    phase: 'NORMAL',
    id: '3nf',
    order: 13,
    dependencies: ['2NF'],
    description: 'Enforces Third Normal Form'
  },
  'Lossless Check': {
    phase: 'NORMAL',
    id: 'lossless-check',
    order: 14,
    dependencies: ['2NF'],
    description: 'Validates lossless join'
  },
  'Dependency Preservation': {
    phase: 'NORMAL',
    id: 'dependency-preservation',
    order: 15,
    dependencies: ['2NF', 'FD Miner'],
    description: 'Verifies dependency preservation'
  },
  'ERD Generator': {
    phase: 'OUTPUT',
    id: 'erd-generator',
    order: 16,
    dependencies: ['Key Discovery'],
    description: 'Generates Mermaid ERD'
  },
  'Relation Generator': {
    phase: 'OUTPUT',
    id: 'relation-generator',
    order: 17,
    dependencies: ['3NF'],
    description: 'Builds relation schemas'
  },
  'SQL Generator': {
    phase: 'OUTPUT',
    id: 'sql-generator',
    order: 18,
    dependencies: ['Relation Generator'],
    description: 'Generates SQL DDL'
  },
  'Report Generator': {
    phase: 'OUTPUT',
    id: 'report-generator',
    order: 19,
    dependencies: ['Lossless Check', 'Dependency Preservation'],
    description: 'Generates summary report'
  },
};

export const ALL_OPERATION_NAMES = Object.keys(OPERATIONS);
