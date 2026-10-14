/**
 * Master End-to-End Platform Integration Test Suite (Tiers 1 - 4)
 * Author: teamwork_preview_test_writer_m5_1
 * Date: 2026-10-14
 *
 * Architecture Coverage:
 * - Tier 1: Feature Coverage (End-to-End Isolations)
 * - Tier 2: Boundary & Corner Cases (Cyclic FDs, single attr, multi-attribute composite PKs, reserved keywords)
 * - Tier 3: Cross-Feature Combinations (Ingestion + Mining + Synthesis + DDL + Export)
 * - Tier 4: Real-World Workloads (University Registrar & E-Commerce Order Fulfillment)
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import type { Node, Edge } from '@xyflow/react';

import { CSVProcessor, StreamingCSVParser } from '../services/processors/csvProcessor';
import { DataProcessor } from '../services/processors/dataProcessor';
import { DataUtils } from '../services/utils/dataUtils';
import { mineFunctionalDependencies } from '../services/processors/fdMiner';
import {
  NormalizationEngine,
  FunctionalDependency,
  RelationSchema,
} from '../services/processors/normalizationEngine';
import DatabaseService, {
  DecomposedRelation,
  SQLDialect,
  quoteIdentifier,
  mapDataTypeToDialect,
  SQL_RESERVED_KEYWORDS,
} from '../services/api/databaseService';
import {
  topologicalSortWorkflow,
  getTopologicalOrder,
  validateSequence,
  START_NODE_ID,
} from '../utils/workflowValidation';

// ============================================================================
// Empirical Test Helpers
// ============================================================================

/**
 * Constructs a fully compliant FunctionalDependency structure.
 */
function makeFD(lhs: string[], rhs: string | string[], confidence: number = 1): FunctionalDependency {
  const rhsStr = Array.isArray(rhs) ? rhs.join(', ') : rhs;
  return {
    lhs,
    rhs: rhsStr as any,
    confidence,
    coverage: 1,
    violations: 0,
    uniqueGroups: 1,
  };
}

/**
 * Maps a synthesized RelationSchema to a DecomposedRelation for SQL DDL generation.
 */
function toDecomposedRelation(
  r: RelationSchema,
  columnTypes?: Record<string, string>
): DecomposedRelation {
  return {
    name: r.name,
    attributes: r.attributes,
    primaryKey: r.primaryKey,
    foreignKeys: (r.foreignKeys || []).map(fk => ({
      attributes: fk.attributes,
      references: fk.references,
      referencedKey: fk.referencedKey,
      cardinality: fk.cardinality,
    })),
    columnTypes: columnTypes || r.metadata?.attributeTypes,
  };
}

/**
 * Executes a generated SQL script inside an in-memory SQLite database via Python.
 * Fails fast if the SQL script contains syntax errors or schema integrity violations.
 */
