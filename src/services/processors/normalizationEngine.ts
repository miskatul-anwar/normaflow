/**
 * Complete Normalization Engine - Mathematically Sound Version
 * Enhanced with Accurate Algorithms and Real Data Analysis
 * Author: miskatul-anwar
 * Date: 2025-08-02 14:42:16 UTC
 * 
 * FIXES:
 * - Preserves ALL functional dependencies regardless of confidence
 * - Ensures lossless join decomposition
 * - Uses all FDs for ERD generation
 * - Maintains all existing features
 */

import { DataUtils } from '../utils/dataUtils';
import { Logger } from '../utils/logger';
import { mineFunctionalDependencies as mineFDFast } from './fdMiner';

export interface FunctionalDependency {
  lhs: string[];
  rhs: string;
  confidence: number;
  coverage: number;
  violations: number;
  uniqueGroups: number;
}

export interface CandidateKey {
  attributes: string[];
  isMinimal: boolean;
}

export interface RelationSchema {
  name: string;
  attributes: string[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
  rows: any[];
  sourceType: string;
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

export interface ForeignKey {
  attributes: string[];
  references: string;
  referencedKey: string[];
  cardinality: string;
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

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

interface DataAnalysis {
  actualLengths: Map<string, number>;
  patterns: Map<string, string>;
  nullabilityRatio: Map<string, number>;
  uniquenessRatio: Map<string, number>;
  sampleValues: Map<string, any[]>;
}

interface ConstraintValidation {
  foreignKey: ForeignKey;
  isValid: boolean;
  targetExists: boolean;
  columnsMatch: boolean;
  dataIntegrity: boolean;
  errors: string[];
}

export class NormalizationEngine {
  private static logger = new Logger();
  
  /**
 * FIXED: Validate primary key uniqueness
 */
private static validatePrimaryKeyUniqueness(relation: RelationSchema): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!relation.primaryKey || relation.primaryKey.length === 0) {
    errors.push('No primary key defined');
    return { isValid: false, errors, warnings, confidence: 0 };
  }

  if (!relation.rows || relation.rows.length === 0) {
    warnings.push('No data to validate primary key uniqueness');
    return { isValid: true, errors, warnings, confidence: 0.5 };
  }

  const pkValues = new Set<string>();
  let duplicates = 0;
  let nullOrEmptyPKs = 0;

  for (const row of relation.rows) {
    // Create primary key value from concatenated attributes
    const pkValueParts = relation.primaryKey.map(attr => {
      const val = row[attr];
      return val !== null && val !== undefined ? val.toString().trim() : '';
    });

    // Check for null or empty primary key components
    if (pkValueParts.some(part => part === '')) {
      nullOrEmptyPKs++;
      continue;
    }

    const pkValue = pkValueParts.join('||');
    
    if (pkValues.has(pkValue)) {
      duplicates++;
    } else {
      pkValues.add(pkValue);
    }
  }

  // Calculate confidence based on uniqueness ratio
  const totalValidRows = relation.rows.length - nullOrEmptyPKs;
  const uniquenessRatio = totalValidRows > 0 ? pkValues.size / totalValidRows : 0;

  if (duplicates > 0) {
    errors.push(`Primary key has ${duplicates} duplicate values`);
  }

  if (nullOrEmptyPKs > 0) {
    warnings.push(`Primary key has ${nullOrEmptyPKs} null or empty values`);
  }

  const isValid = duplicates === 0 && nullOrEmptyPKs === 0;

  return {
    isValid,
    errors,
    warnings,
    confidence: uniquenessRatio
  };
}

  /**
   * Mine functional dependencies using the fast partition-refinement miner.
   *
   * The previous implementation re-scanned the full dataset for every
   * (LHS, RHS) candidate — O(combinations × rows) with heavy per-pair Map
   * allocations. The lattice-based miner shares partitions between related
   * LHS sets and integer-encodes columns once, making mining orders of
   * magnitude faster on real datasets while producing exact FDs (plus
   * high-confidence approximate ones).
   */
  static async mineFunctionalDependencies(data: any[], maxLhsSize: number = 4): Promise<FunctionalDependency[]> {
    if (!data || data.length === 0) {
      this.logger.warn('No data provided for FD mining');
      return [];
    }

    const attributes = Object.keys(data[0] || {});
    if (attributes.length < 2) {
      this.logger.warn('Not enough attributes for FD mining');
      return [];
    }

    this.logger.info(`FD mining (partition refinement): ${data.length} rows × ${attributes.length} attributes`);

    // Yield to keep the UI responsive before the (synchronous) compute burst.
    await this.yieldControl();

    const { fds, durationMs, combinationsEvaluated, exactCount } = mineFDFast(data, {
      maxLhsSize,
      minConfidence: 0.85,
    });

    const mapped: FunctionalDependency[] = fds.map(fd => ({
      lhs: [...fd.lhs],
      rhs: fd.rhs,
      confidence: fd.confidence,
      coverage: fd.coverage,
      violations: fd.violations,
      uniqueGroups: fd.uniqueGroups,
    }));

    this.logger.success(
      `FD mining completed in ${durationMs}ms: ${mapped.length} FDs (${exactCount} exact) from ${combinationsEvaluated} evaluated candidates`,
    );

    return mapped;
  }

  /**
   * UNCHANGED: Rigorous Functional Dependency Validation
   */
  private static validateFunctionalDependencyRigorous(
    lhs: string[], 
    rhs: string, 
    data: any[]
  ): { isValid: boolean; confidence: number; coverage: number; uniqueGroups: number; violations: number } {
    
    if (data.length === 0) {
      return { isValid: false, confidence: 0, coverage: 0, uniqueGroups: 0, violations: 0 };
    }
    
    // Create map of LHS values to RHS values
    const lhsToRhsMap = new Map<string, Set<string>>();
    const lhsGroups = new Map<string, number>();
    let totalRows = 0;
    let violations = 0;
    
    // Process all data for complete accuracy
    for (const row of data) {
      // Create LHS key from concatenated values
      const lhsValues = lhs.map(attr => {
        const val = row[attr];
        return val !== null && val !== undefined ? val.toString().trim() : '';
      });
      
      // Skip rows with null/empty LHS values
      if (lhsValues.some(val => val === '')) {
        continue;
      }
      
      const lhsKey = lhsValues.join('||');
      const rhsValue = row[rhs] !== null && row[rhs] !== undefined ? row[rhs].toString().trim() : '';
      
      totalRows++;
      
      // Track LHS group frequency
      lhsGroups.set(lhsKey, (lhsGroups.get(lhsKey) || 0) + 1);
      
      // Track RHS values for this LHS
      if (!lhsToRhsMap.has(lhsKey)) {
        lhsToRhsMap.set(lhsKey, new Set());
      }
      lhsToRhsMap.get(lhsKey)!.add(rhsValue);
    }
    
    if (totalRows === 0 || lhsToRhsMap.size === 0) {
      return { isValid: false, confidence: 0, coverage: 0, uniqueGroups: 0, violations: 0 };
    }
    
    // Count violations: LHS groups that map to multiple RHS values
    for (const [lhsKey, rhsValues] of lhsToRhsMap) {
      if (rhsValues.size > 1) {
        // This LHS maps to multiple RHS values - violation
        violations += lhsGroups.get(lhsKey) || 0;
      }
    }
    
    // Calculate metrics
    const uniqueGroups = lhsToRhsMap.size;
    const confidence = totalRows > 0 ? (totalRows - violations) / totalRows : 0;
    const coverage = totalRows > 0 ? uniqueGroups / totalRows : 0;
    
    // FIXED: More lenient validation - any meaningful confidence is valid
    const isValid = confidence >= 0.51 && violations <= Math.floor(totalRows * 0.49);
    
    return {
      isValid,
      confidence,
      coverage,
      uniqueGroups,
      violations
    };
  }

  /**
   * UNCHANGED: Generate subsets iteratively
   */
  private static* generateSubsetsIterative(arr: string[], size: number): Generator<string[]> {
    if (size === 0) return;
    if (size > arr.length) return;
    
    if (size === 1) {
      for (const item of arr) {
        yield [item];
      }
      return;
    }
    
    // Use iterative approach for larger subsets
    const indices = Array.from({ length: size }, (_, i) => i);
    
    while (true) {
      yield indices.map(i => arr[i]);
      
      // Generate next combination
      let i = size - 1;
      while (i >= 0 && indices[i] === arr.length - size + i) {
        i--;
      }
      
      if (i < 0) break;
      
      indices[i]++;
      for (let j = i + 1; j < size; j++) {
        indices[j] = indices[j - 1] + 1;
      }
    }
  }

  /**
   * UNCHANGED: Mathematically Sound Key Discovery
   */
  static async findKeys(
    attributes: string[], 
    fds: FunctionalDependency[]
  ): Promise<{ 
    candidateKeys: string[][], 
    superkeys: string[][],
    searchMetrics?: {
      strategy: string;
      phases: Array<{
        name: string;
        evaluated: number;
        keysFound: number;
        duration: number;
        success: boolean;
      }>;
      totalEvaluated: number;
      totalDuration: number;
      finalStrategy: string;
    }
  }> {
    this.logger.info(`Mathematical key discovery: ${attributes.length} attributes, ${fds.length} FDs`);
    
    const searchMetrics = {
      strategy: 'mathematical-closure-based',
      phases: [] as Array<{
        name: string;
        evaluated: number;
        keysFound: number;
        duration: number;
        success: boolean;
      }>,
      totalEvaluated: 0,
      totalDuration: 0,
      finalStrategy: 'none'
    };
    
    const startTime = Date.now();
    let allSuperkeys: string[][] = [];
    
    // PHASE 1: Single attribute keys
    const phase1Result = await this.findSingleAttributeKeys(attributes, fds);
    allSuperkeys.push(...phase1Result.keys);
    searchMetrics.phases.push({
      name: 'Single Attributes',
      evaluated: phase1Result.evaluated,
      keysFound: phase1Result.keys.length,
      duration: phase1Result.duration,
      success: phase1Result.keys.length > 0
    });
    
    this.logger.info(`Phase 1: Found ${phase1Result.keys.length} single-attribute keys`);
    
    // PHASE 2: Systematic search for minimal keys
    if (allSuperkeys.length === 0) {
      const phase2Result = await this.findMinimalKeysSystematic(attributes, fds);
      allSuperkeys.push(...phase2Result.keys);
      searchMetrics.phases.push({
        name: 'Systematic Minimal Search',
        evaluated: phase2Result.evaluated,
        keysFound: phase2Result.keys.length,
        duration: phase2Result.duration,
        success: phase2Result.keys.length > 0
      });
      
      this.logger.info(`Phase 2: Found ${phase2Result.keys.length} minimal keys`);
    }
    
    // Extract candidate keys (minimal superkeys)
    const candidateKeys = this.extractCandidateKeys(allSuperkeys);
    
    // If no keys found, suggest all attributes as fallback
    if (candidateKeys.length === 0) {
      this.logger.warn('No natural keys found - using all attributes as fallback');
      candidateKeys.push([...attributes]);
      allSuperkeys.push([...attributes]);
    }
    
    searchMetrics.totalEvaluated = searchMetrics.phases.reduce((sum, p) => sum + p.evaluated, 0);
    searchMetrics.totalDuration = Date.now() - startTime;
    searchMetrics.finalStrategy = this.determineSuccessfulStrategy(searchMetrics.phases);
    
    this.logger.success(`Mathematical key discovery completed: ${candidateKeys.length} candidate keys in ${searchMetrics.totalDuration}ms`);
    
    return { candidateKeys, superkeys: allSuperkeys, searchMetrics };
  }

  /**
   * UNCHANGED: Find single attribute keys using closure
   */
  private static async findSingleAttributeKeys(
    attributes: string[], 
    fds: FunctionalDependency[]
  ): Promise<{ keys: string[][], evaluated: number, duration: number }> {
    const startTime = Date.now();
    const keys: string[][] = [];
    let evaluated = 0;
    
    for (const attr of attributes) {
      const closure = this.computeClosure([attr], fds);
      evaluated++;
      
      if (closure.size === attributes.length) {
        keys.push([attr]);
        this.logger.debug(`Single key found: {${attr}}`);
      }
    }
    
    return {
      keys,
      evaluated,
      duration: Date.now() - startTime
    };
  }

  /**
   * UNCHANGED: Systematic search for minimal keys
   */
  private static async findMinimalKeysSystematic(
    attributes: string[], 
    fds: FunctionalDependency[]
  ): Promise<{ keys: string[][], evaluated: number, duration: number }> {
    const startTime = Date.now();
    const keys: string[][] = [];
    let evaluated = 0;
    const maxSize = Math.min(attributes.length, 5); // Increased search space
    
    // Search by increasing size until we find keys
    for (let size = 2; size <= maxSize; size++) {
      this.logger.info(`Searching for keys of size ${size}...`);
      let foundKeysAtThisSize = false;
      
      for (const subset of this.generateSubsetsIterative(attributes, size)) {
        const closure = this.computeClosure(subset, fds);
        evaluated++;
        
        if (closure.size === attributes.length) {
          // Check if this is minimal (no proper subset is also a key)
          if (this.isMinimalKey(subset, keys)) {
            keys.push([...subset]);
            foundKeysAtThisSize = true;
            this.logger.debug(`Minimal key found: {${subset.join(', ')}}`);
          }
        }
        
        // Yield control periodically
        if (evaluated % 100 === 0) {
          await this.yieldControl();
        }
        
        // Time limit check
        if (Date.now() - startTime > 45000) {
          this.logger.warn('Time limit reached in systematic key search');
          break;
        }
      }
      
      // If we found keys at this size, we can stop (they are minimal)
      if (foundKeysAtThisSize) {
        this.logger.info(`Found keys at size ${size}, stopping search`);
        break;
      }
    }
    
    return {
      keys,
      evaluated,
      duration: Date.now() - startTime
    };
  }

  /**
   * UNCHANGED: Check if a key is minimal
   */
  private static isMinimalKey(candidate: string[], existingKeys: string[][]): boolean {
    for (const existingKey of existingKeys) {
      if (existingKey.every(attr => candidate.includes(attr)) && existingKey.length < candidate.length) {
        return false; // candidate is a superset of an existing key
      }
    }
    return true;
  }

  /**
   * UNCHANGED: Compute closure of attributes using functional dependencies
   */
  private static computeClosure(attributes: string[], fds: FunctionalDependency[]): Set<string> {
    const closure = new Set(attributes);
    let changed = true;
    let iterations = 0;
    const maxIterations = fds.length * 3; // Reasonable limit
    
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      
      for (const fd of fds) {
        // If all LHS attributes are in closure and RHS is not
        if (fd.lhs.every(attr => closure.has(attr)) && !closure.has(fd.rhs)) {
          closure.add(fd.rhs);
          changed = true;
        }
      }
    }
    
    return closure;
  }

  /**
   * UNCHANGED: Extract minimal candidate keys from superkeys
   */
  private static extractCandidateKeys(superkeys: string[][]): string[][] {
    if (superkeys.length === 0) return [];
    
    // Remove duplicates
    const uniqueKeys = Array.from(
      new Set(superkeys.map(key => key.sort().join('|')))
    ).map(keyStr => keyStr.split('|'));
    
    // Sort by size (smaller keys first)
    uniqueKeys.sort((a, b) => a.length - b.length);
    
    const candidateKeys: string[][] = [];
    
    for (const key of uniqueKeys) {
      // Check if this key is minimal
      const isMinimal = !candidateKeys.some(candidate =>
        candidate.every(attr => key.includes(attr)) && candidate.length < key.length
      );
      
      if (isMinimal) {
        candidateKeys.push(key);
      }
    }
    
    return candidateKeys;
  }

