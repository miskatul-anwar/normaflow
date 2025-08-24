/**
 * Type Definitions for NormaFlow
 * Author: miskatul-anwar
 * Date: 2025-07-30 04:48:45 UTC
 */

export interface OperationDefinition {
  phase: 'PREP' | 'ANALYZE' | 'NORMAL' | 'OUTPUT';
  id: string;
  order: number;
}

export interface ProcessingPhase {
  name: string;
  operations: string[];
  completed: boolean;
}

export interface RelationSchema {
  name: string;
  attributes: string[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
  rows: any[];
  metadata: {
    rowCount: number;
    attributeTypes: { [key: string]: string };
  };
}

export interface ForeignKey {
  attributes: string[];
  references: string;
  referencedKey: string[];
  cardinality: string;
}

export interface FunctionalDependency {
  lhs: string[];
  rhs: string;
  confidence: number;
  coverage: number;
  violations: number;
}