function verifySQLiteExecution(sqlScript: string): void {
  const pythonScript = `
import sys, sqlite3
sql = sys.stdin.read()
con = sqlite3.connect(':memory:')
con.executescript(sql)
con.close()
`;
  try {
    execFileSync('python', ['-c', pythonScript], {
      input: sqlScript,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: any) {
    throw new Error(`SQLite execution verification failed:\n${err.stderr || err.message}\nSQL Script:\n${sqlScript}`);
  }
}

/**
 * Serializes a list of records into an RFC 4180 CSV string using DatabaseService formatting.
 */
function exportRelationToCSV(data: Record<string, any>[], attributes: string[]): string {
  if (!attributes || attributes.length === 0) return '';
  const headerLine = attributes.map(h => DatabaseService.formatCSVHeader(h)).join(',');
  const rowLines = data.map(row =>
    attributes.map(attr => DatabaseService.formatCSVCell(row[attr])).join(',')
  );
  return [headerLine, ...rowLines].join('\n');
}

// ============================================================================
// MASTER TEST SUITE
// ============================================================================

describe('Master End-to-End Platform Integration Test Suite', () => {

  // ==========================================================================
  // TIER 1: Feature Coverage (End-to-End Isolations)
  // ==========================================================================
  describe('Tier 1: Feature Coverage & End-to-End Isolations', () => {

    it('1.1 executes full pipeline: Raw CSV -> Ingestion -> Cleaning -> Mining -> Synthesis -> DDL -> Export', async () => {
      // Raw CSV with embedded commas inside quotes and realistic attributes
      const rawCsv = [
        'dept_code,dept_name,location,budget',
        '"CS","Computer Science","Tech Hall, Room 101",1500000',
        '"MATH","Mathematics & Statistics","Science Bldg, Room 204",1200000',
        '"PHYS","Physics","Science Bldg, Room 301",950000',
      ].join('\n');

      // 1. Ingestion: Parse raw CSV string
      const parsed = CSVProcessor.parse(rawCsv);
      expect(parsed.data).toHaveLength(3);
      expect(parsed.headers).toEqual(['dept_code', 'dept_name', 'location', 'budget']);
      expect(parsed.data[0].location).toBe('Tech Hall, Room 101');

      // 2. Data Cleaning
      const cleaned = await DataProcessor.clean(parsed.data);
      expect(cleaned).toHaveLength(3);
      expect(cleaned[0].dept_code).toBe('CS');

      // 3. Functional Dependency Mining
      const { fds } = mineFunctionalDependencies(cleaned, { maxLhsSize: 2, minConfidence: 1.0 });
      expect(fds.length).toBeGreaterThan(0);
      const determinesName = fds.some(f => f.lhs.includes('dept_code') && f.rhs === 'dept_name');
      expect(determinesName).toBe(true);

      // 4. Candidate Key Discovery
      const keyResult = await NormalizationEngine.findKeys(parsed.headers, fds);
      expect(keyResult.candidateKeys.length).toBeGreaterThan(0);
      expect(keyResult.candidateKeys.some(k => k.includes('dept_code'))).toBe(true);

      // 5. Minimal / Canonical Cover
      const canonical = NormalizationEngine.computeCanonicalCover(fds);
      expect(canonical.singletonCover.length).toBeGreaterThan(0);

      // 6. 3NF Synthesis (Bernstein's Algorithm)
      const synthesized = await NormalizationEngine.synthesize3NF(
        canonical.singletonCover,
        keyResult.candidateKeys,
        cleaned
      );
      expect(synthesized.length).toBeGreaterThan(0);

      // 7. Verification: Lossless Join & Dependency Preservation
      const isLossless = await NormalizationEngine.checkLosslessJoin(synthesized, canonical.singletonCover);
      expect(isLossless).toBe(true);

      const isPreserved = await NormalizationEngine.checkDependencyPreservation(synthesized, canonical.singletonCover);
      expect(isPreserved).toBe(true);

      // 8. DDL Generation across PostgreSQL, SQLite, MySQL
      const decomposed = synthesized.map(s => toDecomposedRelation(s, {
        dept_code: 'string',
        dept_name: 'string',
        location: 'string',
        budget: 'integer',
      }));

      const postgresDDL = DatabaseService.generateDDL(decomposed, 'postgresql');
      expect(postgresDDL).toContain('BEGIN;');
      expect(postgresDDL).toContain('COMMIT;');
      expect(postgresDDL).toContain('PRIMARY KEY');

      const mysqlDDL = DatabaseService.generateDDL(decomposed, 'mysql');
      expect(mysqlDDL).toContain('ENGINE=InnoDB');
      expect(mysqlDDL).toContain('`dept_code`');

      const sqliteDDL = DatabaseService.generateDDL(decomposed, 'sqlite');
      expect(sqliteDDL).toContain('PRAGMA foreign_keys = OFF;');
      expect(sqliteDDL).toContain('PRAGMA foreign_keys = ON;');
      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();

      // 9. Export back to RFC 4180 CSV
      for (const rel of synthesized) {
        const exportedCSV = exportRelationToCSV(rel.rows, rel.attributes);
        expect(exportedCSV.length).toBeGreaterThan(0);
        // Header line must contain relation attributes
        const firstLine = exportedCSV.split('\n')[0];
        rel.attributes.forEach(attr => {
          expect(firstLine).toContain(attr);
        });
      }
    });

    it('1.2 verifies data preservation of numeric 0 and boolean false end-to-end', async () => {
      const rawCsv = [
        'item_id,item_name,quantity,discount_rate,in_stock,is_featured',
        '101,Standard Widget,0,0.0,false,false',
        '102,Premium Gadget,5,0.15,true,true',
        '103,Economy Unit,0,0.0,false,false',
      ].join('\n');

      const parsed = CSVProcessor.parse(rawCsv);
      expect(parsed.data[0].quantity).toBe('0');
      expect(parsed.data[0].in_stock).toBe('false');

      const cleaned = await DataProcessor.clean(parsed.data);
      expect(cleaned[0].quantity).toBe('0');
      expect(cleaned[0].in_stock).toBe('false');

      // Verify Type Inference accurately catches 0 as integer/decimal and false as boolean
      const qtyType = DataUtils.inferDataType(cleaned.map(r => r.quantity));
      expect(qtyType).toBe('integer');

      const inStockType = DataUtils.inferDataType(cleaned.map(r => r.in_stock));
      expect(inStockType).toBe('boolean');

      // Synthesize relations
      const fds: FunctionalDependency[] = [
        makeFD(['item_id'], 'item_name'),
        makeFD(['item_id'], 'quantity'),
        makeFD(['item_id'], 'discount_rate'),
        makeFD(['item_id'], 'in_stock'),
        makeFD(['item_id'], 'is_featured'),
      ];
      const synthesized = await NormalizationEngine.synthesize3NF(fds, [['item_id']], cleaned);

      // Verify synthesized row values still hold '0' and 'false' without nullification
      const mainRel = synthesized[0];
      const row0 = mainRel.rows.find(r => r.item_id === '101');
      expect(row0).toBeDefined();
      expect(row0.quantity).toBe('0');
      expect(row0.in_stock).toBe('false');

      // Verify CSV export cell formatting preserves '0' and 'false' verbatim
      const exportedCsv = exportRelationToCSV(mainRel.rows, mainRel.attributes);
      const csvLines = exportedCsv.split('\n');
      expect(csvLines.some(l => l.endsWith(',0'))).toBe(true);
      expect(exportedCsv).toContain(',false,');

      // Direct DatabaseService formatting assertions
      expect(DatabaseService.formatCSVCell(0)).toBe('0');
      expect(DatabaseService.formatCSVCell(false)).toBe('false');
      expect(DatabaseService.formatCSVCell('0')).toBe('0');
      expect(DatabaseService.formatCSVCell('false')).toBe('false');
    });

    it('1.3 verifies protection of id, sn, idx, and pure numeric headers (2024) throughout the pipeline', async () => {
      const rawCsv = [
        'id,sn,idx,2024,description',
        '1,SN-001,0,98.5,Alpha Batch',
        '2,SN-002,1,102.3,Beta Batch',
      ].join('\n');

      // 1. Ingestion preservation check
      const parsed = CSVProcessor.parse(rawCsv);
      expect(parsed.headers).toContain('id');
      expect(parsed.headers).toContain('sn');
      expect(parsed.headers).toContain('idx');
      expect(parsed.headers).toContain('2024');
      expect(parsed.headers).toContain('description');

      // Confirm DataUtils index detector does NOT flag protected keys or year columns
      expect(DataUtils.isIndexColumn('id', ['1', '2'])).toBe(false);
      expect(DataUtils.isIndexColumn('sn', ['SN-001', 'SN-002'])).toBe(false);
      expect(DataUtils.isIndexColumn('idx', ['0', '1'])).toBe(false);
      expect(DataUtils.isIndexColumn('2024', ['98.5', '102.3'])).toBe(false);

      // 2. Candidate key discovery check
      const fds: FunctionalDependency[] = [
        makeFD(['id'], 'sn'),
        makeFD(['id'], 'idx'),
        makeFD(['id', '2024'], 'description'),
      ];
      const keyResult = await NormalizationEngine.findKeys(parsed.headers, fds);
      expect(keyResult.candidateKeys.some(k => k.includes('id'))).toBe(true);

      // 3. Database DDL quoting check on numeric headers (leading digit sanitized with underscore)
      const decomposed: DecomposedRelation = {
        name: 'annual_metrics',
        attributes: ['id', 'sn', 'idx', '2024'],
        primaryKey: ['id'],
        columnTypes: { id: 'integer', sn: 'string', idx: 'integer', '2024': 'decimal' },
      };

      const sqliteDDL = DatabaseService.generateDDL([decomposed], 'sqlite');
      expect(sqliteDDL).toContain('"_2024" DECIMAL');
      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();

      const mysqlDDL = DatabaseService.generateDDL([decomposed], 'mysql');
      expect(mysqlDDL).toContain('`_2024`');
    });

    it('1.4 verifies topological sort on linear and branching DAG workflows', () => {
      const createNode = (id: string, label: string): Node => ({
        id,
        position: { x: 0, y: 0 },
        data: { label },
      });
      const createEdge = (source: string, target: string): Edge => ({
        id: `e${source}-${target}`,
        source,
        target,
      });

      // 1. Linear Workflow: Start -> 1NF -> 2NF -> 3NF -> SQL Generator
      const linearNodes: Node[] = [
        createNode('0', 'Start'),
        createNode('1', '1NF'),
        createNode('2', '2NF'),
        createNode('3', '3NF'),
        createNode('4', 'SQL Generator'),
      ];
      const linearEdges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4'),
      ];

      expect(START_NODE_ID).toBe('0');
      const directOrder = getTopologicalOrder(linearNodes, linearEdges);
      expect(directOrder.hasCycle).toBe(false);
      expect(directOrder.sortedLabels).toEqual(['1NF', '2NF', '3NF', 'SQL Generator']);

      const linearResult = topologicalSortWorkflow(linearNodes, linearEdges);
      expect(linearResult.hasCycle).toBe(false);
      expect(linearResult.operationLabels).toEqual(['1NF', '2NF', '3NF', 'SQL Generator']);

      // 2. Branching DAG Workflow: Start -> 1NF -> FD Miner -> 2NF -> 3NF -> {SQL Generator, Report Generator}
      const branchNodes: Node[] = [
        createNode('0', 'Start'),
        createNode('1', '1NF'),
        createNode('2', 'FD Miner'),
        createNode('3', '2NF'),
        createNode('4', '3NF'),
        createNode('5', 'SQL Generator'),
        createNode('6', 'Report Generator'),
      ];
      const branchEdges: Edge[] = [
        createEdge('0', '1'),
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '4'),
        createEdge('4', '5'),
        createEdge('4', '6'),
      ];

      const branchResult = topologicalSortWorkflow(branchNodes, branchEdges);
      expect(branchResult.hasCycle).toBe(false);
      expect(branchResult.operationLabels.slice(0, 4)).toEqual(['1NF', 'FD Miner', '2NF', '3NF']);
      expect(branchResult.operationLabels).toContain('SQL Generator');
      expect(branchResult.operationLabels).toContain('Report Generator');

      // 3. Inverted node array order still resolves strictly to dependency DAG order
      const reversedNodes = [...branchNodes].reverse();
      const reverseSortedResult = topologicalSortWorkflow(reversedNodes, branchEdges);
      expect(reverseSortedResult.hasCycle).toBe(false);
      expect(reverseSortedResult.operationLabels.slice(0, 4)).toEqual(['1NF', 'FD Miner', '2NF', '3NF']);

      // 4. Directed cycle detection
      const cyclicEdges: Edge[] = [
        ...branchEdges,
        createEdge('4', '1'), // 3NF -> 1NF feedback loop creates cycle
      ];
      const cyclicResult = topologicalSortWorkflow(branchNodes, cyclicEdges);
      expect(cyclicResult.hasCycle).toBe(true);
      expect(cyclicResult.cycleNodeLabels.length).toBeGreaterThan(0);
    });

  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {

    it('2.1 handles single-attribute tables R(A) with no functional dependencies', async () => {
      const attributes = ['category_code'];
      const fds: FunctionalDependency[] = [];
      const data = [{ category_code: 'ELEC' }, { category_code: 'FURN' }];

      // Candidate key discovery
      const keyResult = await NormalizationEngine.findKeys(attributes, fds);
      expect(keyResult.candidateKeys).toEqual([['category_code']]);

      // Normal forms evaluation (trivially in 1NF, 2NF, 3NF, BCNF)
      const nf1 = NormalizationEngine.is1NF(data);
      expect(nf1.is1NF).toBe(true);

      const nf2 = NormalizationEngine.is2NF(attributes, fds, keyResult.candidateKeys);
      expect(nf2.is2NF).toBe(true);

      const nf3 = NormalizationEngine.is3NF(attributes, fds, keyResult.candidateKeys);
      expect(nf3.is3NF).toBe(true);

      const bcnf = NormalizationEngine.isBCNF(attributes, fds, keyResult.candidateKeys);
      expect(bcnf.isBCNF).toBe(true);

      // Synthesis
      const synthesized = await NormalizationEngine.synthesize3NF(fds, keyResult.candidateKeys, data, attributes);
      expect(synthesized).toHaveLength(1);
      expect(synthesized[0].attributes).toEqual(['category_code']);
      expect(synthesized[0].primaryKey).toEqual(['category_code']);

      // DDL generation
      const ddl = DatabaseService.generateDDL([toDecomposedRelation(synthesized[0], { category_code: 'string' })], 'sqlite');
      expect(ddl).toContain('"category_code" TEXT PRIMARY KEY');
      expect(() => verifySQLiteExecution(ddl)).not.toThrow();

      // Chase lossless join on single relation
      const isLossless = await NormalizationEngine.checkLosslessJoin(synthesized, fds);
      expect(isLossless).toBe(true);
    });

    it('2.2 handles disconnected independent attributes not present in any functional dependency', async () => {
      // Schema: R(A, B, C, X_tag, Y_tag)
      // FDs: A -> B, B -> C
      // Independent attributes: X_tag, Y_tag
      const attributes = ['A', 'B', 'C', 'X_tag', 'Y_tag'];
      const fds: FunctionalDependency[] = [
        makeFD(['A'], 'B'),
        makeFD(['B'], 'C'),
      ];
      const data = [
        { A: 'a1', B: 'b1', C: 'c1', X_tag: 'x1', Y_tag: 'y1' },
        { A: 'a2', B: 'b2', C: 'c2', X_tag: 'x2', Y_tag: 'y2' },
      ];

      // Candidate key MUST include all unspanned independent attributes
      const keyResult = await NormalizationEngine.findKeys(attributes, fds);
      expect(keyResult.candidateKeys).toHaveLength(1);
      const ck = keyResult.candidateKeys[0];
      expect(ck).toContain('A');
      expect(ck).toContain('X_tag');
      expect(ck).toContain('Y_tag');

      // Synthesize 3NF
      const relations = await NormalizationEngine.synthesize3NF(fds, keyResult.candidateKeys, data, attributes);

      // All attributes must be retained across synthesized relations
      const allAttributesCovered = new Set(relations.flatMap(r => r.attributes));
      expect(allAttributesCovered.has('X_tag')).toBe(true);
      expect(allAttributesCovered.has('Y_tag')).toBe(true);

      // Verify Chase guarantees lossless join
      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);
    });

    it('2.3 handles cyclic functional dependencies (A -> B, B -> C, C -> A) without infinite loops', async () => {
      const attributes = ['A', 'B', 'C', 'D'];
      const fds: FunctionalDependency[] = [
        makeFD(['A'], 'B'),
        makeFD(['B'], 'C'),
        makeFD(['C'], 'A'),
        makeFD(['A'], 'D'),
      ];
      const data = [
        { A: '1', B: '1', C: '1', D: 'x' },
        { A: '2', B: '2', C: '2', D: 'y' },
      ];

      // Closures must cover universal set {A, B, C, D}
      expect(Array.from(NormalizationEngine.computeClosure(['A'], fds)).sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(Array.from(NormalizationEngine.computeClosure(['B'], fds)).sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(Array.from(NormalizationEngine.computeClosure(['C'], fds)).sort()).toEqual(['A', 'B', 'C', 'D']);

      // Must discover all 3 candidate keys: ['A'], ['B'], ['C']
      const keyResult = await NormalizationEngine.findKeys(attributes, fds);
      const discoveredKeys = keyResult.candidateKeys.map(k => k[0]).sort();
      expect(discoveredKeys).toEqual(['A', 'B', 'C']);

      // Prime attributes: A, B, C are prime; D is non-prime
      const primeClassification = NormalizationEngine.classifyAttributes(attributes, keyResult.candidateKeys);
      expect(primeClassification.prime.sort()).toEqual(['A', 'B', 'C']);
      expect(primeClassification.nonPrime).toEqual(['D']);

      // Canonical cover computes cleanly
      const canonical = NormalizationEngine.computeCanonicalCover(fds);
      expect(canonical.singletonCover.length).toBeGreaterThan(0);

      // 3NF synthesis
      const synthesized = await NormalizationEngine.synthesize3NF(canonical.singletonCover, keyResult.candidateKeys, data);
      expect(synthesized.length).toBeGreaterThan(0);

      const isLossless = await NormalizationEngine.checkLosslessJoin(synthesized, fds);
      expect(isLossless).toBe(true);

      const isPreserved = await NormalizationEngine.checkDependencyPreservation(synthesized, fds);
      expect(isPreserved).toBe(true);
    });

    it('2.4 handles composite keys with 4 attributes and generates table-level SQL constraints', async () => {
      const relation: DecomposedRelation = {
        name: 'warehouse_slotting',
        attributes: ['zone_id', 'aisle_id', 'rack_id', 'shelf_id', 'sku_code', 'capacity'],
        primaryKey: ['zone_id', 'aisle_id', 'rack_id', 'shelf_id'],
        columnTypes: {
          zone_id: 'integer',
          aisle_id: 'integer',
          rack_id: 'integer',
          shelf_id: 'integer',
          sku_code: 'string',
          capacity: 'integer',
        },
      };

      const dialects: SQLDialect[] = ['postgresql', 'sqlite', 'mysql', 'ansi'];
      for (const dialect of dialects) {
        const ddl = DatabaseService.generateTableDDL(relation, dialect);
        expect(ddl).toContain('PRIMARY KEY');
        // Must NOT have inline PRIMARY KEY on constituent columns
        if (dialect === 'mysql') {
          expect(ddl).toContain('`zone_id` INT NOT NULL');
          expect(ddl).toContain('PRIMARY KEY (`zone_id`, `aisle_id`, `rack_id`, `shelf_id`)');
        } else {
          expect(ddl).toContain('"zone_id" INTEGER NOT NULL');
          expect(ddl).toContain('PRIMARY KEY ("zone_id", "aisle_id", "rack_id", "shelf_id")');
        }
      }

      // SQLite verification with composite key enforcement
      const script = `
${DatabaseService.generateDDL([relation], 'sqlite')}
INSERT INTO "warehouse_slotting" VALUES (1, 2, 3, 4, 'SKU-A', 50);
INSERT INTO "warehouse_slotting" VALUES (1, 2, 3, 5, 'SKU-B', 30);
`;
      expect(() => verifySQLiteExecution(script)).not.toThrow();

      const duplicateScript = `
${script}
INSERT INTO "warehouse_slotting" VALUES (1, 2, 3, 4, 'SKU-DUPE', 20); -- Fails composite PK!
`;
      expect(() => verifySQLiteExecution(duplicateScript)).toThrow();
    });

    it('2.5 handles tables and columns named with SQL reserved keywords', () => {
      const reservedKeywords = ['order', 'user', 'group', 'table', 'select', 'where', 'check', 'from'];
      for (const kw of reservedKeywords) {
        expect(SQL_RESERVED_KEYWORDS.has(kw.toUpperCase())).toBe(true);
      }

      // Identifier quoting
      expect(quoteIdentifier('order', 'postgresql')).toBe('"order"');
      expect(quoteIdentifier('user', 'sqlite')).toBe('"user"');
      expect(quoteIdentifier('group', 'mysql')).toBe('`group`');

      // Dialect type mappings for reserved keyword types
      expect(mapDataTypeToDialect('integer', 'sqlite')).toBe('INTEGER');
      expect(mapDataTypeToDialect('boolean', 'sqlite')).toBe('INTEGER');
      expect(mapDataTypeToDialect('boolean', 'mysql')).toBe('TINYINT(1)');
      expect(mapDataTypeToDialect('boolean', 'postgresql')).toBe('BOOLEAN');

      const relation: DecomposedRelation = {
        name: 'order',
        attributes: ['user', 'group', 'table', 'select', 'where'],
        primaryKey: ['user', 'table'],
        columnTypes: {
          user: 'string',
          group: 'string',
          table: 'string',
          select: 'integer',
          where: 'boolean',
        },
      };

      const sqliteDDL = DatabaseService.generateDDL([relation], 'sqlite');
      expect(sqliteDDL).toContain('CREATE TABLE "order"');
      expect(sqliteDDL).toContain('"user" TEXT NOT NULL');
      expect(sqliteDDL).toContain('"group" TEXT');
      expect(sqliteDDL).toContain('"select" INTEGER');
      expect(sqliteDDL).toContain('"where" INTEGER');
      expect(sqliteDDL).toContain('PRIMARY KEY ("user", "table")');
      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();
    });

    it('2.6 correctly detects non-prime RHS transitive dependencies in 3NF verification', () => {
      // Schema: R(StudentID, DepartmentID, DepartmentBuilding)
      // StudentID -> DepartmentID
      // DepartmentID -> DepartmentBuilding
      // Candidate Key: StudentID
      // Prime: StudentID
      // Non-Prime: DepartmentID, DepartmentBuilding
      // DepartmentID -> DepartmentBuilding has non-prime RHS and non-superkey LHS -> violates 3NF!
      const attributes = ['StudentID', 'DepartmentID', 'DepartmentBuilding'];
      const fds: FunctionalDependency[] = [
        makeFD(['StudentID'], 'DepartmentID'),
        makeFD(['DepartmentID'], 'DepartmentBuilding'),
      ];
      const candidateKeys = [['StudentID']];

      const res2NF = NormalizationEngine.is2NF(attributes, fds, candidateKeys);
      expect(res2NF.is2NF).toBe(true); // Single attribute key cannot have partial dependencies

      const res3NF = NormalizationEngine.is3NF(attributes, fds, candidateKeys);
      expect(res3NF.is3NF).toBe(false);
      expect(res3NF.transitiveDependencies!.length).toBeGreaterThan(0);
      expect(res3NF.transitiveDependencies![0].lhs).toEqual(['DepartmentID']);
      expect(res3NF.transitiveDependencies![0].rhs).toBe('DepartmentBuilding');
    });

    it('2.7 verifies Chase algorithm mathematically differentiates lossless from lossy decompositions', async () => {
      // Universal relation: R(A, B, C), F = { B -> C }
      // Decomposition 1: R1(A, B), R2(B, C) -> LOSSLESS by Heath's theorem (R1 ∩ R2 = B, B -> C)
      const losslessRelations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A', 'B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [makeFD(['B'], 'C')];

      const chaseLossless = NormalizationEngine.chaseAlgorithm(losslessRelations, fds);
      expect(chaseLossless.isLossless).toBe(true);
      expect(chaseLossless.fullyDistinguishedRowIndex).toBeGreaterThanOrEqual(0);

      // Decomposition 2: R1(A, B), R2(A, C) -> LOSSY (R1 ∩ R2 = A, but A does NOT determine B or C)
      const lossyRelations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['A', 'C'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];

      const chaseLossy = NormalizationEngine.chaseAlgorithm(lossyRelations, fds);
      expect(chaseLossy.isLossless).toBe(false);
      expect(chaseLossy.fullyDistinguishedRowIndex).toBe(-1);
    });

  });

  // ==========================================================================
  // TIER 3: Cross-Feature Combinations (Pairwise Interlocking)
  // ==========================================================================
  describe('Tier 3: Cross-Feature Combinations (Pairwise Interlocking)', () => {

    it('3.1 combines multiline quoted CSV ingestion + composite FD mining + candidate key search + BCNF decomposition + SQLite DDL with in-table FKs', async () => {
      // Ingestion with multiline field containing commas
      const rawCsv = [
        'dept,course_num,course_name,syllabus_notes,instructor',
        'CS,101,Intro to CS,"Lecture, Lab,\nand Discussion Sessions",Prof. Turing',
        'CS,102,Data Structures,"Stacks, Queues,\nand Tree Structures",Prof. Knuth',
        'EE,101,Circuits,"AC, DC,\nand Transient Analysis",Prof. Ohm',
      ].join('\n');

      const parsed = CSVProcessor.parse(rawCsv);
      expect(parsed.data).toHaveLength(3);
      expect(parsed.data[0].syllabus_notes).toContain('Lecture, Lab,\nand Discussion Sessions');

      const cleaned = await DataProcessor.clean(parsed.data);

      // Mining composite determinants
      const { fds } = mineFunctionalDependencies(cleaned, { maxLhsSize: 2, minConfidence: 1.0 });
      expect(fds.length).toBeGreaterThan(0);

      // Candidate key search
      const keyResult = await NormalizationEngine.findKeys(parsed.headers, fds);
      expect(keyResult.candidateKeys.length).toBeGreaterThan(0);

      // Decompose into BCNF
      const bcnfResult = await NormalizationEngine.decomposeBCNFDetailed(parsed.headers, fds, cleaned);
      expect(bcnfResult.relations.length).toBeGreaterThan(0);
      expect(bcnfResult.isLossless).toBe(true);

      for (const rel of bcnfResult.relations) {
        const check = NormalizationEngine.isBCNF(rel.attributes, fds);
        expect(check.isBCNF).toBe(true);
      }

      // Convert to DecomposedRelation with foreign keys
      const decomposed = bcnfResult.relations.map(r => toDecomposedRelation(r));
      const sqliteDDL = DatabaseService.generateDDL(decomposed, 'sqlite');
      expect(sqliteDDL).toContain('CREATE TABLE');
      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();
    });

    it('3.2 combines streaming CSV parsing + type inference with 0/false preservation + 3NF synthesis with candidate key injection + PostgreSQL DDL', async () => {
      const rows: Record<string, any>[] = [];
      let streamingHeaders: string[] = [];

      const parser = new StreamingCSVParser({
        onHeaders: (headers) => { streamingHeaders = headers; },
        onRow: (row) => rows.push(row),
      });

      // Stream data in 3 discrete chunks
      const chunk1 = 'sensor_id,location,reading_val,is_active,maintenance_date\n';
      const chunk2 = 'S01,"Zone A, Shelf 1",0,false,2025-01-15\nS02,"Zone A,';
      const chunk3 = ' Shelf 2",42.5,true,2025-01-16\nS03,"Zone B, Shelf 1",0,false,2025-01-17\n';

      parser.feed(chunk1);
      parser.feed(chunk2);
      parser.feed(chunk3);
      parser.finish();

      expect(rows).toHaveLength(3);
      expect(streamingHeaders).toEqual(['sensor_id', 'location', 'reading_val', 'is_active', 'maintenance_date']);
      expect(rows[0].reading_val).toBe('0');
      expect(rows[0].is_active).toBe('false');

      // Type Inference
      const valType = DataUtils.inferDataType(rows.map(r => r.reading_val));
      const activeType = DataUtils.inferDataType(rows.map(r => r.is_active));
      const dateType = DataUtils.inferDataType(rows.map(r => r.maintenance_date));

      expect(valType).toBe('decimal'); // Because row 1 has 42.5
      expect(activeType).toBe('boolean');
      expect(dateType).toBe('date');

      // Functional dependencies with unspanned attribute to trigger candidate key injection
      // FDs: sensor_id -> location, reading_val, is_active
      // maintenance_date is NOT in any FD -> Candidate key is {sensor_id, maintenance_date}
      const fds: FunctionalDependency[] = [
        makeFD(['sensor_id'], 'location'),
        makeFD(['sensor_id'], 'reading_val'),
        makeFD(['sensor_id'], 'is_active'),
      ];
      const candidateKeys = [['sensor_id', 'maintenance_date']];

      const synthesized = await NormalizationEngine.synthesize3NF(fds, candidateKeys, rows, streamingHeaders);
      expect(synthesized.length).toBeGreaterThanOrEqual(2);

      // Verify injected candidate key relation
      const hasCkRelation = synthesized.some(
        r => r.attributes.includes('sensor_id') && r.attributes.includes('maintenance_date')
      );
      expect(hasCkRelation).toBe(true);

      // Generate PostgreSQL DDL
      const decomposed = synthesized.map(s => toDecomposedRelation(s, {
        sensor_id: 'string',
        location: 'string',
        reading_val: valType,
        is_active: activeType,
        maintenance_date: dateType,
      }));

      const postgresDDL = DatabaseService.generateDDL(decomposed, 'postgresql');
      expect(postgresDDL).toContain('BEGIN;');
      expect(postgresDDL).toContain('BOOLEAN');
      expect(postgresDDL).toContain('DATE');
      expect(postgresDDL).toContain('COMMIT;');
    });

    it('3.3 combines workflow graph cycle detection + topological ordering + sequence validation + execution plan generation', () => {
      const createNode = (id: string, label: string): Node => ({
        id,
        position: { x: 0, y: 0 },
        data: { label },
      });
      const createEdge = (source: string, target: string): Edge => ({
        id: `e${source}-${target}`,
        source,
        target,
      });

      // Valid sequence fulfilling all operation dependency requirements:
      // Start -> CSV Data Loader -> Data Cleaner -> Atomicity Checker -> Data Type Profiler -> 1NF -> FD Miner -> Key Discovery -> 2NF -> 3NF -> Relation Generator -> SQL Generator
      const validLabels = [
        'CSV Data Loader',
        'Data Cleaner',
        'Atomicity Checker',
        'Data Type Profiler',
        '1NF',
        'FD Miner',
        'Key Discovery',
        '2NF',
        '3NF',
        'Relation Generator',
        'SQL Generator',
      ];
      const validNodes: Node[] = [
        createNode('0', 'Start'),
        ...validLabels.map((lbl, idx) => createNode(String(idx + 1), lbl)),
      ];
      const validEdges: Edge[] = [
        createEdge('0', '1'),
        ...validLabels.slice(1).map((_, idx) => createEdge(String(idx + 1), String(idx + 2))),
      ];

      const seqCheck = validateSequence(validNodes);
      expect(seqCheck.isValid).toBe(true);
      expect(seqCheck.errors).toHaveLength(0);

      const plan = topologicalSortWorkflow(validNodes, validEdges);
      expect(plan.hasCycle).toBe(false);
      expect(plan.operationLabels).toEqual(validLabels);

      // Invalid sequence: 2NF before 1NF
      const outOfOrderNodes: Node[] = [
        createNode('0', 'Start'),
        createNode('1', '2NF'),
        createNode('2', '1NF'),
      ];
      const outOfOrderSeq = validateSequence(outOfOrderNodes);
      expect(outOfOrderSeq.isValid).toBe(false);
      expect(outOfOrderSeq.errors.some(e => e.includes('1NF'))).toBe(true);

      // Missing prerequisite: SQL Generator without Relation Generator
      const missingPrereqNodes: Node[] = [
        createNode('0', 'Start'),
        createNode('1', '1NF'),
        createNode('2', 'SQL Generator'),
      ];
      const missingSeq = validateSequence(missingPrereqNodes);
      expect(missingSeq.isValid).toBe(false);
      expect(missingSeq.errors.some(e => e.includes('Relation Generator'))).toBe(true);

      // Cycle in graph
      const cyclicEdges: Edge[] = [
        ...validEdges,
        createEdge(String(validLabels.length), '5'), // SQL Generator -> 1NF loop
      ];
      const cyclicPlan = topologicalSortWorkflow(validNodes, cyclicEdges);
      expect(cyclicPlan.hasCycle).toBe(true);
      expect(cyclicPlan.cycleNodeLabels.length).toBeGreaterThan(0);
    });

  });

  // ==========================================================================
  // TIER 4: Real-World Workloads
  // ==========================================================================
  describe('Tier 4: Real-World Application Workloads', () => {

    it('4.1 University Registrar Workload: End-to-end flat schema normalization (3NF/BCNF, Chase, DDL, CSV export)', async () => {
      // Schema: Registrar(StudentID, StudentName, Major, AdvisorID, AdvisorName, CourseID, CourseTitle, Credits, InstructorID, InstructorName, Semester, Grade)
      const attributes = [
        'StudentID',
        'StudentName',
        'Major',
        'AdvisorID',
        'AdvisorName',
        'CourseID',
        'CourseTitle',
        'Credits',
        'InstructorID',
        'InstructorName',
        'Semester',
        'Grade',
      ];

      // Realistic University Registrar Data
      const registrarData = [
        {
          StudentID: 'S1001',
          StudentName: 'Alice Chen',
          Major: 'Computer Science',
          AdvisorID: 'ADV-01',
          AdvisorName: 'Dr. Turing',
          CourseID: 'CS101',
          CourseTitle: 'Data Structures',
          Credits: '4',
          InstructorID: 'INS-01',
          InstructorName: 'Prof. Knuth',
          Semester: 'Fall 2025',
          Grade: 'A',
        },
        {
          StudentID: 'S1001',
          StudentName: 'Alice Chen',
          Major: 'Computer Science',
          AdvisorID: 'ADV-01',
          AdvisorName: 'Dr. Turing',
          CourseID: 'MATH201',
          CourseTitle: 'Linear Algebra',
          Credits: '3',
          InstructorID: 'INS-02',
          InstructorName: 'Prof. Gauss',
          Semester: 'Fall 2025',
          Grade: 'A-',
        },
        {
          StudentID: 'S1002',
          StudentName: 'Bob Martinez',
          Major: 'Physics',
          AdvisorID: 'ADV-02',
          AdvisorName: 'Dr. Feynman',
          CourseID: 'CS101',
          CourseTitle: 'Data Structures',
          Credits: '4',
          InstructorID: 'INS-01',
          InstructorName: 'Prof. Knuth',
          Semester: 'Fall 2025',
          Grade: 'B+',
        },
        {
          StudentID: 'S1002',
          StudentName: 'Bob Martinez',
          Major: 'Physics',
          AdvisorID: 'ADV-02',
          AdvisorName: 'Dr. Feynman',
          CourseID: 'PHYS101',
          CourseTitle: 'Classical Mechanics',
          Credits: '4',
          InstructorID: 'INS-03',
          InstructorName: 'Prof. Newton',
          Semester: 'Spring 2026',
          Grade: 'A',
        },
      ];

      // Standard Registrar Functional Dependencies
      const fds: FunctionalDependency[] = [
        makeFD(['StudentID'], 'StudentName'),
        makeFD(['StudentID'], 'Major'),
        makeFD(['StudentID'], 'AdvisorID'),
        makeFD(['AdvisorID'], 'AdvisorName'),
        makeFD(['CourseID'], 'CourseTitle'),
        makeFD(['CourseID'], 'Credits'),
        makeFD(['InstructorID'], 'InstructorName'),
        makeFD(['StudentID', 'CourseID', 'Semester'], 'Grade'),
        makeFD(['StudentID', 'CourseID', 'Semester'], 'InstructorID'),
      ];

      // 1. Candidate Key Computation: Key is (StudentID, CourseID, Semester)
      const keyResult = await NormalizationEngine.findKeys(attributes, fds);
      expect(keyResult.candidateKeys).toHaveLength(1);
      const ck = [...keyResult.candidateKeys[0]].sort();
      expect(ck).toEqual(['CourseID', 'Semester', 'StudentID']);

      // 2. Normal Form Verification
      const nf1 = NormalizationEngine.is1NF(registrarData);
      expect(nf1.is1NF).toBe(true);

      const nf2 = NormalizationEngine.is2NF(attributes, fds, keyResult.candidateKeys);
      expect(nf2.is2NF).toBe(false); // Partial dependencies: StudentID -> StudentName, CourseID -> CourseTitle
      expect(nf2.partialDependencies!.length).toBeGreaterThan(0);

      const nf3 = NormalizationEngine.is3NF(attributes, fds, keyResult.candidateKeys);
      expect(nf3.is3NF).toBe(false); // Transitive dependencies: AdvisorID -> AdvisorName, InstructorID -> InstructorName

      // 3. Canonical Cover
      const canonical = NormalizationEngine.computeCanonicalCover(fds);
      expect(canonical.singletonCover.length).toBeGreaterThan(0);

      // 4. 3NF Synthesis (Bernstein's Algorithm)
      const relations3NF = await NormalizationEngine.synthesize3NF(
        canonical.singletonCover,
        keyResult.candidateKeys,
        registrarData,
        attributes
      );

      // Must produce distinct synthesized tables for Student, Advisor, Course, Instructor, and Enrollment
      expect(relations3NF.length).toBeGreaterThanOrEqual(4);

      // Verify Chase Algorithm proves Lossless Join
      const isLossless = await NormalizationEngine.checkLosslessJoin(relations3NF, fds);
      expect(isLossless).toBe(true);

      // Verify Ullman Dependency Preservation
      const preservation = NormalizationEngine.checkDependencyPreservationDetails(relations3NF, fds);
      expect(preservation.isPreserved).toBe(true);
      expect(preservation.preservationRatio).toBe(1.0);
      expect(preservation.lost).toHaveLength(0);

      // 5. Schema & SQL DDL Generation
      const columnTypes: Record<string, string> = {
        StudentID: 'string',
        StudentName: 'string',
        Major: 'string',
        AdvisorID: 'string',
        AdvisorName: 'string',
        CourseID: 'string',
        CourseTitle: 'string',
        Credits: 'integer',
        InstructorID: 'string',
        InstructorName: 'string',
        Semester: 'string',
        Grade: 'string',
      };

      const decomposed = relations3NF.map(r => toDecomposedRelation(r, columnTypes));

      // PostgreSQL DDL
      const postgresDDL = DatabaseService.generateDDL(decomposed, 'postgresql');
      expect(postgresDDL).toContain('BEGIN;');
      expect(postgresDDL).toContain('COMMIT;');

      // SQLite DDL & Empirical SQLite Execution
      const sqliteDDL = DatabaseService.generateDDL(decomposed, 'sqlite');
      expect(sqliteDDL).toContain('PRAGMA foreign_keys = OFF;');
      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();

      // 6. CSV Export of Synthesized Relations
      for (const rel of relations3NF) {
        const exportedCSV = exportRelationToCSV(rel.rows, rel.attributes);
        expect(exportedCSV.length).toBeGreaterThan(0);
        const lines = exportedCSV.split('\n');
        expect(lines.length).toBe(rel.rows.length + 1); // Header + data rows
      }
    });

    it('4.2 E-Commerce Order Fulfillment Workload: End-to-end flat schema normalization with composite PKs, reserved keywords, and 0/false preservation', async () => {
      // Schema: Orders(order, order_date, user, user_email, product_id, product_name, unit_price, quantity, total_price, warehouse_id, warehouse_city, is_delivered)
      // Note: 'order' and 'user' intentionally use SQL reserved keywords to verify escaping!
      const attributes = [
        'order',
        'order_date',
        'user',
        'user_email',
        'product_id',
        'product_name',
        'unit_price',
        'quantity',
        'total_price',
        'warehouse_id',
        'warehouse_city',
        'is_delivered',
      ];

      const ecommerceData = [
        {
          order: 'ORD-1001',
          order_date: '2026-03-01',
          user: 'USR-501',
          user_email: 'customer1@example.com',
          product_id: 'PRD-10',
          product_name: 'Wireless Ergonomic Keyboard',
          unit_price: 89.99,
          quantity: 0, // Out-of-stock backorder item (tests 0 preservation!)
          total_price: 0.0,
          warehouse_id: 'WH-EAST',
          warehouse_city: 'Newark',
          is_delivered: false, // tests false preservation!
        },
        {
          order: 'ORD-1001',
          order_date: '2026-03-01',
          user: 'USR-501',
          user_email: 'customer1@example.com',
          product_id: 'PRD-20',
          product_name: 'High Precision Mouse',
          unit_price: 49.99,
          quantity: 2,
          total_price: 99.98,
          warehouse_id: 'WH-EAST',
          warehouse_city: 'Newark',
          is_delivered: false,
        },
        {
          order: 'ORD-1002',
          order_date: '2026-03-02',
          user: 'USR-502',
          user_email: 'customer2@example.com',
          product_id: 'PRD-10',
          product_name: 'Wireless Ergonomic Keyboard',
          unit_price: 89.99,
          quantity: 1,
          total_price: 89.99,
          warehouse_id: 'WH-WEST',
          warehouse_city: 'Reno',
          is_delivered: true,
        },
      ];

      const fds: FunctionalDependency[] = [
        makeFD(['order'], 'order_date'),
        makeFD(['order'], 'user'),
        makeFD(['user'], 'user_email'),
        makeFD(['product_id'], 'product_name'),
        makeFD(['product_id'], 'unit_price'),
        makeFD(['order', 'product_id'], 'quantity'),
        makeFD(['order', 'product_id'], 'total_price'),
        makeFD(['order', 'product_id'], 'warehouse_id'),
        makeFD(['order', 'product_id'], 'is_delivered'),
        makeFD(['warehouse_id'], 'warehouse_city'),
      ];

      // 1. Candidate Key Computation: Key is composite (order, product_id)
      const keyResult = await NormalizationEngine.findKeys(attributes, fds);
      expect(keyResult.candidateKeys).toHaveLength(1);
      const ck = [...keyResult.candidateKeys[0]].sort();
      expect(ck).toEqual(['order', 'product_id']);

      // 2. Normal Form Checks
      const nf1 = NormalizationEngine.is1NF(ecommerceData);
      expect(nf1.is1NF).toBe(true);

      const nf2 = NormalizationEngine.is2NF(attributes, fds, keyResult.candidateKeys);
      expect(nf2.is2NF).toBe(false); // order -> order_date, user and product_id -> product_name are partial dependencies

      // 3. 3NF Synthesis
      const canonical = NormalizationEngine.computeCanonicalCover(fds);
      const relations3NF = await NormalizationEngine.synthesize3NF(
        canonical.singletonCover,
        keyResult.candidateKeys,
        ecommerceData,
        attributes
      );

      // Verify Chase Lossless Join
      const isLossless = await NormalizationEngine.checkLosslessJoin(relations3NF, fds);
      expect(isLossless).toBe(true);

      // Locate composite order item relation
      const orderItemRel = relations3NF.find(
        r => r.attributes.includes('order') && r.attributes.includes('product_id') && r.attributes.includes('quantity')
      );
      expect(orderItemRel).toBeDefined();
      expect([...orderItemRel!.primaryKey].sort()).toEqual(['order', 'product_id']);

      // 4. Verify 0 and false preservation inside synthesized relations
      const backorderedRow = orderItemRel!.rows.find(
        r => r.order === 'ORD-1001' && r.product_id === 'PRD-10'
      );
      expect(backorderedRow).toBeDefined();
      expect(backorderedRow.quantity).toBe(0);
      expect(backorderedRow.is_delivered).toBe(false);

      // 5. BCNF Decomposition
      const bcnfResult = await NormalizationEngine.decomposeBCNFDetailed(attributes, fds, ecommerceData);
      expect(bcnfResult.isLossless).toBe(true);
      for (const r of bcnfResult.relations) {
        const check = NormalizationEngine.isBCNF(r.attributes, fds);
        expect(check.isBCNF).toBe(true);
      }

      // 6. SQL DDL Generation & Verification across Dialects
      const columnTypes: Record<string, string> = {
        order: 'string',
        order_date: 'date',
        user: 'string',
        user_email: 'email',
        product_id: 'string',
        product_name: 'string',
        unit_price: 'decimal',
        quantity: 'integer',
        total_price: 'decimal',
        warehouse_id: 'string',
        warehouse_city: 'string',
        is_delivered: 'boolean',
      };

      const decomposed = relations3NF.map(r => toDecomposedRelation(r, columnTypes));

      // SQLite DDL: checks quoted reserved keywords and table-level composite PK
      const sqliteDDL = DatabaseService.generateDDL(decomposed, 'sqlite');
      expect(sqliteDDL).toContain('"order"');
      expect(sqliteDDL).toContain('"user"');
      expect(sqliteDDL).toContain('PRIMARY KEY ("order", "product_id")');
      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();

      // PostgreSQL DDL
      const postgresDDL = DatabaseService.generateDDL(decomposed, 'postgresql');
      expect(postgresDDL).toContain('BEGIN;');
      expect(postgresDDL).toContain('"order"');
      expect(postgresDDL).toContain('PRIMARY KEY ("order", "product_id")');
      expect(postgresDDL).toContain('COMMIT;');

      // MySQL DDL
      const mysqlDDL = DatabaseService.generateDDL(decomposed, 'mysql');
      expect(mysqlDDL).toContain('`order`');
      expect(mysqlDDL).toContain('`user`');
      expect(mysqlDDL).toContain('PRIMARY KEY (`order`, `product_id`)');
      expect(mysqlDDL).toContain('ENGINE=InnoDB');

      // 7. Verify SQLite Unique Composite Constraint Enforcement
      const userRel = relations3NF.find(r => r.primaryKey.includes('user'));
      const orderRel = relations3NF.find(r => r.primaryKey.includes('order') && !r.primaryKey.includes('product_id'));
      const productRel = relations3NF.find(r => r.primaryKey.includes('product_id') && !r.primaryKey.includes('order'));
      const warehouseRel = relations3NF.find(r => r.primaryKey.includes('warehouse_id'));

      const compositeTestScript = `
${sqliteDDL}
-- Insert prerequisite referenced parent rows to satisfy foreign key constraints
INSERT INTO "${userRel!.name}" ("user", "user_email") VALUES ('USR-99', 'test@test.com');
INSERT INTO "${orderRel!.name}" ("order", "order_date", "user") VALUES ('ORD-9999', '2026-03-01', 'USR-99');
INSERT INTO "${productRel!.name}" ("product_id", "product_name", "unit_price") VALUES ('PRD-99', 'Test Product', 9.99);
INSERT INTO "${warehouseRel!.name}" ("warehouse_id", "warehouse_city") VALUES ('WH-TEST', 'Test City');

-- Inserting unique composite row
INSERT INTO "${orderItemRel!.name}" ("order", "product_id", "quantity", "total_price", "warehouse_id", "is_delivered")
VALUES ('ORD-9999', 'PRD-99', 5, 49.95, 'WH-TEST', 1);
`;
      expect(() => verifySQLiteExecution(compositeTestScript)).not.toThrow();

      const duplicateCompositeScript = `
${compositeTestScript}
-- Duplicate on composite key (ORD-9999, PRD-99) must fail UNIQUE composite PK constraint
INSERT INTO "${orderItemRel!.name}" ("order", "product_id", "quantity", "total_price", "warehouse_id", "is_delivered")
VALUES ('ORD-9999', 'PRD-99', 10, 99.90, 'WH-TEST', 0);
`;
      expect(() => verifySQLiteExecution(duplicateCompositeScript)).toThrow();

      // 8. RFC 4180 CSV Export Serialization
      const exportedItemCSV = exportRelationToCSV(orderItemRel!.rows, orderItemRel!.attributes);
      expect(exportedItemCSV).toContain(',0,'); // Zero quantity preserved
      expect(exportedItemCSV).toContain('false'); // False delivery status preserved
    });

  });

});