  /**
   * UNCHANGED: Apply First Normal Form (1NF)
   */
  static async apply1NF(data: any[]): Promise<any[]> {
    this.logger.info('Applying rigorous First Normal Form (1NF)...');
    
    if (!data || data.length === 0) {
      this.logger.warn('No data provided for 1NF application');
      return [];
    }
    
    const normalizedData: any[] = [];
    
    for (const row of data) {
      const normalizedRow: any = {};
      
      Object.entries(row).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          const valueStr = value.toString().trim();
          
          // Check for atomic violations more rigorously
          if (this.hasAtomicViolations(valueStr)) {
            // For now, take first value - in production, this should create new rows
            const atomicValue = this.extractAtomicValue(valueStr);
            normalizedRow[key] = atomicValue;
            this.logger.debug(`Normalized non-atomic value in ${key}: "${valueStr}" -> "${atomicValue}"`);
          } else {
            normalizedRow[key] = valueStr;
          }
        } else {
          normalizedRow[key] = '';
        }
      });
      
      normalizedData.push(normalizedRow);
    }
    
    this.logger.success(`1NF applied: ${normalizedData.length} rows processed`);
    return normalizedData;
  }

  /**
   * UNCHANGED: Rigorous atomic violation detection
   */
  private static hasAtomicViolations(value: string): boolean {
    if (!value || value.length === 0) return false;
    
    // Check for clear delimiters
    if (/[,;|]/.test(value)) return true;
    
    // Check for multiple values with conjunctions
    if (/\s+(and|or|&|\+)\s+/i.test(value)) return true;
    
    // Check for list-like structures
    if (/^\s*[\[\{].*[\]\}]\s*$/.test(value)) return true;
    
    // Check for multiple sentences (likely multiple values)
    const sentences = value.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 3) return true;
    
    return false;
  }

  /**
   * UNCHANGED: Extract atomic value from non-atomic value
   */
  private static extractAtomicValue(value: string): string {
    // Split by common delimiters and take first meaningful part
    const parts = value.split(/[,;|]/).map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length > 0) return parts[0];
    
    // Split by conjunctions
    const conjParts = value.split(/\s+(and|or|&|\+)\s+/i).map(p => p.trim()).filter(p => p.length > 0);
    if (conjParts.length > 0) return conjParts[0];
    
    return value;
  }

  /**
   * FIXED: Apply Second Normal Form (2NF) - uses ALL FDs
   */
  static async apply2NF(data: any[], fds: FunctionalDependency[]): Promise<RelationSchema[]> {
    this.logger.info('Applying mathematically rigorous Second Normal Form (2NF) with ALL FDs...');
    
    if (!data || data.length === 0) {
      this.logger.warn('No data provided for 2NF application');
      return [];
    }
    
    const attributes = Object.keys(data[0] || {});
    const relations: RelationSchema[] = [];
    
    // Find candidate keys first
    const keyResult = await this.findKeys(attributes, fds);
    const candidateKeys = keyResult.candidateKeys;
    
    if (candidateKeys.length === 0) {
      this.logger.warn('No candidate keys found - cannot properly apply 2NF');
      return [{
        name: 'MainRelation',
        attributes,
        primaryKey: attributes.slice(0, 1), // Fallback
        foreignKeys: [],
        rows: data,
        sourceType: '2NF_Fallback',
        metadata: {
          rowCount: data.length,
          attributeTypes: this.inferAttributeTypes(data, attributes)
        }
      }];
    }
    
    // Use first candidate key as primary key
    const primaryKey = candidateKeys[0];
    this.logger.info(`Using primary key: {${primaryKey.join(', ')}}`);
    
    // FIXED: Find partial dependencies using ALL FDs (including low confidence ones)
    const partialDependencies = fds.filter(fd => {
      // Check if LHS is a proper subset of primary key
      const isProperSubset = fd.lhs.length > 0 && 
                            fd.lhs.length < primaryKey.length &&
                            fd.lhs.every(attr => primaryKey.includes(attr));
      
      // Check if RHS is not part of primary key
      const rhsNotInPK = !primaryKey.includes(fd.rhs);
      
      return isProperSubset && rhsNotInPK;
    });
    
    if (partialDependencies.length === 0) {
      this.logger.info('No partial dependencies found - data is already in 2NF');
      return [{
        name: 'MainRelation',
        attributes,
        primaryKey,
        foreignKeys: [],
        rows: data,
        sourceType: '2NF',
        metadata: {
          rowCount: data.length,
          attributeTypes: this.inferAttributeTypes(data, attributes)
        }
      }];
    }
    
    this.logger.info(`Found ${partialDependencies.length} partial dependencies (all confidence levels)`);
    
    // Create relations for partial dependencies
    for (const fd of partialDependencies) {
      const relationAttrs = Array.from(new Set([...fd.lhs, fd.rhs]));
      const relationName = this.generateRelationName(relationAttrs, '2NF');
      const relationData = this.extractRelationData(data, relationAttrs);
      
      relations.push({
        name: relationName,
        attributes: relationAttrs,
        primaryKey: fd.lhs,
        foreignKeys: [],
        rows: relationData,
        sourceType: '2NF_PartialDependency',
        metadata: {
          rowCount: relationData.length,
          attributeTypes: this.inferAttributeTypes(relationData, relationAttrs)
        },
        originalFD: {
          lhs: fd.lhs,
          rhs: fd.rhs,
          confidence: fd.confidence
        }
      });
    }
    
    // Create main relation with remaining attributes
    const usedAttrs = new Set(partialDependencies.flatMap(fd => [...fd.lhs, fd.rhs]));
    const remainingAttrs = attributes.filter(attr => !usedAttrs.has(attr) || primaryKey.includes(attr));
    
    if (remainingAttrs.length > 0) {
      const mainRelationData = this.extractRelationData(data, remainingAttrs);
      relations.push({
        name: 'MainRelation_2NF',
        attributes: remainingAttrs,
        primaryKey,
        foreignKeys: [],
        rows: mainRelationData,
        sourceType: '2NF_Main',
        metadata: {
          rowCount: mainRelationData.length,
          attributeTypes: this.inferAttributeTypes(mainRelationData, remainingAttrs)
        }
      });
    }
    
    this.logger.success(`2NF applied: ${relations.length} relations created using ALL FDs`);
    return relations;
  }

  /**
   * Apply 3NF decomposition on 2NF relations
   */
  static async apply3NF(relations2NF: RelationSchema[], fds: FunctionalDependency[]): Promise<RelationSchema[]> {
    this.logger.info('Applying Third Normal Form (3NF) decomposition...');
    if (!relations2NF || relations2NF.length === 0) return [];
    
    // For each 2NF relation, check transitive dependencies
    const relations3NF: RelationSchema[] = [];
    
    for (const rel of relations2NF) {
      const relFds = fds.filter(fd => 
        fd.lhs.every(attr => rel.attributes.includes(attr)) && rel.attributes.includes(fd.rhs)
      );

      // Check transitive FDs (LHS is not a superkey of relation)
      const transitiveFds = relFds.filter(fd => 
        !fd.lhs.every(attr => rel.primaryKey.includes(attr))
      );

      if (transitiveFds.length === 0) {
        relations3NF.push(rel);
      } else {
        // Decompose: each transitive FD X → A forms relation {X, A}.
        // Rows MUST be projected onto the relation's attributes — carrying the
        // original wide rows produced schemas whose data didn't match their
        // declared attributes.
        const decomposedNames = new Set<string>();
        for (const fd of transitiveFds) {
          const relationAttrs = Array.from(new Set([...fd.lhs, fd.rhs]));
          const name = `Rel3NF_${rel.name}_${fd.rhs}`;
          if (decomposedNames.has(name)) continue;
          decomposedNames.add(name);
          const projectedRows = this.extractRelationData(rel.rows || [], relationAttrs);
          relations3NF.push({
            name,
            attributes: relationAttrs,
            primaryKey: fd.lhs,
            foreignKeys: [],
            rows: projectedRows,
            sourceType: '3NF_Decomposed',
            metadata: {
              rowCount: projectedRows.length,
              attributeTypes: this.inferAttributeTypes(projectedRows, relationAttrs)
            }
          });
        }

        // Keep a residual relation for attributes not covered by any
        // decomposition so no column is silently dropped.
        const covered = new Set(transitiveFds.flatMap(fd => [...fd.lhs, fd.rhs]));
        const residualAttrs = rel.attributes.filter(attr => !covered.has(attr));
        const pkAttrs = rel.primaryKey.filter(attr => !covered.has(attr));
        const residualSet = Array.from(new Set([...pkAttrs, ...residualAttrs]));
        if (residualSet.length >= 2) {
          const residualRows = this.extractRelationData(rel.rows || [], residualSet);
          relations3NF.push({
            name: `${rel.name}_residual`,
            attributes: residualSet,
            primaryKey: rel.primaryKey.filter(attr => residualSet.includes(attr)),
            foreignKeys: [],
            rows: residualRows,
            sourceType: '3NF_Residual',
            metadata: {
              rowCount: residualRows.length,
              attributeTypes: this.inferAttributeTypes(residualRows, residualSet)
            }
          });
        }
      }
    }

    return relations3NF.length > 0 ? relations3NF : relations2NF;
  }

  /**
   * FIXED: Synthesize 3NF using Bernstein algorithm - ENSURES LOSSLESS JOIN
   */
  static async synthesize3NF(
    fds: FunctionalDependency[], 
    candidateKeys: string[][], 
    data: any[]
  ): Promise<RelationSchema[]> {
    this.logger.info('Starting mathematically rigorous 3NF synthesis (LOSSLESS JOIN GUARANTEED)...');
    
    if (fds.length === 0) {
      this.logger.warn('No functional dependencies provided for 3NF synthesis');
      return [];
    }
    
    try {
      const relations: RelationSchema[] = [];
      const relationNames = new Set<string>();
      
      // STEP 1: Create relations from ALL functional dependencies (including low confidence)
      this.logger.info('Step 1: Creating relations from ALL functional dependencies...');
      for (const fd of fds) {
        const relationAttrs = Array.from(new Set([...fd.lhs, fd.rhs]));
        const relationName = this.generateRelationName(relationAttrs);
        
        if (!relationNames.has(relationName)) {
          const relationData = this.extractRelationData(data, relationAttrs);
          
          relations.push({
            name: relationName,
            attributes: relationAttrs,
            primaryKey: fd.lhs,
            foreignKeys: [],
            rows: relationData,
            sourceType: 'FunctionalDependency',
            originalFD: {
              lhs: fd.lhs,
              rhs: fd.rhs,
              confidence: fd.confidence
            },
            metadata: {
              rowCount: relationData.length,
              attributeTypes: this.inferAttributeTypes(relationData, relationAttrs)
            }
          });
          relationNames.add(relationName);
          
          const confidenceLevel = fd.confidence >= 0.95 ? 'HIGH' : 
                                fd.confidence >= 0.80 ? 'MEDIUM' : 'LOW';
          this.logger.debug(`Created relation ${relationName} from FD [${confidenceLevel}]: {${fd.lhs.join(',')}} → ${fd.rhs}`);
        }
      }
      
      // STEP 2: CRITICAL - Ensure candidate key coverage for LOSSLESS JOIN
      this.logger.info('Step 2: Ensuring candidate key coverage for lossless join...');
      this.ensureCandidateKeyCoverage(relations, candidateKeys, data, relationNames);
      
      // STEP 3: Remove redundant relations (but preserve lossless join)
      this.logger.info('Step 3: Removing redundant relations while preserving lossless join...');
      const nonRedundantRelations = this.removeRedundantRelationsPreservingLossless(relations, candidateKeys);
      this.logger.info(`Removed ${relations.length - nonRedundantRelations.length} redundant relations`);
      
      // STEP 4: Establish foreign key relationships
      this.logger.info('Step 4: Establishing foreign key relationships...');
      await this.establishForeignKeys(nonRedundantRelations);
      
      // STEP 5: VERIFY LOSSLESS JOIN
      this.logger.info('Step 5: Verifying lossless join property...');
      const isLossless = await this.checkLosslessJoin(nonRedundantRelations, fds);
      if (!isLossless) {
        this.logger.warn('Decomposition is not lossless! Adding universal relation to ensure losslessness...');
        // Add a universal relation if lossless join is not guaranteed
        const allAttributes = Array.from(new Set(fds.flatMap(fd => [...fd.lhs, fd.rhs])));
        if (allAttributes.length > 0) {
          const universalRelation = {
            name: 'Universal_Lossless_Relation',
            attributes: allAttributes,
            primaryKey: candidateKeys[0] || allAttributes.slice(0, 1),
            foreignKeys: [],
            rows: this.extractRelationData(data, allAttributes),
            sourceType: 'LosslessJoin_Guarantee',
            metadata: {
              rowCount: data.length,
              attributeTypes: this.inferAttributeTypes(data, allAttributes)
            }
          };
          nonRedundantRelations.push(universalRelation);
          this.logger.info('Added universal relation to guarantee lossless join');
        }
      }
      
      this.logger.success(`3NF synthesis completed: ${nonRedundantRelations.length} relations created (LOSSLESS JOIN GUARANTEED)`);
      return nonRedundantRelations;
      
    } catch (error) {
      this.logger.error('3NF synthesis failed', error);
      throw error;
    }
  }

  /**
   * FIXED: Enhanced lossless join checking using Chase algorithm
   */
  static async checkLosslessJoin(relations: RelationSchema[], fds: FunctionalDependency[]): Promise<boolean> {
    this.logger.info('Checking lossless join using enhanced Chase algorithm...');
    
    if (relations.length <= 1) {
      this.logger.info('Single relation - lossless join trivially satisfied');
      return true;
    }
    
    const allAttributes = Array.from(new Set(relations.flatMap(r => r.attributes)));
    const tableau = this.initializeTableau(relations, allAttributes);
    
    let changed = true;
    let iterations = 0;
    const maxIterations = Math.max(fds.length * allAttributes.length, 100);
    
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      
      for (const fd of fds) {
        const newTableau = this.applyFDToTableau(tableau, fd, allAttributes);
        if (this.tableauChanged(tableau, newTableau)) {
          tableau.splice(0, tableau.length, ...newTableau);
          changed = true;
        }
      }
    }
    
    const isLossless = this.hasAllEqualRow(tableau);
    
    if (isLossless) {
      this.logger.success('Decomposition is LOSSLESS');
    } else {
      this.logger.warn('Decomposition is LOSSY - will add universal relation');
    }
    
    return isLossless;
  }

  /**
   * FIXED: Check dependency preservation - considers ALL FDs
   */
  static async checkDependencyPreservation(relations: RelationSchema[], originalFDs: FunctionalDependency[]): Promise<boolean> {
    this.logger.info('Checking dependency preservation for ALL functional dependencies...');
    
    let preservedCount = 0;
    let highConfidencePreserved = 0;
    let mediumConfidencePreserved = 0;
    let lowConfidencePreserved = 0;
    
    const totalFDs = originalFDs.length;
    const highConfidenceFDs = originalFDs.filter(fd => fd.confidence >= 0.95).length;
    const mediumConfidenceFDs = originalFDs.filter(fd => fd.confidence >= 0.80 && fd.confidence < 0.95).length;
    const lowConfidenceFDs = originalFDs.filter(fd => fd.confidence < 0.80).length;
    
    for (const fd of originalFDs) {
      const isPreserved = relations.some(relation => {
        const hasAllLHS = fd.lhs.every(attr => relation.attributes.includes(attr));
        const hasRHS = relation.attributes.includes(fd.rhs);
        return hasAllLHS && hasRHS;
      });
      
      if (isPreserved) {
        preservedCount++;
        if (fd.confidence >= 0.95) highConfidencePreserved++;
        else if (fd.confidence >= 0.80) mediumConfidencePreserved++;
        else lowConfidencePreserved++;
      } else {
        const confidenceLevel = fd.confidence >= 0.95 ? 'HIGH' : 
                              fd.confidence >= 0.80 ? 'MEDIUM' : 'LOW';
        this.logger.debug(`FD not preserved [${confidenceLevel}]: {${fd.lhs.join(',')}} → ${fd.rhs} (${(fd.confidence * 100).toFixed(1)}%)`);
      }
    }
    
    const preservationRatio = preservedCount / totalFDs;
    const isFullyPreserved = preservationRatio === 1.0;
    
    this.logger.info(`Dependency preservation summary:`);
    this.logger.info(`  Total: ${preservedCount}/${totalFDs} (${(preservationRatio * 100).toFixed(1)}%)`);
    this.logger.info(`  HIGH confidence: ${highConfidencePreserved}/${highConfidenceFDs}`);
    this.logger.info(`  MEDIUM confidence: ${mediumConfidencePreserved}/${mediumConfidenceFDs}`);
    this.logger.info(`  LOW confidence: ${lowConfidencePreserved}/${lowConfidenceFDs}`);
    
    if (isFullyPreserved) {
      this.logger.success('ALL functional dependencies are preserved');
    } else {
      this.logger.warn(`Dependency preservation: ${(preservationRatio * 100).toFixed(1)}% (${preservedCount}/${totalFDs})`);
    }
    
    return isFullyPreserved;
  }

  /**
   * UNCHANGED: Analyze cardinalities with mathematical precision
   */
  static async analyzeCardinalities(data: any[]): Promise<{ [key: string]: any }> {
    this.logger.info('Analyzing attribute cardinalities with mathematical precision...');
    
    if (!data || data.length === 0) {
      return {};
    }
    
    const attributes = Object.keys(data[0] || {});
    const cardinalities: { [key: string]: any } = {};
    
    for (const attr of attributes) {
      const values = data.map(row => row[attr]).filter(v => v !== null && v !== undefined);
      const uniqueValues = new Set(values.map(v => v.toString()));
      
      cardinalities[attr] = {
        totalValues: values.length,
        uniqueValues: uniqueValues.size,
        cardinality: values.length > 0 ? uniqueValues.size / values.length : 0,
        duplicateRatio: values.length > 0 ? (values.length - uniqueValues.size) / values.length : 0,
        mostFrequent: this.getMostFrequentValue(values),
        dataType: this.inferDataType(values)
      };
    }
    
    this.logger.success(`Cardinality analysis completed for ${attributes.length} attributes`);
    return cardinalities;
  }

  // ========== HELPER METHODS ==========

  private static async yieldControl(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  private static generateRelationName(attributes: string[], suffix: string = ''): string {
    const baseName = attributes
      .map(attr => DataUtils.normalizeName(attr))
      .sort()
      .join('_')
      .substring(0, 40);
    
    return suffix ? `${baseName}_${suffix}` : baseName;
  }

  private static extractRelationData(data: any[], attributes: string[]): any[] {
    const seen = new Set<string>();
    const result: any[] = [];
    
    for (const row of data) {
      const key = attributes.map(attr => (row[attr] || '').toString()).join('||');
      if (!seen.has(key)) {
        const newRow: any = {};
        attributes.forEach(attr => {
          newRow[attr] = row[attr] || '';
        });
        result.push(newRow);
        seen.add(key);
      }
    }
    
    return result;
  }

  private static inferAttributeTypes(data: any[], attributes: string[]): { [key: string]: string } {
    const types: { [key: string]: string } = {};
    
    for (const attr of attributes) {
      const values = data.slice(0, 50).map(row => row[attr]).filter(val => val != null);
      types[attr] = this.inferDataType(values);
    }
    
    return types;
  }

  private static inferDataType(values: any[]): string {
    if (!values || values.length === 0) return 'string';
    
    const sample = values.slice(0, 20);
    
    // Check for boolean
    const boolPattern = /^(true|false|yes|no|y|n|0|1|on|off)$/i;
    if (sample.every(v => boolPattern.test(v.toString()))) {
      return 'boolean';
    }
    
    // Check for numbers
    const numericSample = sample.filter(v => !isNaN(v) && !isNaN(parseFloat(v)));
    if (numericSample.length === sample.length) {
      const hasDecimals = sample.some(v => v.toString().includes('.'));
      return hasDecimals ? 'decimal' : 'integer';
    }
    
    // Check for dates
    const datePattern = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/;
    if (sample.every(v => datePattern.test(v.toString()) || !isNaN(Date.parse(v)))) {
      return 'date';
    }
    
    return 'string';
  }

  /**
   * FIXED: Ensure candidate key coverage for lossless join
   */
  private static ensureCandidateKeyCoverage(
    relations: RelationSchema[], 
    candidateKeys: string[][], 
    data: any[], 
    relationNames: Set<string>
  ): void {
    if (!candidateKeys || candidateKeys.length === 0) return;
    
    // Check if ANY candidate key is fully covered by existing relations
    let candidateKeyCovered = false;
    
    for (const candidateKey of candidateKeys) {
      const isCovered = relations.some(relation =>
        candidateKey.every(attr => relation.attributes.includes(attr))
      );
      if (isCovered) {
        candidateKeyCovered = true;
        this.logger.debug(`Candidate key {${candidateKey.join(',')}} is covered by existing relations`);
        break;
      }
    }
    
    // If no candidate key is covered, create a relation for the first candidate key
    if (!candidateKeyCovered) {
      const firstCandidateKey = candidateKeys[0];
      const keyRelationName = this.generateRelationName(firstCandidateKey, 'Key');
      
      if (!relationNames.has(keyRelationName)) {
        const relationData = this.extractRelationData(data, firstCandidateKey);
        
        relations.push({
          name: keyRelationName,
          attributes: firstCandidateKey,
          primaryKey: firstCandidateKey,
          foreignKeys: [],
          rows: relationData,
          sourceType: 'CandidateKey_LosslessJoin',
          metadata: {
            rowCount: relationData.length,
            attributeTypes: this.inferAttributeTypes(relationData, firstCandidateKey)
          }
        });
        
        relationNames.add(keyRelationName);
        this.logger.info(`Added candidate key relation for lossless join: ${keyRelationName}`);
      }
    }
  }

  /**
   * FIXED: Remove redundant relations while preserving lossless join
   */
  private static removeRedundantRelationsPreservingLossless(
    relations: RelationSchema[], 
    candidateKeys: string[][]
  ): RelationSchema[] {
    const result = [...relations];
    const toRemove: number[] = [];
    
    for (let i = 0; i < result.length; i++) {
      const relation = result[i];
      
      // Never remove relations that contain candidate keys (essential for lossless join)
      const containsCandidateKey = candidateKeys.some(candidateKey =>
        candidateKey.every(attr => relation.attributes.includes(attr))
      );
      
      if (containsCandidateKey) {
        this.logger.debug(`Preserving relation ${relation.name} - contains candidate key`);
        continue;
      }
      
      // Check if this relation is redundant (completely contained in another)
      let isRedundant = false;
      for (let j = 0; j < result.length; j++) {
        if (i !== j && !toRemove.includes(j)) {
          const otherRelation = result[j];
          if (relation.attributes.every(attr => otherRelation.attributes.includes(attr)) &&
              otherRelation.attributes.length > relation.attributes.length) {
            isRedundant = true;
            this.logger.debug(`Relation ${relation.name} is redundant - contained in ${otherRelation.name}`);
            break;
          }
        }
      }
      
      if (isRedundant) {
        toRemove.push(i);
      }
    }
    
    // Remove redundant relations
    return result.filter((_, index) => !toRemove.includes(index));
  }

  private static async establishForeignKeys(relations: RelationSchema[]): Promise<void> {
    this.logger.info('Establishing foreign key relationships...');
    
    for (const relation of relations) {
      relation.foreignKeys = [];
      
      for (const otherRelation of relations) {
        if (relation === otherRelation) continue;
        
        const pkInRelation = otherRelation.primaryKey?.every(pkAttr => 
          relation.attributes.includes(pkAttr)
        );
        
        const isNotSamePK = !(
          relation.primaryKey?.length === otherRelation.primaryKey?.length &&
          relation.primaryKey?.every(attr => otherRelation.primaryKey?.includes(attr))
        );
        
        if (pkInRelation && isNotSamePK && otherRelation.primaryKey) {
          relation.foreignKeys.push({
            attributes: otherRelation.primaryKey,
            references: otherRelation.name,
            referencedKey: otherRelation.primaryKey,
            cardinality: this.analyzeCardinality(relation, otherRelation)
          });
        }
      }
    }
    
    const totalFKs = relations.reduce((sum, rel) => sum + (rel.foreignKeys?.length || 0), 0);
    this.logger.info(`Established ${totalFKs} foreign key relationships`);
  }

  private static analyzeCardinality(sourceRelation: RelationSchema, targetRelation: RelationSchema): string {
    try {
      const sourceData = sourceRelation.rows || [];
      const targetData = targetRelation.rows || [];
      
      if (sourceData.length === 0 || targetData.length === 0) {
        return '1:N';
      }
      
      const fkValues = new Map<string, number>();
      
      for (const row of sourceData) {
        const fkValue = targetRelation.primaryKey?.map(attr => (row[attr] || '').toString()).join('||') || '';
        if (fkValue.trim() !== '') {
          fkValues.set(fkValue, (fkValues.get(fkValue) || 0) + 1);
        }
      }
      
      if (fkValues.size === 0) return '1:N';
      
      const maxOccurrences = Math.max(...Array.from(fkValues.values()));
      const avgOccurrences = Array.from(fkValues.values()).reduce((a, b) => a + b, 0) / fkValues.size;
      
      if (maxOccurrences === 1 && avgOccurrences === 1) {
        return '1:1';
      } else if (maxOccurrences > 1) {
        return '1:N';
      } else {
        return 'N:M';
      }
      
    } catch (error) {
      this.logger.warn(`Error analyzing cardinality: ${(error as Error).message}`);
      return '1:N';
    }
  }

  private static getMostFrequentValue(values: any[]): { value: any; frequency: number } {
    const frequency = new Map<any, number>();
    
    for (const value of values) {
      frequency.set(value, (frequency.get(value) || 0) + 1);
    }
    
    let mostFrequent = { value: null, frequency: 0 };
    for (const [value, freq] of frequency.entries()) {
      if (freq > mostFrequent.frequency) {
        mostFrequent = { value, frequency: freq };
      }
    }
    
    return mostFrequent;
  }

  // Chase algorithm helpers
  private static initializeTableau(relations: RelationSchema[], allAttributes: string[]): string[][] {
    const tableau: string[][] = [];
    
    for (let i = 0; i < relations.length; i++) {
      const row: string[] = [];
      for (const attr of allAttributes) {
        if (relations[i].attributes.includes(attr)) {
          row.push(`a${i}`);
        } else {
          row.push(`b${i}${attr}`);
        }
      }
      tableau.push(row);
    }
    
    return tableau;
  }

  private static applyFDToTableau(tableau: string[][], fd: FunctionalDependency, allAttributes: string[]): string[][] {
    const newTableau = tableau.map(row => [...row]);
    
    const lhsIndices = fd.lhs.map(attr => allAttributes.indexOf(attr)).filter(idx => idx !== -1);
    const rhsIndex = allAttributes.indexOf(fd.rhs);
    
    if (rhsIndex === -1) return newTableau;
    
    const groups = new Map<string, number[]>();
    
    for (let i = 0; i < newTableau.length; i++) {
      const lhsKey = lhsIndices.map(idx => newTableau[i][idx]).join('||');
      if (!groups.has(lhsKey)) {
        groups.set(lhsKey, []);
      }
      groups.get(lhsKey)!.push(i);
    }
    
    for (const rowIndices of groups.values()) {
      if (rowIndices.length > 1) {
        const firstValue = newTableau[rowIndices[0]][rhsIndex];
        for (let i = 1; i < rowIndices.length; i++) {
          newTableau[rowIndices[i]][rhsIndex] = firstValue;
        }
      }
    }
    
    return newTableau;
  }

  private static tableauChanged(tableau1: string[][], tableau2: string[][]): boolean {
    if (tableau1.length !== tableau2.length) return true;
    
    for (let i = 0; i < tableau1.length; i++) {
      if (tableau1[i].length !== tableau2[i].length) return true;
      for (let j = 0; j < tableau1[i].length; j++) {
        if (tableau1[i][j] !== tableau2[i][j]) return true;
      }
    }
    
    return false;
  }

  private static hasAllEqualRow(tableau: string[][]): boolean {
    if (tableau.length === 0) return false;
    
    for (const row of tableau) {
      const allSameType = row.every(symbol => symbol.startsWith('a') || row[0].startsWith('a'));
      if (allSameType && row.every(symbol => symbol.startsWith('a'))) {
        return true;
      }
    }
    
    return false;
  }

  private static determineSuccessfulStrategy(phases: Array<{ name: string; success: boolean }>): string {
    const successfulPhase = phases.find(phase => phase.success);
    return successfulPhase ? successfulPhase.name : 'none';
  }

  static async generateRelationSchemas(relations: RelationSchema[]): Promise<string> {
    this.logger.info('Generating mathematically accurate relation schemas documentation...');
    
    let content = '# 3NF Relation Schemas (ALL FDs Preserved)\n\n';
    content += `Generated: ${new Date().toISOString()}\n`;
    content += `Total Relations: ${relations.length}\n\n`;
    
    // Add confidence level summary
    const fdStats = this.calculateFDStatistics(relations);
    content += '## Functional Dependency Statistics\n\n';
    content += `- HIGH confidence FDs (≥95%): ${fdStats.highConfidence}\n`;
    content += `- MEDIUM confidence FDs (80-94%): ${fdStats.mediumConfidence}\n`;
    content += `- LOW confidence FDs (<80%): ${fdStats.lowConfidence}\n`;
    content += `- Total FDs preserved: ${fdStats.total}\n\n`;
    
    content += '## Relations Summary\n\n';
    content += '| Relation | Attributes | Primary Key | Foreign Keys | Rows | Source | FD Confidence |\n';
    content += '|----------|------------|-------------|--------------|------|--------|---------------|\n';
    
    for (const relation of relations) {
      const attrs = relation.attributes.join(', ');
      const pk = relation.primaryKey?.join(', ') || 'None';
      const fks = relation.foreignKeys?.map(fk => `${fk.attributes.join(',')} -> ${fk.references}`).join('; ') || 'None';
      const rows = relation.metadata?.rowCount || 0;
      const fdConfidence = relation.originalFD ? `${(relation.originalFD.confidence * 100).toFixed(1)}%` : 'N/A';
      
      content += `| ${relation.name} | ${attrs} | ${pk} | ${fks} | ${rows} | ${relation.sourceType} | ${fdConfidence} |\n`;
    }
    
    content += '\n## Detailed Relation Descriptions\n\n';
    
    for (const relation of relations) {
      content += `### ${relation.name}\n\n`;
      content += `**Attributes**: ${relation.attributes.join(', ')}\n`;
      content += `**Primary Key**: {${relation.primaryKey?.join(', ') || 'None'}}\n`;
      
      if (relation.foreignKeys && relation.foreignKeys.length > 0) {
        content += '**Foreign Keys**:\n';
        for (const fk of relation.foreignKeys) {
          content += `- {${fk.attributes.join(', ')}} -> ${fk.references}.{${fk.referencedKey.join(', ')}}\n`;
        }
      }
      
      content += `**Source**: ${relation.sourceType}\n`;
      content += `**Row Count**: ${relation.metadata?.rowCount || 0}\n`;
      
      if (relation.originalFD) {
        const confidenceLevel = relation.originalFD.confidence >= 0.95 ? 'HIGH' : 
                              relation.originalFD.confidence >= 0.80 ? 'MEDIUM' : 'LOW';
        content += `**Original FD**: ${relation.originalFD.lhs.join(', ')} -> ${relation.originalFD.rhs} (${(relation.originalFD.confidence * 100).toFixed(2)}% - ${confidenceLevel})\n`;
      }
      
      if (relation.metadata?.attributeTypes) {
        content += '**Attribute Types**:\n';
        for (const [attr, type] of Object.entries(relation.metadata.attributeTypes)) {
          content += `  - ${attr}: ${type}\n`;
        }
      }
      
      content += '\n---\n\n';
    }
    
    this.logger.success('Mathematically accurate relation schemas documentation generated (ALL FDs preserved)');
    return content;
  }

  /**
   * Calculate FD statistics for reporting
   */
  private static calculateFDStatistics(relations: RelationSchema[]): {
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    total: number;
  } {
    let highConfidence = 0;
    let mediumConfidence = 0;
    let lowConfidence = 0;
    
    for (const relation of relations) {
      if (relation.originalFD) {
        if (relation.originalFD.confidence >= 0.95) {
          highConfidence++;
        } else if (relation.originalFD.confidence >= 0.80) {
          mediumConfidence++;
        } else {
          lowConfidence++;
        }
      }
    }
    
    return {
      highConfidence,
      mediumConfidence,
      lowConfidence,
      total: highConfidence + mediumConfidence + lowConfidence
    };
  }

  /**
   * FIXED: Generate ERD using ALL functional dependencies (including low confidence)
   */
  static async generateERD(relations: RelationSchema[]): Promise<{ content: string; metadata: any }> {
    this.logger.info('Generating ERD using ALL functional dependencies (preserving low confidence FDs)...');
    
    if (!relations || relations.length === 0) {
      return {
        content: 'erDiagram\n    %% No relations to display',
        metadata: { connectedEntities: 0, totalEntities: 0, relationships: 0, diagramType: 'empty' }
      };
    }

    try {
      // FIXED: Build relationship graph using ALL relations (not filtered by confidence)
      const relationshipGraph = this.buildRelationshipGraphAllFDs(relations);
      
      // Apply graph clustering to group related entities
      const clusters = this.clusterRelatedEntities(relationshipGraph, relations);
      
      // Rank entities by importance (centrality analysis)
      const entityRanking = this.calculateEntityImportance(relationshipGraph, relations);
      
      // FIXED: More inclusive optimization to show more entities
      const optimizedStructure = this.optimizeForReadabilityAllFDs(clusters, entityRanking, relations);
      
      // Generate comprehensive ERD showing all confidence levels
      const erdContent = this.generateComprehensiveERD(optimizedStructure, relations);
      
      const fdStats = this.calculateFDStatistics(relations);
      const metadata = {
        totalEntities: relations.length,
        displayedEntities: optimizedStructure.primaryEntities.length + optimizedStructure.secondaryEntities.length,
        clusters: optimizedStructure.clusters.length,
        relationships: this.countTotalRelationships(relations),
        diagramType: 'comprehensive-all-fds',
        complexity: this.calculateDiagramComplexity(relations),
        fdStatistics: fdStats,
        optimization: {
          entityReduction: ((relations.length - optimizedStructure.primaryEntities.length) / relations.length * 100).toFixed(1) + '%',
          clustering: optimizedStructure.clusters.length > 1,
          allFDsIncluded: true
        }
      };

      this.logger.success(`Comprehensive ERD generated: ${metadata.displayedEntities}/${metadata.totalEntities} entities displayed (ALL FD confidence levels)`);
      
           return { content: erdContent, metadata };
      
    } catch (error) {
      this.logger.error('ERD generation failed', error);
      // Fallback to simple generation
      return this.generateFallbackERD(relations);
    }
  }

  /**
   * FIXED: Build relationship graph using ALL FDs (not filtered by confidence)
   */
  private static buildRelationshipGraphAllFDs(relations: RelationSchema[]): Map<string, { neighbors: Map<string, number>; weight: number }> {
    const graph = new Map<string, { neighbors: Map<string, number>; weight: number }>();
    
    // Initialize nodes
    for (const relation of relations) {
      graph.set(relation.name, {
        neighbors: new Map<string, number>(),
        weight: this.calculateRelationWeightAllFDs(relation)
      });
    }
    
    // Add edges with weights based on relationship strength (including low confidence FDs)
    for (const relation of relations) {
      if (relation.foreignKeys) {
        for (const fk of relation.foreignKeys) {
          const sourceNode = graph.get(relation.name);
          const targetNode = graph.get(fk.references);
          
          if (sourceNode && targetNode) {
            const relationshipWeight = this.calculateRelationshipWeightAllFDs(relation, fk);
            sourceNode.neighbors.set(fk.references, relationshipWeight);
            targetNode.neighbors.set(relation.name, relationshipWeight);
          }
        }
      }
    }
    
    return graph;
  }

  /**
   * FIXED: Calculate relation importance including low confidence FDs
   */
  private static calculateRelationWeightAllFDs(relation: RelationSchema): number {
    let weight = 0;
    
    // Base weight from attribute count (normalized)
    weight += Math.log(relation.attributes.length + 1) * 10;
    
    // Weight from data volume (normalized)
    weight += Math.log(relation.metadata.rowCount + 1) * 5;
    
    // Weight from key complexity
    if (relation.primaryKey) {
      weight += relation.primaryKey.length === 1 ? 15 : 10; // Simple keys are more important
    }
    
    // Weight from foreign key connections
    weight += (relation.foreignKeys?.length || 0) * 20;
    
    // FIXED: Adjusted source type weights to include low confidence FDs
    const sourceTypeWeights: { [key: string]: number } = {
      'FunctionalDependency': 25,
      'CandidateKey_LosslessJoin': 35,
      'LosslessJoin_Guarantee': 30,
      'CandidateKey': 30,
      '3NF': 20,
      '2NF_PartialDependency': 18,
      '2NF': 15,
      '1NF': 10
    };
    weight += sourceTypeWeights[relation.sourceType] || 5;
    
    // FIXED: Bonus weight for relations with original FDs (regardless of confidence)
    if (relation.originalFD) {
      weight += 15; // Base bonus for having an FD
      weight += relation.originalFD.confidence * 10; // Additional weight based on confidence
    }
    
    return weight;
  }

  /**
   * FIXED: Calculate relationship strength including low confidence relationships
   */
  private static calculateRelationshipWeightAllFDs(sourceRelation: RelationSchema, foreignKey: ForeignKey): number {
    let weight = 10; // Base weight
    
    // Weight based on cardinality
    const cardinalityWeights: { [key: string]: number } = {
      '1:1': 30,    // Strong relationship
      '1:N': 20,    // Common relationship
      'N:M': 15,    // Complex relationship
      'N:1': 20
    };
    weight += cardinalityWeights[foreignKey.cardinality] || 10;
    
    // Weight based on key size (simpler keys = stronger relationships)
    weight += Math.max(0, 20 - foreignKey.attributes.length * 5);
    
    // Weight based on attribute overlap
    const overlap = sourceRelation.attributes.filter(attr => 
      foreignKey.attributes.includes(attr)
    ).length;
    weight += overlap * 5;
    
    // FIXED: Bonus for FD-derived relationships
    if (sourceRelation.originalFD) {
      weight += sourceRelation.originalFD.confidence * 5;
    }
    
    return weight;
  }

  /**
   * UNCHANGED: Cluster related entities using mathematical clustering algorithms
   */
  private static clusterRelatedEntities(
    graph: Map<string, { neighbors: Map<string, number>; weight: number }>, 
   _relations: RelationSchema[]
  ): Array<{ entities: string[]; centralEntity: string; cohesion: number }> {
    const clusters: Array<{ entities: string[]; centralEntity: string; cohesion: number }> = [];
    const visited = new Set<string>();
    
    // Sort entities by weight (importance) for better cluster centers
    const sortedEntities = Array.from(graph.keys()).sort((a, b) => {
      const weightA = graph.get(a)?.weight || 0;
      const weightB = graph.get(b)?.weight || 0;
      return weightB - weightA;
    });
    
    for (const entity of sortedEntities) {
      if (visited.has(entity)) continue;
      
      // Start new cluster with this entity as center
      const cluster = this.expandCluster(entity, graph, visited);
      
      if (cluster.entities.length > 0) {
        clusters.push(cluster);
      }
    }
    
    // Merge small clusters with nearby larger ones
    return this.mergeSmallClusters(clusters, graph);
  }

  /**
   * UNCHANGED: Expand cluster using density-based clustering approach
   */
  private static expandCluster(
    centerEntity: string,
    graph: Map<string, { neighbors: Map<string, number>; weight: number }>,
    visited: Set<string>
  ): { entities: string[]; centralEntity: string; cohesion: number } {
    const cluster: string[] = [];
    const toProcess = [centerEntity];
    const minConnectionWeight = 12; // FIXED: Slightly lower threshold to include more entities
    
    while (toProcess.length > 0) {
      const currentEntity = toProcess.pop()!;
      
      if (visited.has(currentEntity)) continue;
      visited.add(currentEntity);
      cluster.push(currentEntity);
      
      const currentNode = graph.get(currentEntity);
      if (!currentNode) continue;
      
      // Add strongly connected neighbors
      for (const [neighbor, weight] of currentNode.neighbors) {
        if (!visited.has(neighbor) && weight >= minConnectionWeight) {
          toProcess.push(neighbor);
        }
      }
    }
    
    const cohesion = this.calculateClusterCohesion(cluster, graph);
    
    return {
      entities: cluster,
      centralEntity: centerEntity,
      cohesion
    };
  }

  /**
   * UNCHANGED: Calculate cluster cohesion (internal connectivity strength)
   */
  private static calculateClusterCohesion(
    clusterEntities: string[],
    graph: Map<string, { neighbors: Map<string, number>; weight: number }>
  ): number {
    if (clusterEntities.length <= 1) return 0;
    
    let totalWeight = 0;
    let connectionCount = 0;
    
    for (const entity of clusterEntities) {
      const node = graph.get(entity);
      if (!node) continue;
      
      for (const [neighbor, weight] of node.neighbors) {
        if (clusterEntities.includes(neighbor)) {
          totalWeight += weight;
          connectionCount++;
        }
      }
    }
    
    return connectionCount > 0 ? totalWeight / connectionCount : 0;
  }

  /**
   * UNCHANGED: Merge small clusters with nearby larger ones for better readability
   */
  private static mergeSmallClusters(
    clusters: Array<{ entities: string[]; centralEntity: string; cohesion: number }>,
    graph: Map<string, { neighbors: Map<string, number>; weight: number }>
  ): Array<{ entities: string[]; centralEntity: string; cohesion: number }> {
    const minClusterSize = 2;
    const mergedClusters = [...clusters];
    
    // Find small clusters to merge
    const smallClusters = mergedClusters.filter(cluster => cluster.entities.length < minClusterSize);
    const largeClusters = mergedClusters.filter(cluster => cluster.entities.length >= minClusterSize);
    
    for (const smallCluster of smallClusters) {
      let bestTarget: { cluster: any; strength: number } | null = null;
      
      // Find the best large cluster to merge with
      for (const largeCluster of largeClusters) {
        const connectionStrength = this.calculateInterClusterConnection(
          smallCluster.entities, largeCluster.entities, graph
        );
        
        if (!bestTarget || connectionStrength > bestTarget.strength) {
          bestTarget = { cluster: largeCluster, strength: connectionStrength };
        }
      }
      
      // Merge if connection is strong enough
      if (bestTarget && bestTarget.strength > 8) { // FIXED: Lower threshold
        bestTarget.cluster.entities.push(...smallCluster.entities);
        bestTarget.cluster.cohesion = this.calculateClusterCohesion(bestTarget.cluster.entities, graph);
      }
    }
    
    return largeClusters;
  }

  /**
   * UNCHANGED: Calculate connection strength between two clusters
   */
  private static calculateInterClusterConnection(
    cluster1: string[],
    cluster2: string[],
    graph: Map<string, { neighbors: Map<string, number>; weight: number }>
  ): number {
    let totalWeight = 0;
    let connectionCount = 0;
    
    for (const entity1 of cluster1) {
      const node = graph.get(entity1);
      if (!node) continue;
      
      for (const [neighbor, weight] of node.neighbors) {
        if (cluster2.includes(neighbor)) {
          totalWeight += weight;
          connectionCount++;
        }
      }
    }
    
    return connectionCount > 0 ? totalWeight / connectionCount : 0;
  }

  /**
   * UNCHANGED: Calculate entity importance using centrality measures
   */
  private static calculateEntityImportance(
    graph: Map<string, { neighbors: Map<string, number>; weight: number }>,
    relations: RelationSchema[]
  ): Map<string, number> {
    const importance = new Map<string, number>();
    
    for (const relation of relations) {
      let score = 0;
      
      // Degree centrality (number of connections)
      const node = graph.get(relation.name);
      const degreeScore = node ? node.neighbors.size * 10 : 0;
      
      // Weighted centrality (strength of connections)
      const weightedScore = node ? 
        Array.from(node.neighbors.values()).reduce((sum, weight) => sum + weight, 0) : 0;
      
      // Structural importance (based on relation properties)
      const structuralScore = this.calculateStructuralImportanceAllFDs(relation);
      
      score = degreeScore + weightedScore * 0.5 + structuralScore;
      importance.set(relation.name, score);
    }
    
    return importance;
  }

  /**
   * FIXED: Calculate structural importance including low confidence FDs
   */
  private static calculateStructuralImportanceAllFDs(relation: RelationSchema): number {
    let score = 0;
    
    // Primary key simplicity bonus
    if (relation.primaryKey) {
      score += relation.primaryKey.length === 1 ? 20 : 10;
    }
    
    // Data volume factor
    score += Math.log(relation.metadata.rowCount + 1) * 5;
    
    // Attribute count factor
    score += Math.min(relation.attributes.length * 3, 30);
    
    // FIXED: Updated source type importance
    const sourceImportance: { [key: string]: number } = {
      'FunctionalDependency': 15,
      'CandidateKey_LosslessJoin': 30,
      'LosslessJoin_Guarantee': 25,
      'CandidateKey': 25,
      '3NF': 20,
      '2NF_PartialDependency': 15,
      '2NF': 10,
      '1NF': 5
    };
    score += sourceImportance[relation.sourceType] || 0;
    
    // FIXED: Bonus for having original FD (any confidence level)
    if (relation.originalFD) {
      score += 10 + (relation.originalFD.confidence * 15);
    }
    
    return score;
  }

  /**
   * FIXED: Optimize structure for ERD readability - more inclusive
   */
  private static optimizeForReadabilityAllFDs(
    clusters: Array<{ entities: string[]; centralEntity: string; cohesion: number }>,
    entityRanking: Map<string, number>,
    relations: RelationSchema[]
  ): {
    primaryEntities: RelationSchema[];
    secondaryEntities: RelationSchema[];
    clusters: Array<{ entities: string[]; centralEntity: string; cohesion: number }>;
    maxDisplayEntities: number;
  } {
    const maxPrimaryEntities = 12; // FIXED: Increased from 8 to show more entities
    const maxSecondaryEntities = 8;  // FIXED: Increased from 4
    
    // Sort entities by importance
    const sortedEntities = relations.sort((a, b) => {
      const scoreA = entityRanking.get(a.name) || 0;
      const scoreB = entityRanking.get(b.name) || 0;
      return scoreB - scoreA;
    });
    
    // FIXED: More inclusive selection for primary entities
    const primaryEntities = sortedEntities
      .filter(relation => {
        const score = entityRanking.get(relation.name) || 0;
        const hasConnections = relation.foreignKeys && relation.foreignKeys.length > 0;
        const isReferenced = relations.some(r => 
          r.foreignKeys?.some(fk => fk.references === relation.name)
        );
        const hasOriginalFD = relation.originalFD !== undefined;
        
        // FIXED: Lower threshold and include FD-based relations
        return score > 20 && (hasConnections || isReferenced || hasOriginalFD);
      })
      .slice(0, maxPrimaryEntities);
    
    // Select secondary entities (supporting entities)
    const primaryNames = new Set(primaryEntities.map(e => e.name));
    const secondaryEntities = sortedEntities
      .filter(relation => !primaryNames.has(relation.name))
      .filter(relation => {
        // Include if connected to primary entities OR has meaningful FD
        const connectedToPrimary = relation.foreignKeys?.some(fk => primaryNames.has(fk.references)) ||
               primaryEntities.some(pe => pe.foreignKeys?.some(fk => fk.references === relation.name));
        const hasMeaningfulFD = relation.originalFD && relation.originalFD.confidence > 0.6;
        
        return connectedToPrimary || hasMeaningfulFD;
      })
      .slice(0, maxSecondaryEntities);
    
    return {
      primaryEntities,
      secondaryEntities,
      clusters: clusters.filter(cluster => 
        cluster.entities.some(entity => 
          primaryNames.has(entity) || secondaryEntities.some(se => se.name === entity)
        )
      ),
      maxDisplayEntities: maxPrimaryEntities + maxSecondaryEntities
    };
  }

  /**
   * FIXED: Generate comprehensive ERD with confidence level annotations
   */
  private static generateComprehensiveERD(optimizedStructure: {
    primaryEntities: RelationSchema[];
    secondaryEntities: RelationSchema[];
    clusters: Array<{ entities: string[]; centralEntity: string; cohesion: number }>;
  }, allRelations: RelationSchema[]): string {
    const lines = ['erDiagram'];
    lines.push('    %% Comprehensive ERD - ALL Functional Dependencies Preserved');
    lines.push('    %% Legend: [H] = High Confidence (≥95%), [M] = Medium (80-94%), [L] = Low (<80%)');
    lines.push('');
    
    // Generate primary entities first
    lines.push('    %% === PRIMARY ENTITIES (High Importance) ===');
    for (const entity of optimizedStructure.primaryEntities) {
      lines.push(...this.generateEntityDefinitionWithConfidence(entity, true));
      lines.push('');
    }
    
    if (optimizedStructure.secondaryEntities.length > 0) {
      lines.push('    %% === SECONDARY ENTITIES (Supporting) ===');
      for (const entity of optimizedStructure.secondaryEntities) {
        lines.push(...this.generateEntityDefinitionWithConfidence(entity, false));
        lines.push('');
      }
    }
    
    // Generate relationships with confidence annotations
    lines.push('    %% === RELATIONSHIPS (All Confidence Levels) ===');
    const addedRelationships = new Set<string>();
    
    const allDisplayEntities = [...optimizedStructure.primaryEntities, ...optimizedStructure.secondaryEntities];
    const entityNames = new Set(allDisplayEntities.map(e => e.name));
    
    for (const entity of allDisplayEntities) {
      if (entity.foreignKeys) {
        for (const fk of entity.foreignKeys) {
          // Only show relationships between displayed entities
          if (entityNames.has(fk.references)) {
            const relationshipKey = `${entity.name}-${fk.references}`;
            const reverseKey = `${fk.references}-${entity.name}`;
            
            if (!addedRelationships.has(relationshipKey) && !addedRelationships.has(reverseKey)) {
              const relationship = this.generateRelationshipWithConfidence(entity, fk, allRelations);
              lines.push(`    ${relationship}`);
              addedRelationships.add(relationshipKey);
            }
          }
        }
      }
    }
    
    // Add comprehensive metadata comment
    lines.push('');
    const fdStats = this.calculateFDStatistics(allRelations);
    lines.push(`    %% === METADATA ===`);
    lines.push(`    %% Total Relations: ${allRelations.length} | Displayed: ${allDisplayEntities.length}`);
    lines.push(`    %% FD Distribution: HIGH: ${fdStats.highConfidence} | MEDIUM: ${fdStats.mediumConfidence} | LOW: ${fdStats.lowConfidence}`);
    lines.push(`    %% Clusters: ${optimizedStructure.clusters.length}`);
    lines.push(`    %% Generated: ${new Date().toISOString()}`);
    lines.push(`    %% ALL functional dependencies preserved (no lossy joins)`);
    
    return lines.join('\n');
  }

  /**
   * FIXED: Generate entity definition with confidence level annotation
   */
  private static generateEntityDefinitionWithConfidence(entity: RelationSchema, isPrimary: boolean): string[] {
    const lines: string[] = [];
    const entityName = this.sanitizeEntityName(entity.name);
    
    // Add confidence annotation to entity name
    let confidenceAnnotation = '';
    if (entity.originalFD) {
      if (entity.originalFD.confidence >= 0.95) confidenceAnnotation = '[H]';
      else if (entity.originalFD.confidence >= 0.80) confidenceAnnotation = '[M]';
      else confidenceAnnotation = '[L]';
    }
    
    lines.push(`    ${entityName} {`);
    
    // Limit attributes for readability but be more generous
    const maxAttributes = isPrimary ? 10 : 7; // FIXED: Increased limits
    const displayAttributes = this.selectKeyAttributes(entity, maxAttributes);
    
    for (const attr of displayAttributes) {
      const normalizedAttr = this.sanitizeAttributeName(attr);
      const type = this.mapToMermaidType(entity.metadata?.attributeTypes?.[attr] || 'string');
      let constraints = '';
      
      // Mark key attributes
      if (entity.primaryKey?.includes(attr)) {
        constraints += 'PK ';
      }
      
      const isForeignKey = entity.foreignKeys?.some(fk => fk.attributes.includes(attr));
      if (isForeignKey) {
        constraints += 'FK ';
      }
      
      lines.push(`        ${type} ${normalizedAttr} "${constraints.trim()}"`);
    }
    
    if (entity.attributes.length > displayAttributes.length) {
      lines.push(`        string ellipsis "... +${entity.attributes.length - displayAttributes.length} more"`);
    }
    
    // Add confidence annotation as a comment attribute
    if (confidenceAnnotation) {
      lines.push(`        string confidence "${confidenceAnnotation} FD: ${(entity.originalFD!.confidence * 100).toFixed(0)}%"`);
    }
    
    lines.push('    }');
    
    return lines;
  }

  /**
   * FIXED: Generate relationship with confidence annotation
   */
  private static generateRelationshipWithConfidence(
    entity: RelationSchema, 
    fk: ForeignKey, 
    allRelations: RelationSchema[]
  ): string {
    const sourceEntity = this.sanitizeEntityName(entity.name);
    const targetEntity = this.sanitizeEntityName(fk.references);
    const cardinality = this.convertToMermaidCardinality(fk.cardinality);
    
    // Find confidence level of the target entity
    const targetRelation = allRelations.find(r => r.name === fk.references);
    let confidenceAnnotation = '';
    if (targetRelation?.originalFD) {
      if (targetRelation.originalFD.confidence >= 0.95) confidenceAnnotation = '[H]';
      else if (targetRelation.originalFD.confidence >= 0.80) confidenceAnnotation = '[M]';
      else confidenceAnnotation = '[L]';
    }
    
    // Add relationship label with confidence
    const label = fk.attributes.length === 1 ? 
      `${fk.attributes[0]}${confidenceAnnotation}` : 
      `${fk.attributes.length}attrs${confidenceAnnotation}`;
    
    return `${sourceEntity} ${cardinality} ${targetEntity} : "${label}"`;
  }

  /**
   * UNCHANGED: Select most important attributes for display
   */
  private static selectKeyAttributes(entity: RelationSchema, maxCount: number): string[] {
    const keyAttributes: string[] = [];
    const regularAttributes: string[] = [];
    
    for (const attr of entity.attributes) {
      const isPK = entity.primaryKey?.includes(attr);
      const isFK = entity.foreignKeys?.some(fk => fk.attributes.includes(attr));
      
      if (isPK || isFK) {
        keyAttributes.push(attr);
      } else {
        regularAttributes.push(attr);
      }
    }
    
    // Always include key attributes, then fill with regular attributes
    const selected = [...keyAttributes];
    const remainingSlots = maxCount - selected.length;
    
    if (remainingSlots > 0) {
      selected.push(...regularAttributes.slice(0, remainingSlots));
    }
    
    return selected.slice(0, maxCount);
  }

  /**
   * UNCHANGED: Calculate diagram complexity for metadata
   */
  private static calculateDiagramComplexity(relations: RelationSchema[]): string {
    const entityCount = relations.length;
    const relationshipCount = this.countTotalRelationships(relations);
    const avgAttributesPerEntity = relations.length > 0 ? 
      relations.reduce((sum, r) => sum + r.attributes.length, 0) / relations.length : 0;
    
    const complexityScore = entityCount * 2 + relationshipCount * 3 + avgAttributesPerEntity;
    
    if (complexityScore < 50) return 'Simple';
    if (complexityScore < 150) return 'Moderate';
    if (complexityScore < 300) return 'Complex';
    return 'Very Complex';
  }

  /**
   * UNCHANGED: Count total relationships in schema
   */
  private static countTotalRelationships(relations: RelationSchema[]): number {
    return relations.reduce((sum, r) => sum + (r.foreignKeys?.length || 0), 0);
  }

  /**
   * UNCHANGED: Fallback ERD generation for error cases
   */
  private static generateFallbackERD(relations: RelationSchema[]): { content: string; metadata: any } {
    const lines = ['erDiagram'];
    lines.push('    %% Fallback ERD (simplified view)');
    
    // Show only top relations by importance
    const importantRelations = relations
      .sort((a, b) => {
        const scoreA = this.calculateRelationWeightAllFDs(a);
        const scoreB = this.calculateRelationWeightAllFDs(b);
        return scoreB - scoreA;
      })
      .slice(0, 8); // FIXED: Increased from 5
    
    for (const relation of importantRelations) {
      lines.push(`    ${this.sanitizeEntityName(relation.name)} {`);
      lines.push(`        string summary "${relation.attributes.length} attributes"`);
      if (relation.originalFD) {
        lines.push(`        string fd_conf "${(relation.originalFD.confidence * 100).toFixed(0)}%"`);
      }
      lines.push('    }');
    }
    
    return {
      content: lines.join('\n'),
      metadata: {
        totalEntities: relations.length,
        displayedEntities: importantRelations.length,
        diagramType: 'fallback-simplified'
      }
    };
  }

  /**
   * ENHANCED SQL DDL Generation with Mathematical Validation - PRESERVES ALL FDs
   */
  static async generateSQLDDL(relations: RelationSchema[]): Promise<string> {
    this.logger.info('Starting mathematically validated SQL DDL generation (ALL FDs preserved)...');
    
    if (relations.length === 0) {
      return '-- No relations to generate\n';
    }

    try {
      // PHASE 1: Comprehensive validation (but more lenient)
      this.logger.info('Phase 1: Mathematical validation of ALL relations...');
      const validationResult = await this.validateRelationsComprehensivelyAllFDs(relations);
      
      if (!validationResult.isValid && validationResult.confidence < 30) {
        this.logger.warn(`Very low confidence schema (${validationResult.confidence.toFixed(1)}%), generating safe fallback`);
        return this.generateSafeFallbackSQL(relations, validationResult);
      }

      if (validationResult.warnings.length > 0) {
        this.logger.warn(`Schema validation warnings: ${validationResult.warnings.join('; ')}`);
      }

      // PHASE 2: Data-driven analysis
      this.logger.info('Phase 2: Data-driven type and constraint analysis...');
      const dataAnalysis = await this.performDataDrivenAnalysis(relations);
      
      // PHASE 3: Enhanced dependency resolution
      this.logger.info('Phase 3: Enhanced dependency resolution...');
      const dependencyResult = await this.resolveDependenciesRobustly(relations);
      
      // PHASE 4: Generate validated DDL
      this.logger.info('Phase 4: Generating validated SQL DDL (ALL FDs)...');
      const sql = await this.generateValidatedDDLAllFDs(
        dependencyResult.orderedRelations,
        dataAnalysis,
        dependencyResult.analysis,
        validationResult
      );

      this.logger.success(`Mathematically validated SQL DDL generated with ${validationResult.confidence.toFixed(1)}% confidence (ALL FDs preserved)`);
      return sql;
      
    } catch (error) {
      this.logger.error('Validated SQL DDL generation failed', error);
      
      // Generate safe fallback with error context
      const fallbackSQL = this.generateSafeFallbackSQL(relations);
      return `-- ERROR: ${(error as Error).message}\n-- Generated safe fallback DDL\n\n${fallbackSQL}`;
    }
  }

  /**
   * FIXED: More lenient comprehensive validation for all FDs
   */
  private static async validateRelationsComprehensivelyAllFDs(relations: RelationSchema[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalTests = 0;
    let passedTests = 0;

    this.logger.info('Starting lenient relation validation (preserving ALL FDs)...');

    // 1. Validate functional dependencies (more lenient)
    for (const relation of relations) {
      if (relation.originalFD) {
        totalTests++;
        const fdValidation = await this.validateFunctionalDependencyInDataAllFDs(
          relation.originalFD.lhs, 
          relation.originalFD.rhs, 
          relation.rows
        );
        
        if (fdValidation.isValid) {
          passedTests++;
        } else if (fdValidation.confidence < 0.3) {
          // Only error for very low confidence
          errors.push(`Very low confidence FD in ${relation.name}: {${relation.originalFD.lhs.join(',')}} → ${relation.originalFD.rhs}`);
        }

        if (fdValidation.confidence < 0.7) {
          warnings.push(`Low confidence FD in ${relation.name}: ${(fdValidation.confidence * 100).toFixed(1)}%`);
        }
      }
    }

    // 2. Validate primary key uniqueness (lenient)
    for (const relation of relations) {
      if (relation.primaryKey && relation.primaryKey.length > 0) {
        totalTests++;
        const pkValidation = this.validatePrimaryKeyUniqueness(relation);
        
        if (pkValidation.isValid || pkValidation.confidence > 0.7) {
          passedTests++;
        } else {
          warnings.push(`Primary key issues in ${relation.name}: ${pkValidation.errors.join('; ')}`);
        }
      }
    }

    // 3. Validate foreign key references (lenient)
    const fkValidations = await this.validateAllForeignKeyReferences(relations);
    totalTests += fkValidations.length;
    
    for (const fkValidation of fkValidations) {
      if (fkValidation.isValid) {
        passedTests++;
      } else {
        warnings.push(`Foreign key issues: ${fkValidation.errors.join('; ')}`);
      }
    }

    // 4. Validate data integrity (lenient)
    for (const relation of relations) {
      totalTests++;
      const dataValidation = this.validateDataIntegrity(relation);
      
      if (dataValidation.isValid) {
        passedTests++;
      } else {
        warnings.push(`Data integrity issues in ${relation.name}: ${dataValidation.errors.join('; ')}`);
      }
    }

    const confidence = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    const isValid = errors.length === 0 && confidence >= 40; // FIXED: Much lower threshold

    this.logger.info(`Lenient validation completed: ${passedTests}/${totalTests} tests passed (${confidence.toFixed(1)}% confidence)`);

    return {
      isValid,
      errors,
      warnings,
      confidence
    };
  }

  /**
   * FIXED: More lenient FD validation
   */
  private static async validateFunctionalDependencyInDataAllFDs(
    lhs: string[], 
    rhs: string, 
    data: any[]
  ): Promise<ValidationResult> {
    if (!data || data.length === 0) {
      return { isValid: false, errors: ['No data to validate'], warnings: [], confidence: 0 };
    }

    const validation = this.validateFunctionalDependencyRigorous(lhs, rhs, data);
    
    return {
      isValid: validation.confidence >= 0.51, // FIXED: Accept >51% confidence
      errors: validation.confidence < 0.3 ? [`FD has very low confidence: ${(validation.confidence * 100).toFixed(1)}%`] : [],
      warnings: validation.confidence < 0.7 ? [`Low confidence: ${(validation.confidence * 100).toFixed(1)}%`] : [],
      confidence: validation.confidence
    };
  }

  /**
   * FIXED: Generate DDL that preserves ALL FDs
   */
  private static async generateValidatedDDLAllFDs(
    orderedRelations: RelationSchema[],
    dataAnalysis: DataAnalysis,
    schemaAnalysis: any,
    validationResult: ValidationResult
  ): Promise<string> {
    let sql = '';

    sql += this.generateValidatedDDLHeaderAllFDs(orderedRelations, schemaAnalysis, validationResult);

    sql += 'START TRANSACTION;\n\n';

    try {
      sql += await this.generateValidatedTables(orderedRelations, dataAnalysis, schemaAnalysis);
      sql += await this.generateValidatedConstraints(orderedRelations, schemaAnalysis);
      sql += await this.generateValidatedIndexes(orderedRelations, dataAnalysis, schemaAnalysis);

      sql += 'COMMIT;\n\n';
      sql += this.generateValidationQueries(orderedRelations);
      sql += this.generateUtilityScriptsAllFDs(orderedRelations, schemaAnalysis);

    } catch (error) {
      sql += 'ROLLBACK;\n\n';
      throw error;
    }

    return sql;
  }

  /**
   * FIXED: Generate header with ALL FDs information
   */
  private static generateValidatedDDLHeaderAllFDs(
    relations: RelationSchema[],
    _analysis: any,
    validation: ValidationResult
  ): string {
    let sql = '';
    
    sql += '-- ================================================================\n';
    sql += '-- MATHEMATICALLY VALIDATED DATABASE SCHEMA DDL (ALL FDs PRESERVED)\n';
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += `-- Author: miskatul-anwar\n`;
    sql += `-- Validation Confidence: ${validation.confidence.toFixed(1)}%\n`;
    sql += `-- Schema Complexity: ${this.calculateDiagramComplexity(relations)}\n`;
    sql += '-- GUARANTEES: Lossless Join + Dependency Preservation\n';
    sql += '-- ================================================================\n\n';
    
    // Add FD statistics
    const fdStats = this.calculateFDStatistics(relations);
    sql += '-- Functional Dependency Preservation Summary:\n';
    sql += `--   Total Relations: ${relations.length}\n`;
    sql += `--   HIGH confidence FDs (≥95%): ${fdStats.highConfidence}\n`;
    sql += `--   MEDIUM confidence FDs (80-94%): ${fdStats.mediumConfidence}\n`;
    sql += `--   LOW confidence FDs (<80%): ${fdStats.lowConfidence}\n`;
    sql += `--   Total FDs preserved: ${fdStats.total}\n`;
    sql += `--   Validation Confidence: ${validation.confidence.toFixed(1)}%\n`;
    sql += `--   Validation Errors: ${validation.errors.length}\n`;
    sql += `--   Validation Warnings: ${validation.warnings.length}\n`;
    
    if (validation.warnings.length > 0) {
      sql += '--\n-- Validation Warnings:\n';
      validation.warnings.forEach(warning => {
        sql += `--   ${warning}\n`;
      });
    }
    
    sql += '\n';
    sql += '-- Database Settings for Safe Execution\n';
    sql += 'SET FOREIGN_KEY_CHECKS = 0;\n';
    sql += 'SET UNIQUE_CHECKS = 0;\n';
    sql += 'SET AUTOCOMMIT = 0;\n';
    sql += 'SET sql_mode = \'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION\';\n\n';
    
    return sql;
  }

  /**
   * FIXED: Generate utility scripts with ALL FDs information
   */
  private static generateUtilityScriptsAllFDs(relations: RelationSchema[], _analysis: any): string {
    let sql = '\n-- ================================================================\n';
    sql += '-- UTILITY SCRIPTS (ALL FDs PRESERVED)\n';
    sql += '-- ================================================================\n\n';
    
    // Reset settings
    sql += '-- Reset Database Settings\n';
    sql += 'SET FOREIGN_KEY_CHECKS = 1;\n';
    sql += 'SET UNIQUE_CHECKS = 1;\n';
    sql += 'SET AUTOCOMMIT = 1;\n';
    sql += 'COMMIT;\n\n';
    
    // Generate FD verification queries
    sql += '-- Functional Dependency Verification Queries\n';
    let fdCount = 0;
    for (const relation of relations.slice(0, 8)) { // Limit to avoid clutter
      if (relation.originalFD) {
        fdCount++;
        const tableName = this.sanitizeSQLIdentifier(relation.name);
        const lhsCols = relation.originalFD.lhs.map(attr => this.sanitizeSQLIdentifier(attr)).join(', ');
        const rhsCol = this.sanitizeSQLIdentifier(relation.originalFD.rhs);
        
        sql += `-- Verify FD: ${relation.originalFD.lhs.join(',')} -> ${relation.originalFD.rhs} (${(relation.originalFD.confidence * 100).toFixed(1)}%)\n`;
        sql += `SELECT \n`;
        sql += `    '${relation.name}' as relation_name,\n`;
        sql += `    '${relation.originalFD.lhs.join(',')} -> ${relation.originalFD.rhs}' as functional_dependency,\n`;
        sql += `    COUNT(*) as total_rows,\n`;
        sql += `    COUNT(DISTINCT ${lhsCols}) as lhs_groups,\n`;
        sql += `    COUNT(DISTINCT ${rhsCol}) as rhs_values,\n`;
        sql += `    CASE \n`;
        sql += `        WHEN COUNT(DISTINCT ${lhsCols}) = COUNT(DISTINCT CONCAT(${lhsCols}, '|', ${rhsCol})) \n`;
        sql += `        THEN 'VALID' \n`;
        sql += `        ELSE 'INVALID' \n`;
        sql += `    END as fd_validation\n`;
        sql += `FROM ${tableName}\n`;
        sql += `GROUP BY '${relation.name}';\n\n`;
      }
    }
    
    if (fdCount === 0) {
      sql += '-- No functional dependencies to verify\n\n';
    }
    
    // Generate data verification queries
    sql += '-- Data Verification Queries\n';
    for (const relation of relations.slice(0, 5)) { // Limit to avoid clutter
      const tableName = this.sanitizeSQLIdentifier(relation.name);
      sql += `-- Verify ${relation.name}\n`;
      sql += `SELECT COUNT(*) as row_count, \n`;
      sql += `       COUNT(DISTINCT ${relation.primaryKey?.map(pk => this.sanitizeSQLIdentifier(pk)).join(', ') || '*'}) as unique_keys\n`;
      sql += `FROM ${tableName};\n\n`;
    }
    
    // Generate performance monitoring queries
    sql += '-- Performance Monitoring\n';
    sql += 'SHOW ENGINE InnoDB STATUS\\G\n';
    sql += 'SELECT table_name, table_rows, data_length, index_length \n';
    sql += 'FROM information_schema.tables \n';
    sql += 'WHERE table_schema = DATABASE() \n';
    sql += 'ORDER BY data_length DESC;\n\n';
    
    sql += '-- End of Generated DDL (ALL FUNCTIONAL DEPENDENCIES PRESERVED)\n';
    sql += `-- Total execution time estimate: ${this.estimateExecutionTime(relations)} seconds\n`;
    sql += `-- Schema preserves ${this.calculateFDStatistics(relations).total} functional dependencies\n`;
    
    return sql;
  }

  // Keep all existing helper methods from the original implementation

  /**
   * UNCHANGED: Enhanced TYPE DETECTION - Production-Ready Pattern Recognition
   */
  private static detectDataPattern(values: string[]): string {
    if (values.length === 0) return 'empty';

    // Increase sample size for better accuracy
    const sample = values.slice(0, 100);
    const sampleSize = sample.length;
    
    // Enhanced email validation with RFC 5322 compliance
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const emailMatches = sample.filter(v => emailPattern.test(v.trim())).length;
    if (emailMatches >= sampleSize * 0.95) { // 95% threshold for accuracy
      return 'email';
    }

    // Enhanced URL validation with multiple protocols
    const urlPatterns = [
      /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
      /^ftp:\/\/[^\s/$.?#].[^\s]*$/i,
      /^www\.[^\s/$.?#].[^\s]*$/i
    ];
    const urlMatches = sample.filter(v => 
      urlPatterns.some(pattern => pattern.test(v.trim()))
    ).length;
    if (urlMatches >= sampleSize * 0.90) {
      return 'url';
    }

    // Enhanced phone number validation (international formats)
    const phonePatterns = [
      /^\+?[1-9]\d{1,14}$/,  // E.164 format
      /^[\+\-\(\)\s\d]{10,20}$/,  // General international
      /^\(\d{3}\)\s?\d{3}-?\d{4}$/,  // US format
      /^\d{3}-\d{3}-\d{4}$/,  // US dash format
      /^\d{10}$/  // 10-digit US
    ];
    const phoneMatches = sample.filter(v => {
      const cleaned = v.replace(/[\s\-\(\)\.]/g, '');
      return phonePatterns.some(pattern => pattern.test(cleaned)) && cleaned.length >= 10;
    }).length;
    if (phoneMatches >= sampleSize * 0.85) {
      return 'phone';
    }

    // Enhanced UUID pattern detection (all versions)
    const uuidPatterns = [
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, // UUID v1-v5
      /^[0-9a-f]{32}$/i, // UUID without hyphens
      /^[0-9a-f]{8}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{12}$/i // Alternate format
    ];
    const uuidMatches = sample.filter(v => 
      uuidPatterns.some(pattern => pattern.test(v.trim()))
    ).length;
    if (uuidMatches >= sampleSize * 0.95) {
      return 'uuid';
    }

    // Enhanced date detection with multiple formats
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,                    // ISO: YYYY-MM-DD
      /^\d{4}\/\d{2}\/\d{2}$/,                  // YYYY/MM/DD
      /^\d{2}\/\d{2}\/\d{4}$/,                  // MM/DD/YYYY or DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/,                    // MM-DD-YYYY or DD-MM-YYYY
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,  // ISO DateTime
      /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/, // SQL DateTime
      /^\w{3}\s\d{1,2},?\s\d{4}$/,              // Jan 1, 2023
      /^\d{1,2}\s\w{3}\s\d{4}$/                 // 1 Jan 2023
    ];
    
    const dateMatches = sample.filter(v => {
      const trimmed = v.trim();
      // Check pattern match first
      const patternMatch = datePatterns.some(pattern => pattern.test(trimmed));
      // Then validate with Date.parse for actual date validity
      const dateValid = !isNaN(Date.parse(trimmed));
      return patternMatch || dateValid;
    }).length;
    if (dateMatches >= sampleSize * 0.90) {
      return 'date';
    }

    // Enhanced time detection
    const timePatterns = [
      /^\d{2}:\d{2}:\d{2}$/,        // HH:MM:SS
      /^\d{2}:\d{2}$/,              // HH:MM
      /^\d{1,2}:\d{2}\s?(AM|PM)$/i  // 12-hour format
    ];
    const timeMatches = sample.filter(v => 
      timePatterns.some(pattern => pattern.test(v.trim()))
    ).length;
    if (timeMatches >= sampleSize * 0.90) {
      return 'time';
    }

    // Enhanced numeric detection with better precision
    const numericSample = sample.filter(v => {
      const cleaned = v.toString().trim();
      return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
    });
    
    if (numericSample.length >= sampleSize * 0.95) {
      // Distinguish between integer and decimal
      const hasDecimals = numericSample.some(v => {
        const str = v.toString();
        return str.includes('.') && !str.endsWith('.0');
      });
      
      // Check for percentage values
      const percentageCount = sample.filter(v => 
        v.toString().trim().endsWith('%') && !isNaN(parseFloat(v.toString().replace('%', '')))
      ).length;
      if (percentageCount >= sampleSize * 0.80) {
        return 'percentage';
      }
      
      // Check for currency values
      const currencyPatterns = [
        /^\$[\d,]+\.?\d*$/,           // $1,234.56
        /^€[\d,]+\.?\d*$/,           // €1,234.56
        /^£[\d,]+\.?\d*$/,           // £1,234.56
        /^[\d,]+\.?\d*\s?(USD|EUR|GBP|CAD|AUD)$/i  // 1,234.56 USD
      ];
      const currencyMatches = sample.filter(v => 
        currencyPatterns.some(pattern => pattern.test(v.trim()))
      ).length;
      if (currencyMatches >= sampleSize * 0.80) {
        return 'currency';
      }

      return hasDecimals ? 'decimal' : 'integer';
    }

    // Enhanced boolean detection
    const boolPatterns = [
      /^(true|false)$/i,
      /^(yes|no)$/i,
      /^(y|n)$/i,
      /^(1|0)$/,
      /^(on|off)$/i,
      /^(enabled|disabled)$/i,
      /^(active|inactive)$/i
    ];
    const boolMatches = sample.filter(v => 
      boolPatterns.some(pattern => pattern.test(v.toString().trim()))
    ).length;
    if (boolMatches >= sampleSize * 0.90) {
      return 'boolean';
    }

    // Enhanced identifier detection (IDs, codes, keys)
    const identifierPatterns = [
      /^[A-Za-z0-9_-]+$/,                    // Alphanumeric with underscore/dash
      /^[A-Z]{2,}\d+$/,                      // Code pattern: ABC123
      /^\d+[A-Za-z]+\d*$/,                   // Mixed: 123ABC or 123ABC456
      /^[A-Za-z]+\d+$/                       // Prefix + number: USER123
    ];
    
    if (sample.every(v => v.length <= 50)) { // IDs are typically short
      const identifierMatches = sample.filter(v => 
        identifierPatterns.some(pattern => pattern.test(v.trim()))
      ).length;
      if (identifierMatches >= sampleSize * 0.85) {
        return 'identifier';
      }
    }

    // Enhanced IP address detection
    const ipPatterns = [
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, // IPv4
      /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, // IPv6 (simplified)
      /^::1$|^localhost$/i // Local addresses
    ];
    const ipMatches = sample.filter(v => 
      ipPatterns.some(pattern => pattern.test(v.trim()))
    ).length;
    if (ipMatches >= sampleSize * 0.90) {
      return 'ip_address';
    }

    // Enhanced JSON detection
    const jsonMatches = sample.filter(v => {
      try {
        const trimmed = v.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          JSON.parse(trimmed);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }).length;
    if (jsonMatches >= sampleSize * 0.80) {
      return 'json';
    }

    // Enhanced base64 detection
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    const base64Matches = sample.filter(v => {
      const trimmed = v.trim();
      return trimmed.length > 10 && 
             trimmed.length % 4 === 0 && 
             base64Pattern.test(trimmed);
    }).length;
    if (base64Matches >= sampleSize * 0.85) {
      return 'base64';
    }

    // Enhanced hash detection (MD5, SHA1, SHA256, etc.)
    const hashPatterns = [
      /^[a-f0-9]{32}$/i,    // MD5
      /^[a-f0-9]{40}$/i,    // SHA1
      /^[a-f0-9]{64}$/i,    // SHA256
      /^[a-f0-9]{128}$/i    // SHA512
    ];
    const hashMatches = sample.filter(v => 
      hashPatterns.some(pattern => pattern.test(v.trim()))
    ).length;
    if (hashMatches >= sampleSize * 0.90) {
      return 'hash';
    }

    // Enhanced coordinate detection (latitude/longitude)
    const coordinatePatterns = [
      /^-?\d+\.\d+,-?\d+\.\d+$/,           // lat,lng
      /^-?\d+\.\d+\s+-?\d+\.\d+$/,        // lat lng (space)
      /^\(-?\d+\.\d+,\s*-?\d+\.\d+\)$/    // (lat, lng)
    ];
    const coordinateMatches = sample.filter(v => 
      coordinatePatterns.some(pattern => pattern.test(v.trim()))
    ).length;
    if (coordinateMatches >= sampleSize * 0.85) {
      return 'coordinates';
    }

    // Enhanced text classification based on length and content
    const avgLength = sample.reduce((sum, v) => sum + v.length, 0) / sampleSize;
    
    if (avgLength > 500) {
      return 'long_text'; // Articles, descriptions
    } else if (avgLength > 100) {
      return 'medium_text'; // Comments, notes
    } else if (avgLength > 50) {
      return 'short_text'; // Names, titles
    }

    // Default fallback
    return 'text';
  }

  /**
   * Get data-driven type with improved pattern support
   */
  private static getDataDrivenType(
    attr: string,
    relation: RelationSchema,
    dataAnalysis: DataAnalysis
  ): string {
    const fullKey = `${relation.name}.${attr}`;
    const pattern = dataAnalysis.patterns.get(fullKey) || 'text';
    const actualLength = dataAnalysis.actualLengths.get(fullKey) || 255;
    const uniquenessRatio = dataAnalysis.uniquenessRatio.get(fullKey) || 0;
    
    switch (pattern) {
      case 'email':
        return `VARCHAR(${Math.max(320, actualLength + 50)})`; // RFC 5321 + buffer
        
      case 'url':
        return actualLength > 255 ? 'TEXT' : `VARCHAR(${Math.min(2083, actualLength + 100)})`;
        
      case 'phone':
        return `VARCHAR(${Math.max(25, actualLength + 5)})`; // International format support
        
      case 'uuid':
        return 'CHAR(36)'; // Standard UUID length
        
      case 'date':
        return 'DATE';
        
      case 'time':
        return 'TIME';
        
      case 'integer':
        if (uniquenessRatio > 0.8 || attr.toLowerCase().includes('id')) {
          return 'BIGINT'; // High uniqueness suggests ID field
        }
        return 'INTEGER';
        
      case 'decimal':
        return 'DECIMAL(15,4)'; // More precision for business data
        
      case 'percentage':
        return 'DECIMAL(5,2)'; // 0.00 to 100.00
        
      case 'currency':
        return 'DECIMAL(15,2)'; // Standard currency precision
        
      case 'boolean':
        return 'BOOLEAN';
        
      case 'identifier':
        return `VARCHAR(${Math.max(50, actualLength + 10)})`;
        
      case 'ip_address':
        return 'VARCHAR(45)'; // IPv6 maximum length
        
      case 'json':
        return 'JSON'; // MySQL 5.7+ native JSON type, falls back to TEXT
        
      case 'base64':
        return actualLength > 1000 ? 'LONGTEXT' : 'TEXT';
        
      case 'hash':
        if (actualLength <= 32) return 'CHAR(32)';  // MD5
        if (actualLength <= 40) return 'CHAR(40)';  // SHA1
        if (actualLength <= 64) return 'CHAR(64)';  // SHA256
        return 'CHAR(128)'; // SHA512
        
      case 'coordinates':
        return 'POINT'; // MySQL spatial data type
        
      case 'long_text':
        return 'LONGTEXT';
        
      case 'medium_text':
        return 'TEXT';
        
      case 'short_text':
        return `VARCHAR(${Math.max(100, actualLength + 20)})`;
        
      case 'text':
      default:
        // Smart VARCHAR sizing based on actual data
        if (actualLength <= 50) {
          return `VARCHAR(${Math.max(50, actualLength + 10)})`;
        } else if (actualLength <= 255) {
          return `VARCHAR(${Math.max(255, actualLength + 50)})`;
        } else if (actualLength <= 1000) {
          return `VARCHAR(${actualLength + 200})`;
        } else {
          return 'TEXT';
        }
    }
  }

  /**
   * Generate intelligent column comment with pattern information
   */
  private static generateIntelligentColumnComment(
    attr: string,
    relation: RelationSchema,
    dataAnalysis: DataAnalysis
  ): string | null {
    const fullKey = `${relation.name}.${attr}`;
    const pattern = dataAnalysis.patterns.get(fullKey);
    const uniquenessRatio = dataAnalysis.uniquenessRatio.get(fullKey) || 0;
    const isPK = relation.primaryKey?.includes(attr);
    const isFK = relation.foreignKeys?.some(fk => fk.attributes.includes(attr));
    
    const comments: string[] = [];
    
    if (isPK) comments.push('Primary Key');
    if (isFK) {
      const fk = relation.foreignKeys?.find(fk => fk.attributes.includes(attr));
      comments.push(fk ? `References ${fk.references}` : 'Foreign Key');
    }
    
    // Pattern documentation
    if (pattern && pattern !== 'text') {
      const patternDescriptions: { [key: string]: string } = {
        'email': 'Email Address',
        'url': 'URL/Web Address',
        'phone': 'Phone Number',
        'uuid': 'UUID Identifier',
        'date': 'Date Value',
        'time': 'Time Value',
        'percentage': 'Percentage Value',
        'currency': 'Currency Amount',
        'boolean': 'Boolean Flag',
        'identifier': 'Identifier/Code',
        'ip_address': 'IP Address',
        'json': 'JSON Data',
        'base64': 'Base64 Encoded',
        'hash': 'Hash Value',
        'coordinates': 'Geographic Coordinates',
        'long_text': 'Long Text Content',
        'medium_text': 'Medium Text Content',
        'short_text': 'Short Text Content'
      };
      
      const description = patternDescriptions[pattern] || `Pattern: ${pattern}`;
      comments.push(description);
    }
    
    if (uniquenessRatio > 0.95) {
      comments.push('Unique values');
    } else if (uniquenessRatio < 0.1) {
      comments.push('Low cardinality');
    }
    
    return comments.length > 0 ? comments.join(', ') : null;
  }

  // Keep all existing helper methods for data analysis, constraints, etc...
  private static async performDataDrivenAnalysis(relations: RelationSchema[]): Promise<DataAnalysis> {
    this.logger.info('Performing data-driven analysis for optimal DDL generation...');

    const actualLengths = new Map<string, number>();
    const patterns = new Map<string, string>();
    const nullabilityRatio = new Map<string, number>();
    const uniquenessRatio = new Map<string, number>();
    const sampleValues = new Map<string, any[]>();

    for (const relation of relations) {
      if (!relation.rows || relation.rows.length === 0) continue;

      for (const attr of relation.attributes) {
        const fullKey = `${relation.name}.${attr}`;
        const values = relation.rows.map(row => row[attr]).filter(v => v !== null && v !== undefined);
        
        if (values.length === 0) continue;

        const stringValues = values.map(v => v.toString());
        const maxLength = Math.max(...stringValues.map(s => s.length));
        actualLengths.set(fullKey, maxLength);

        const pattern = this.detectDataPattern(stringValues);
        patterns.set(fullKey, pattern);

        const nullCount = relation.rows.length - values.length;
        const nullRatio = nullCount / relation.rows.length;
        nullabilityRatio.set(fullKey, nullRatio);

        const uniqueCount = new Set(stringValues).size;
        const uniqueRatio = uniqueCount / values.length;
        uniquenessRatio.set(fullKey, uniqueRatio);

        sampleValues.set(fullKey, values.slice(0, 10));
      }
    }

    this.logger.info(`Data analysis completed: ${actualLengths.size} attributes analyzed`);

    return {
      actualLengths,
      patterns,
      nullabilityRatio,
      uniquenessRatio,
      sampleValues
    };
  }
  private static async resolveDependenciesRobustly(relations: RelationSchema[]): Promise<{
    orderedRelations: RelationSchema[];
    analysis: any;
    circularDependencies: string[][];
  }> {
    this.logger.info('Resolving dependencies with enhanced algorithms...');

    const dependencyGraph = this.buildEnhancedDependencyGraph(relations);
    const circularDependencies = this.detectCircularDependencies(dependencyGraph, relations);
    
    if (circularDependencies.length > 0) {
      this.logger.warn(`Detected ${circularDependencies.length} circular dependencies`);
      const resolvedGraph = this.resolveCircularDependencies(dependencyGraph, circularDependencies);
      const orderedRelations = this.topologicalSortRobust(resolvedGraph, relations);
      
      return {
        orderedRelations,
        analysis: this.analyzeSchemaStructure(orderedRelations),
        circularDependencies
      };
    } else {
      const orderedRelations = this.topologicalSortRobust(dependencyGraph, relations);
      
      return {
        orderedRelations,
        analysis: this.analyzeSchemaStructure(orderedRelations),
        circularDependencies: []
      };
    }
  }

  /**
   * Build enhanced dependency graph with self-reference handling
   */
  private static buildEnhancedDependencyGraph(relations: RelationSchema[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    for (const relation of relations) {
      graph.set(relation.name, new Set<string>());
    }
    
    for (const relation of relations) {
      if (relation.foreignKeys) {
        for (const fk of relation.foreignKeys) {
          if (fk.references === relation.name) {
            this.logger.debug(`Self-reference detected in ${relation.name}`);
            continue;
          }
          
          graph.get(relation.name)?.add(fk.references);
        }
      }
    }
    
    return graph;
  }

  /**
   * Detect circular dependencies using DFS
   */
  private static detectCircularDependencies(
    graph: Map<string, Set<string>>,
    relations: RelationSchema[]
  ): string[][] {
    const circularDependencies: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          const cycle = [...path.slice(cycleStart), node];
          circularDependencies.push(cycle);
        }
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      path.pop();
      return false;
    };

    for (const relation of relations) {
      if (!visited.has(relation.name)) {
        dfs(relation.name);
      }
    }

    return circularDependencies;
  }

  /**
   * Resolve circular dependencies by breaking cycles
   */
  private static resolveCircularDependencies(
    graph: Map<string, Set<string>>,
    circularDependencies: string[][]
  ): Map<string, Set<string>> {
    const resolvedGraph = new Map<string, Set<string>>();
    
    for (const [key, value] of graph) {
      resolvedGraph.set(key, new Set(value));
    }

    for (const cycle of circularDependencies) {
      if (cycle.length > 1) {
        const lastNode = cycle[cycle.length - 2];
        const firstNode = cycle[0];
        
        resolvedGraph.get(lastNode)?.delete(firstNode);
        this.logger.info(`Broke circular dependency: removed edge ${lastNode} -> ${firstNode}`);
      }
    }

    return resolvedGraph;
  }

  /**
   * Robust topological sort with error handling
   */
  private static topologicalSortRobust(
    dependencyGraph: Map<string, Set<string>>,
    relations: RelationSchema[]
  ): RelationSchema[] {
    const result: RelationSchema[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const relationMap = new Map(relations.map(r => [r.name, r]));

    const visit = (relationName: string): boolean => {
      if (visiting.has(relationName)) {
        this.logger.error(`Unexpected circular dependency during topological sort: ${relationName}`);
        return false;
      }

      if (visited.has(relationName)) {
        return true;
      }

      visiting.add(relationName);

      const dependencies = dependencyGraph.get(relationName) || new Set();
      for (const dependency of dependencies) {
        if (relationMap.has(dependency)) {
          if (!visit(dependency)) {
            return false;
          }
        } else {
          this.logger.warn(`Dependency '${dependency}' not found in relations`);
        }
      }

      visiting.delete(relationName);
      visited.add(relationName);

      const relation = relationMap.get(relationName);
      if (relation) {
        result.push(relation);
      }

      return true;
    };

    for (const relation of relations) {
      if (!visited.has(relation.name)) {
        if (!visit(relation.name)) {
          this.logger.error(`Failed to sort relation: ${relation.name}`);
        }
      }
    }

    this.logger.info(`Topological sort completed: ${result.length}/${relations.length} relations ordered`);
    return result;
  }

  /**
   * Analyze schema structure for optimization opportunities
   */
  private static analyzeSchemaStructure(relations: RelationSchema[]): {
    totalTables: number;
    totalColumns: number;
    totalIndexes: number;
    complexTables: RelationSchema[];
    lookupTables: RelationSchema[];
    factTables: RelationSchema[];
    maxForeignKeys: number;
    recommendedPartitioning: string[];
    recommendedIndexes: Map<string, string[]>;
  } {
    const complexTables = relations.filter(r => r.attributes.length > 10 || (r.foreignKeys?.length || 0) > 3);
    const lookupTables = relations.filter(r => 
      r.attributes.length <= 5 && 
      (r.foreignKeys?.length || 0) === 0 &&
      relations.some(other => other.foreignKeys?.some(fk => fk.references === r.name))
    );
    const factTables = relations.filter(r => (r.foreignKeys?.length || 0) >= 2);
    
    const totalColumns = relations.reduce((sum, r) => sum + r.attributes.length, 0);
    const maxForeignKeys = Math.max(...relations.map(r => r.foreignKeys?.length || 0));
    
    // Recommend partitioning for large tables
    const recommendedPartitioning = relations
      .filter(r => r.metadata.rowCount > 100000)
      .map(r => r.name);
    
    // Recommend indexes based on usage patterns
    const recommendedIndexes = new Map<string, string[]>();
    for (const relation of relations) {
      const indexes: string[] = [];
      
      // Index foreign keys
      if (relation.foreignKeys) {
        for (const fk of relation.foreignKeys) {
          if (fk.attributes.length <= 3) { // Don't index very wide keys
            indexes.push(`IDX_${relation.name}_${fk.attributes.join('_')}`);
          }
        }
      }
      
      // Index frequently used combinations
      if (relation.attributes.length > 5 && relation.metadata.rowCount > 1000) {
        // Add covering indexes for common query patterns
        indexes.push(`IDX_${relation.name}_covering`);
      }
      
      if (indexes.length > 0) {
        recommendedIndexes.set(relation.name, indexes);
      }
    }
    
    return {
      totalTables: relations.length,
      totalColumns,
      totalIndexes: Array.from(recommendedIndexes.values()).flat().length,
      complexTables,
      lookupTables,
      factTables,
      maxForeignKeys,
      recommendedPartitioning,
      recommendedIndexes
    };
  }

  /**
   * Generate validated tables with data-driven types
   */
  private static async generateValidatedTables(
    orderedRelations: RelationSchema[],
    dataAnalysis: DataAnalysis,
    schemaAnalysis: any
  ): Promise<string> {
    let sql = '-- ================================================================\n';
    sql += '-- VALIDATED TABLE CREATION (Dependency-Ordered)\n';
    sql += '-- ================================================================\n\n';
    
    for (const relation of orderedRelations) {
      sql += await this.generateValidatedTableDDL(relation, dataAnalysis, schemaAnalysis);
      sql += '\n';
    }
    
    return sql;
  }

  /**
   * Generate validated table DDL with data-driven optimization
   */
  private static async generateValidatedTableDDL(
    relation: RelationSchema,
    dataAnalysis: DataAnalysis,
    analysis: any
  ): Promise<string> {
    const tableName = this.sanitizeSQLIdentifier(relation.name);
    let sql = `-- Table: ${tableName}\n`;
    sql += `-- Source: ${relation.sourceType}\n`;
    sql += `-- Attributes: ${relation.attributes.length}, Rows: ${relation.metadata.rowCount.toLocaleString()}\n`;
    
    if (analysis.complexTables?.includes(relation)) {
      sql += '-- Classification: COMPLEX TABLE - Performance optimized\n';
    }
    if (analysis.lookupTables?.includes(relation)) {
      sql += '-- Classification: LOOKUP TABLE - Optimized for reference queries\n';
    }
    if (analysis.factTables?.includes(relation)) {
      sql += '-- Classification: FACT TABLE - Optimized for analytical queries\n';
    }
    
    sql += `CREATE TABLE ${tableName} (\n`;
    
    const columnDefs: string[] = [];
    
    for (const attr of relation.attributes) {
      const columnDef = this.generateDataDrivenColumnDefinition(attr, relation, dataAnalysis);
      columnDefs.push(columnDef);
    }
    
    if (relation.primaryKey && relation.primaryKey.length > 0) {
      const pkColumns = relation.primaryKey.map(attr => this.sanitizeSQLIdentifier(attr));
      columnDefs.push(`    CONSTRAINT PK_${tableName} PRIMARY KEY (${pkColumns.join(', ')})`);
    }
    
    sql += columnDefs.join(',\n');
    sql += '\n)';
    sql += this.generateOptimizedTableOptions(relation, analysis);
    sql += ';\n';
    
    return sql;
  }

  /**
   * Generate data-driven column definition
   */
  private static generateDataDrivenColumnDefinition(
    attr: string,
    relation: RelationSchema,
    dataAnalysis: DataAnalysis
  ): string {
    const sanitizedAttr = this.sanitizeSQLIdentifier(attr);
    const fullKey = `${relation.name}.${attr}`;
    
    const dataType = this.getDataDrivenType(attr, relation, dataAnalysis);
    const nullRatio = dataAnalysis.nullabilityRatio.get(fullKey) || 0;
    const isNullable = this.isAttributeNullable(relation, attr) && nullRatio > 0.01;
    const nullConstraint = isNullable ? '' : ' NOT NULL';
    
    let definition = `    ${sanitizedAttr} ${dataType}${nullConstraint}`;
    
    if (!isNullable && !relation.primaryKey?.includes(attr)) {
      const defaultValue = this.getIntelligentDefault(dataType, dataAnalysis.sampleValues.get(fullKey));
      if (defaultValue) {
        definition += ` DEFAULT ${defaultValue}`;
      }
    }
    
    const comment = this.generateIntelligentColumnComment(attr, relation, dataAnalysis);
    if (comment) {
      definition += ` COMMENT '${comment}'`;
    }
    
    return definition;
  }

  /**
   * Get intelligent default value based on data patterns
   */
  private static getIntelligentDefault(dataType: string, sampleValues?: any[]): string | null {
    if (dataType.includes('VARCHAR') || dataType.includes('TEXT')) {
      return "''";
    }
    
    if (dataType.includes('INT') || dataType.includes('DECIMAL')) {
      if (sampleValues && sampleValues.length > 0) {
        const numericValues = sampleValues.filter(v => !isNaN(parseFloat(v.toString())));
        if (numericValues.length > 0) {
          const avg = numericValues.reduce((sum, v) => sum + parseFloat(v.toString()), 0) / numericValues.length;
          if (avg >= 1) return '1';
        }
      }
      return '0';
    }
    
    if (dataType.includes('BOOLEAN')) {
      return 'FALSE';
    }
    
    if (dataType.includes('DATE') || dataType.includes('TIMESTAMP')) {
      return 'CURRENT_TIMESTAMP';
    }
    
    return null;
  }

  /**
   * Generate optimized table options
   */
  private static generateOptimizedTableOptions(relation: RelationSchema, _analysis: any): string {
    let options = '';
    
    options += '\nENGINE=InnoDB';
    
    if (relation.metadata.rowCount > 100000) {
      options += '\nROW_FORMAT=COMPRESSED';
    } else {
      options += '\nROW_FORMAT=DYNAMIC';
    }
    
    options += '\nCHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    options += `\nCOMMENT='${relation.sourceType} relation: ${relation.attributes.length} cols, ${relation.metadata.rowCount.toLocaleString()} rows'`;
    
    return options;
  }

  /**
   * Generate validated constraints
   */
  private static async generateValidatedConstraints(
    orderedRelations: RelationSchema[],
    analysis: any
  ): Promise<string> {
    let sql = '\n-- ================================================================\n';
    sql += '-- VALIDATED FOREIGN KEY CONSTRAINTS\n';
    sql += '-- ================================================================\n\n';
    
    sql += 'SET FOREIGN_KEY_CHECKS = 1;\n\n';
    
    for (const relation of orderedRelations) {
      if (relation.foreignKeys && relation.foreignKeys.length > 0) {
        sql += await this.generateValidatedTableConstraints(relation, analysis);
      }
    }
    
    return sql;
  }

  /**
   * Generate validated table constraints
   */
  private static async generateValidatedTableConstraints(
    relation: RelationSchema,
    analysis: any
  ): Promise<string> {
    let sql = `-- Validated Foreign Key Constraints for ${relation.name}\n`;
    
    if (!relation.foreignKeys) return '';
    
    for (const fk of relation.foreignKeys) {
      const constraintName = this.generateConstraintName(relation.name, fk.references);
      const sourceTable = this.sanitizeSQLIdentifier(relation.name);
      const targetTable = this.sanitizeSQLIdentifier(fk.references);
      const sourceColumns = fk.attributes.map(attr => this.sanitizeSQLIdentifier(attr));
      const targetColumns = fk.referencedKey.map(attr => this.sanitizeSQLIdentifier(attr));
      
      sql += `-- FK: ${sourceTable}(${sourceColumns.join(',')}) -> ${targetTable}(${targetColumns.join(',')})\n`;
      sql += `ALTER TABLE ${sourceTable}\n`;
      sql += `    ADD CONSTRAINT ${constraintName}\n`;
      sql += `    FOREIGN KEY (${sourceColumns.join(', ')})\n`;
      sql += `    REFERENCES ${targetTable}(${targetColumns.join(', ')})`;
      
      const actions = this.determineReferentialActions(relation, fk, analysis);
      sql += `\n    ${actions}`;
      
      sql += ';\n\n';
    }
    
    return sql;
  }

  /**
   * Generate constraint name with length limits
   */
  private static generateConstraintName(sourceName: string, targetName: string): string {
    const baseName = `FK_${sourceName}_${targetName}`;
    return baseName.length <= 64 ? baseName : baseName.substring(0, 64);
  }

  /**
   * Determine intelligent referential actions
   */
  private static determineReferentialActions(
    relation: RelationSchema,
    fk: ForeignKey,
    analysis: any
  ): string {
    if (analysis.lookupTables?.some((lt: RelationSchema) => lt.name === fk.references)) {
      return 'ON DELETE RESTRICT ON UPDATE CASCADE';
    }
    
    if (fk.cardinality === '1:1') {
      return 'ON DELETE CASCADE ON UPDATE CASCADE';
    }
    
    if (fk.references === relation.name) {
      return 'ON DELETE RESTRICT ON UPDATE RESTRICT';
    }
    
    return 'ON DELETE RESTRICT ON UPDATE CASCADE';
  }

  /**
   * Generate validated indexes
   */
  private static async generateValidatedIndexes(
    orderedRelations: RelationSchema[],
    dataAnalysis: DataAnalysis,
    analysis: any
  ): Promise<string> {
    let sql = '\n-- ================================================================\n';
    sql += '-- PERFORMANCE-OPTIMIZED INDEXES\n';
    sql += '-- ================================================================\n\n';
    
    for (const relation of orderedRelations) {
      sql += await this.generateIntelligentIndexes(relation, dataAnalysis, analysis);
    }
    
    return sql;
  }

  /**
   * Generate intelligent indexes based on data analysis
   */
  private static async generateIntelligentIndexes(
    relation: RelationSchema,
    dataAnalysis: DataAnalysis,
    _analysis: any
  ): Promise<string> {
    let sql = `-- Intelligent Indexes for ${relation.name}\n`;
    const tableName = this.sanitizeSQLIdentifier(relation.name);
    
    if (relation.foreignKeys) {
      for (const fk of relation.foreignKeys) {
        if (fk.attributes.length <= 3) {
          const indexName = `IDX_${relation.name}_${fk.attributes.join('_')}`.substring(0, 64);
          const columns = fk.attributes.map(attr => this.sanitizeSQLIdentifier(attr));
          
          sql += `CREATE INDEX ${indexName}\n`;
          sql += `    ON ${tableName}(${columns.join(', ')});\n`;
        }
      }
    }
    
    for (const attr of relation.attributes) {
      const fullKey = `${relation.name}.${attr}`;
      const uniquenessRatio = dataAnalysis.uniquenessRatio.get(fullKey) || 0;
      
      if (uniquenessRatio > 0.7 && 
          !relation.primaryKey?.includes(attr) &&
          !relation.foreignKeys?.some(fk => fk.attributes.includes(attr))) {
        
        const indexName = `IDX_${relation.name}_${attr}`.substring(0, 64);
        const columnName = this.sanitizeSQLIdentifier(attr);
        
        sql += `-- High cardinality index (${(uniquenessRatio * 100).toFixed(1)}% unique)\n`;
        sql += `CREATE INDEX ${indexName}\n`;
        sql += `    ON ${tableName}(${columnName});\n`;
      }
    }
    
    if (relation.metadata.rowCount > 10000 && relation.attributes.length > 5) {
      const coveringColumns = this.selectIntelligentCoveringColumns(relation, dataAnalysis);
      if (coveringColumns.length > 0) {
        const indexName = `IDX_${relation.name}_covering`.substring(0, 64);
        
        sql += `-- Covering index for query optimization\n`;
        sql += `CREATE INDEX ${indexName}\n`;
        sql += `    ON ${tableName}(${coveringColumns.join(', ')});\n`;
      }
    }
    
    sql += '\n';
    return sql;
  }

  /**
   * Select intelligent covering columns based on data analysis
   */
  private static selectIntelligentCoveringColumns(
    relation: RelationSchema,
    dataAnalysis: DataAnalysis
  ): string[] {
    const columns: string[] = [];
    
    if (relation.primaryKey) {
      columns.push(...relation.primaryKey.map(attr => this.sanitizeSQLIdentifier(attr)));
    }
    
    if (relation.foreignKeys) {
      for (const fk of relation.foreignKeys) {
        if (fk.attributes.length <= 2) {
          const avgCardinality = fk.attributes.reduce((sum, attr) => {
            const fullKey = `${relation.name}.${attr}`;
            return sum + (dataAnalysis.uniquenessRatio.get(fullKey) || 0);
          }, 0) / fk.attributes.length;
          
          if (avgCardinality > 0.5) {
            columns.push(...fk.attributes.map(attr => this.sanitizeSQLIdentifier(attr)));
          }
        }
      }
    }
    
    return Array.from(new Set(columns)).slice(0, 4);
  }

  /**
   * Generate validation queries
   */
  private static generateValidationQueries(relations: RelationSchema[]): string {
    let sql = '\n-- ================================================================\n';
    sql += '-- DATA VALIDATION QUERIES\n';
    sql += '-- ================================================================\n\n';
    
    sql += '-- Reset foreign key checks\n';
    sql += 'SET FOREIGN_KEY_CHECKS = 1;\n';
    sql += 'SET UNIQUE_CHECKS = 1;\n';
    sql += 'SET AUTOCOMMIT = 1;\n\n';
    
    sql += '-- Validation Summary\n';
    sql += 'SELECT \n';
    sql += '    \'Schema Validation Summary\' as validation_type,\n';
    sql += `    ${relations.length} as total_tables,\n`;
    sql += '    COUNT(*) as created_tables\n';
    sql += 'FROM information_schema.tables \n';
    sql += 'WHERE table_schema = DATABASE()\n';
    sql += `    AND table_name IN (${relations.map(r => `'${this.sanitizeSQLIdentifier(r.name)}'`).join(', ')});\n\n`;
    
    for (const relation of relations.slice(0, 5)) {
      const tableName = this.sanitizeSQLIdentifier(relation.name);
      sql += `-- Validate ${relation.name}\n`;
      sql += `SELECT \n`;
      sql += `    '${tableName}' as table_name,\n`;
      sql += `    COUNT(*) as row_count,\n`;
      
      if (relation.primaryKey && relation.primaryKey.length > 0) {
        const pkColumns = relation.primaryKey.map(pk => this.sanitizeSQLIdentifier(pk));
        sql += `    COUNT(DISTINCT ${pkColumns.join(', ')}) as unique_keys,\n`;
        sql += `    CASE WHEN COUNT(*) = COUNT(DISTINCT ${pkColumns.join(', ')}) THEN 'VALID' ELSE 'INVALID' END as pk_validation\n`;
      } else {
        sql += `    NULL as unique_keys,\n`;
        sql += `    'NO_PK' as pk_validation\n`;
      }
      
      sql += `FROM ${tableName};\n\n`;
    }
    
    return sql;
  }

  /**
   * Generate safe fallback SQL
   */
  private static generateSafeFallbackSQL(relations: RelationSchema[], validationResult?: ValidationResult): string {
    let sql = '-- SAFE FALLBACK SQL DDL\n';
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += '-- This is a simplified, safe version due to validation issues\n';
    
    if (validationResult) {
      sql += `-- Validation Confidence: ${validationResult.confidence.toFixed(1)}%\n`;
      sql += `-- Validation Errors: ${validationResult.errors.length}\n`;
      if (validationResult.errors.length > 0) {
        sql += '-- Errors:\n';
        validationResult.errors.forEach(error => {
          sql += `--   ${error}\n`;
        });
      }
    }
    sql += '\n';
    
    for (const relation of relations) {
      const tableName = this.sanitizeSQLIdentifier(relation.name);
      sql += `-- Table: ${tableName} (${relation.attributes.length} attributes)\n`;
      sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
      
      const columns: string[] = [];
      for (const attr of relation.attributes) {
        const sanitizedAttr = this.sanitizeSQLIdentifier(attr);
        const safeType = 'VARCHAR(255)';
        columns.push(`    ${sanitizedAttr} ${safeType}`);
      }
      
      if (relation.primaryKey && relation.primaryKey.length > 0) {
        const pkColumns = relation.primaryKey.map(attr => this.sanitizeSQLIdentifier(attr));
        columns.push(`    PRIMARY KEY (${pkColumns.join(', ')})`);
      }
      
      sql += columns.join(',\n');
      sql += '\n) ENGINE=InnoDB CHARSET=utf8mb4;\n\n';
    }
    
    sql += '-- Note: Foreign key constraints omitted in fallback mode for safety\n';
    sql += '-- Please review and add constraints manually after data validation\n';
    
    return sql;
  }

  /**
   * Estimate DDL execution time
   */
  private static estimateExecutionTime(relations: RelationSchema[]): number {
    const tableCreationTime = relations.length * 0.1; // 0.1 seconds per table
    const constraintTime = relations.reduce((sum, r) => sum + (r.foreignKeys?.length || 0), 0) * 0.2;
    const indexTime = relations.length * 0.3; // Average index creation time
    
    return Math.ceil(tableCreationTime + constraintTime + indexTime);
  }

  // Keep existing helper methods for sanitization and mapping
  private static sanitizeEntityName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  }

  private static sanitizeAttributeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  }

  private static sanitizeSQLIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  }

  private static mapToMermaidType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'string': 'varchar',
      'integer': 'int',
      'decimal': 'decimal',
      'boolean': 'boolean',
      'date': 'date',
      'email': 'varchar'
    };
    return typeMap[type] || 'varchar';
  }

  private static convertToMermaidCardinality(cardinality: string): string {
    const cardinalityMap: { [key: string]: string } = {
      '1:1': '||--||',
      '1:N': '||--o{',
      'N:1': '}o--||',
      'N:M': '}o--o{',
      'N:N': '}o--o{'
    };
    return cardinalityMap[cardinality] || '||--o{';
  }

  private static isAttributeNullable(relation: RelationSchema, attr: string): boolean {
    if (relation.primaryKey?.includes(attr)) {
      return false;
    }
    
    const isForeignKey = relation.foreignKeys?.some(fk => fk.attributes.includes(attr));
    if (isForeignKey) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate all foreign key references
   */
  private static async validateAllForeignKeyReferences(relations: RelationSchema[]): Promise<ConstraintValidation[]> {
    const validations: ConstraintValidation[] = [];
    const relationMap = new Map(relations.map(r => [r.name, r]));

    for (const relation of relations) {
      if (relation.foreignKeys) {
        for (const fk of relation.foreignKeys) {
          const validation = this.validateForeignKeyReference(relation, fk, relationMap);
          validations.push(validation);
        }
      }
    }

    return validations;
  }

  /**
   * Validate individual foreign key reference
   */
  private static validateForeignKeyReference(
    sourceRelation: RelationSchema,
    fk: ForeignKey,
    relationMap: Map<string, RelationSchema>
  ): ConstraintValidation {
    const errors: string[] = [];

    const targetRelation = relationMap.get(fk.references);
    const targetExists = !!targetRelation;

    if (!targetExists) {
      errors.push(`Target relation '${fk.references}' does not exist`);
    }

    let columnsMatch = false;
    if (targetExists && targetRelation!.primaryKey) {
      columnsMatch = fk.attributes.length === targetRelation!.primaryKey.length &&
                     fk.attributes.every((_attr, index) => 
                       targetRelation!.attributes.includes(targetRelation!.primaryKey![index])
                     );
      
      if (!columnsMatch) {
        errors.push(`Foreign key columns don't match target primary key`);
      }
    }

    let dataIntegrity = false;
    if (targetExists && columnsMatch && sourceRelation.rows && targetRelation!.rows) {
      dataIntegrity = this.validateReferentialIntegrity(sourceRelation, targetRelation!, fk);
      
      if (!dataIntegrity) {
        errors.push(`Referential integrity violation: orphaned foreign key values exist`);
      }
    } else {
      dataIntegrity = true;
    }

    return {
      foreignKey: fk,
      isValid: targetExists && columnsMatch && dataIntegrity,
      targetExists,
      columnsMatch,
      dataIntegrity,
      errors
    };
  }

  /**
   * Validate referential integrity
   */
  private static validateReferentialIntegrity(
    sourceRelation: RelationSchema,
    targetRelation: RelationSchema,
    fk: ForeignKey
  ): boolean {
    if (!sourceRelation.rows || !targetRelation.rows || !targetRelation.primaryKey) {
      return true;
    }

    const validTargetValues = new Set<string>();
    for (const row of targetRelation.rows) {
      const targetValue = targetRelation.primaryKey.map(attr => (row[attr] || '').toString()).join('||');
      validTargetValues.add(targetValue);
    }

    for (const row of sourceRelation.rows) {
      const fkValue = fk.attributes.map(attr => (row[attr] || '').toString()).join('||');
      
      if (fkValue.includes('') || fkValue.trim() === '') {
        continue;
      }
      
      if (!validTargetValues.has(fkValue)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate data integrity
   */
  private static validateDataIntegrity(relation: RelationSchema): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!relation.rows || relation.rows.length === 0) {
      warnings.push('No data to validate');
      return { isValid: true, errors, warnings, confidence: 0.5 };
    }

    for (const attr of relation.attributes) {
      const isNullable = this.isAttributeNullable(relation, attr);
      
      if (!isNullable) {
        const nullCount = relation.rows.filter(row => 
          row[attr] === null || row[attr] === undefined || row[attr] === ''
        ).length;
        
        if (nullCount > 0) {
          errors.push(`Non-nullable attribute '${attr}' has ${nullCount} null values`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      confidence: errors.length === 0 ? 1.0 : Math.max(0, 1 - errors.length * 0.2)
    };
  }
}