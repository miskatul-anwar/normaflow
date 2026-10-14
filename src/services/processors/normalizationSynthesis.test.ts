import { describe, it, expect } from 'vitest';
import {
  NormalizationEngine,
  FunctionalDependency,
  RelationSchema
} from './normalizationEngine';

describe('Normalization Synthesis & Advanced Verification - Milestone 3 Test Suite', () => {

  // Helper factory for FunctionalDependency
  function fd(lhs: string[], rhs: string, confidence: number = 1): FunctionalDependency {
    return {
      lhs,
      rhs,
      confidence,
      coverage: 1,
      violations: 0,
      uniqueGroups: 1,
    };
  }

  // =========================================================================
  // SECTION 1: 3NF Synthesis (Bernstein's Algorithm)
  // =========================================================================
  describe('3NF Synthesis (Bernstein Algorithm)', () => {
    it('groups functional dependencies with identical determinants into a single unified relation', async () => {
      // F = { A -> B, A -> C, A -> D }. Buggy engine created 3 separate binary relations.
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['A'], 'C'),
        fd(['A'], 'D'),
      ];
      const candidateKeys = [['A']];
      const data = [
        { A: '1', B: 'b1', C: 'c1', D: 'd1' },
        { A: '2', B: 'b2', C: 'c2', D: 'd2' },
      ];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, data);

      expect(relations).toHaveLength(1);
      expect([...relations[0].attributes].sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(relations[0].primaryKey).toEqual(['A']);
    });

    it('synthesizes textbook Employee-Department-Project schema into exactly 4 non-redundant 3NF relations', async () => {
      // Benchmark B2
      const fds: FunctionalDependency[] = [
        fd(['emp_id'], 'emp_name'),
        fd(['emp_id'], 'dept_id'),
        fd(['dept_id'], 'dept_name'),
        fd(['proj_id'], 'proj_name'),
        fd(['emp_id', 'proj_id'], 'hours'),
      ];
      const candidateKeys = [['emp_id', 'proj_id']];
      const data = [
        { emp_id: 'E1', emp_name: 'Alice', dept_id: 'D1', dept_name: 'Engineering', proj_id: 'P1', proj_name: 'Alpha', hours: 20 },
        { emp_id: 'E2', emp_name: 'Bob', dept_id: 'D1', dept_name: 'Engineering', proj_id: 'P1', proj_name: 'Alpha', hours: 15 },
      ];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, data);

      expect(relations).toHaveLength(4);

      // Verify each expected relation exists
      const hasEmp = relations.some(r =>
        r.primaryKey.length === 1 && r.primaryKey[0] === 'emp_id' &&
        r.attributes.includes('emp_name') && r.attributes.includes('dept_id')
      );
      const hasDept = relations.some(r =>
        r.primaryKey.length === 1 && r.primaryKey[0] === 'dept_id' &&
        r.attributes.includes('dept_name')
      );
      const hasProj = relations.some(r =>
        r.primaryKey.length === 1 && r.primaryKey[0] === 'proj_id' &&
        r.attributes.includes('proj_name')
      );
      const hasAssignment = relations.some(r =>
        r.primaryKey.length === 2 && r.primaryKey.includes('emp_id') && r.primaryKey.includes('proj_id') &&
        r.attributes.includes('hours')
      );

      expect(hasEmp).toBe(true);
      expect(hasDept).toBe(true);
      expect(hasProj).toBe(true);
      expect(hasAssignment).toBe(true);

      // Verify each relation satisfies 3NF
      for (const rel of relations) {
        const check3NF = NormalizationEngine.is3NF(rel.attributes, fds, [rel.primaryKey]);
        expect(check3NF.is3NF).toBe(true);
      }
    });

    it('adds a candidate key relation when no functional dependency covers any candidate key', async () => {
      // Benchmark B3: R(A, B, C, D), F = { A -> B, B -> C }, Key: {A, D}
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
      ];
      const candidateKeys = [['A', 'D']];
      const data = [
        { A: 'a1', B: 'b1', C: 'c1', D: 'd1' },
        { A: 'a2', B: 'b2', C: 'c2', D: 'd2' },
      ];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, data);

      // Relations should include: R_A(A, B), R_B(B, C), and candidate key relation R_K(A, D)
      expect(relations).toHaveLength(3);
      const keyRel = relations.find(r => r.primaryKey.includes('A') && r.primaryKey.includes('D'));
      expect(keyRel).toBeDefined();
      expect([...keyRel!.attributes].sort()).toEqual(['A', 'D']);

      // Without this candidate key relation, the decomposition would be lossy
      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);
    });

    it('eliminates redundant relations with identical attribute sets arising from cyclic dependencies', async () => {
      // Benchmark B4: R(A, B, C), F = { A -> B, B -> A, A -> C }
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'A'),
        fd(['A'], 'C'),
      ];
      const candidateKeys = [['A'], ['B']];
      const data = [
        { A: '1', B: '10', C: 'x' },
        { A: '2', B: '20', C: 'y' },
      ];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, data);

      // From A: {A, B, C}. From B: {B, A}.
      // Since {B, A} is a subset of {A, B, C}, {B, A} must be pruned!
      expect(relations).toHaveLength(1);
      expect([...relations[0].attributes].sort()).toEqual(['A', 'B', 'C']);
    });

    it('eliminates proper subset relations contained within larger synthesized relations', async () => {
      // F = { A -> B, A -> C, AB -> C }
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['A'], 'C'),
        fd(['A', 'B'], 'C'),
      ];
      const candidateKeys = [['A']];
      const data = [
        { A: '1', B: 'b1', C: 'c1' },
      ];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, data);
      expect(relations).toHaveLength(1);
      expect([...relations[0].attributes].sort()).toEqual(['A', 'B', 'C']);
    });

    it('never injects Universal_Lossless_Relation fallback into the synthesized schema', async () => {
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
      ];
      const candidateKeys = [['A', 'D']];
      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, []);

      const hasUniversal = relations.some(r => r.name === 'Universal_Lossless_Relation');
      expect(hasUniversal).toBe(false);
    });

    it('correctly projects and deduplicates data rows across synthesized relations', async () => {
      const fds: FunctionalDependency[] = [
        fd(['dept_id'], 'dept_name'),
        fd(['emp_id'], 'dept_id'),
      ];
      const candidateKeys = [['emp_id']];
      const data = [
        { emp_id: 'E1', dept_id: 'D1', dept_name: 'Engineering' },
        { emp_id: 'E2', dept_id: 'D1', dept_name: 'Engineering' },
        { emp_id: 'E3', dept_id: 'D2', dept_name: 'Sales' },
      ];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, data);

      const deptRel = relations.find(r => r.primaryKey[0] === 'dept_id');
      expect(deptRel).toBeDefined();
      expect(deptRel!.rows).toHaveLength(2); // Only D1 and D2 distinct rows
    });

    it('establishes foreign key references from dependent relations to determinant relations', async () => {
      const fds: FunctionalDependency[] = [
        fd(['dept_id'], 'dept_name'),
        fd(['emp_id'], 'dept_id'),
      ];
      const candidateKeys = [['emp_id']];
      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, []);

      const empRel = relations.find(r => r.primaryKey[0] === 'emp_id');
      expect(empRel).toBeDefined();
      expect(empRel!.foreignKeys.length).toBeGreaterThan(0);
      expect(empRel!.foreignKeys[0].attributes).toEqual(['dept_id']);
    });
  });

  // =========================================================================
  // SECTION 2: 3NF Decomposition (apply3NF)
  // =========================================================================
  describe('3NF Decomposition (apply3NF)', () => {
    it('REGRESSION: retains determinant attributes in residual relations when decomposing transitive dependencies', async () => {
      // Benchmark B1: R(emp_id, emp_name, dept_id, dept_name)
      // Transitive violation: dept_id -> dept_name
      // Buggy engine removed BOTH dept_id and dept_name from residual table!
      const relations2NF: RelationSchema[] = [{
        name: 'Employees',
        attributes: ['emp_id', 'emp_name', 'dept_id', 'dept_name'],
        primaryKey: ['emp_id'],
        foreignKeys: [],
        rows: [
          { emp_id: 1, emp_name: 'Alice', dept_id: 10, dept_name: 'Sales' },
          { emp_id: 2, emp_name: 'Bob', dept_id: 20, dept_name: 'Marketing' },
        ],
        sourceType: '2NF',
        metadata: { rowCount: 2, attributeTypes: {} }
      }];

      const fds: FunctionalDependency[] = [
        fd(['emp_id'], 'emp_name'),
        fd(['emp_id'], 'dept_id'),
        fd(['dept_id'], 'dept_name'),
      ];

      const relations3NF = await NormalizationEngine.apply3NF(relations2NF, fds);

      expect(relations3NF.length).toBeGreaterThanOrEqual(2);

      // 1. Decomposed Department table: must have {dept_id, dept_name} with PK dept_id
      const deptTable = relations3NF.find(r => r.primaryKey.includes('dept_id'));
      expect(deptTable).toBeDefined();
      expect(deptTable!.attributes).toContain('dept_id');
      expect(deptTable!.attributes).toContain('dept_name');

      // 2. Residual Employee table: MUST RETAIN dept_id as foreign key!
      const empTable = relations3NF.find(r => r.primaryKey.includes('emp_id'));
      expect(empTable).toBeDefined();
      expect(empTable!.attributes).toContain('emp_id');
      expect(empTable!.attributes).toContain('emp_name');
      expect(empTable!.attributes).toContain('dept_id'); // CRITICAL REGRESSION ASSERTION

      // Common column check: Employee and Department share dept_id
      const commonAttrs = empTable!.attributes.filter(attr => deptTable!.attributes.includes(attr));
      expect(commonAttrs).toEqual(['dept_id']);
    });

    it('establishes a foreign key from residual table referencing the extracted table', async () => {
      const relations2NF: RelationSchema[] = [{
        name: 'Employees',
        attributes: ['emp_id', 'emp_name', 'dept_id', 'dept_name'],
        primaryKey: ['emp_id'],
        foreignKeys: [],
        rows: [],
        sourceType: '2NF',
        metadata: { rowCount: 0, attributeTypes: {} }
      }];

      const fds: FunctionalDependency[] = [
        fd(['emp_id'], 'emp_name'),
        fd(['emp_id'], 'dept_id'),
        fd(['dept_id'], 'dept_name'),
      ];

      const relations3NF = await NormalizationEngine.apply3NF(relations2NF, fds);
      const empTable = relations3NF.find(r => r.primaryKey.includes('emp_id'));
      expect(empTable).toBeDefined();
      expect(empTable!.foreignKeys.some(fk => fk.attributes.includes('dept_id'))).toBe(true);
    });

    it('REGRESSION: does not silently drop residual relations when remaining attribute count is small', async () => {
      // R(A, B, C) where A is PK, B -> C is transitive. Residual is {A, B}.
      // Buggy engine discarded residual if residualSet.length < 2.
      const relations2NF: RelationSchema[] = [{
        name: 'SimpleRelation',
        attributes: ['A', 'B', 'C'],
        primaryKey: ['A'],
        foreignKeys: [],
        rows: [{ A: 1, B: 2, C: 3 }],
        sourceType: '2NF',
        metadata: { rowCount: 1, attributeTypes: {} }
      }];

      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
      ];

      const relations3NF = await NormalizationEngine.apply3NF(relations2NF, fds);
      expect(relations3NF).toHaveLength(2);
      const residual = relations3NF.find(r => r.primaryKey.includes('A'));
      expect(residual).toBeDefined();
      expect(residual!.attributes).toContain('A');
      expect(residual!.attributes).toContain('B');
    });

    it('returns unchanged relation schemas when the input schema is already in 3NF', async () => {
      const relations2NF: RelationSchema[] = [{
        name: 'Clean3NF',
        attributes: ['id', 'name', 'email'],
        primaryKey: ['id'],
        foreignKeys: [],
        rows: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
        sourceType: '2NF',
        metadata: { rowCount: 1, attributeTypes: {} }
      }];

      const fds: FunctionalDependency[] = [
        fd(['id'], 'name'),
        fd(['id'], 'email'),
      ];

      const relations3NF = await NormalizationEngine.apply3NF(relations2NF, fds);
      expect(relations3NF).toHaveLength(1);
      expect(relations3NF[0].name).toBe('Clean3NF');
    });

    it('handles multiple independent transitive dependencies within a single table', async () => {
      const relations2NF: RelationSchema[] = [{
        name: 'Orders',
        attributes: ['order_id', 'cust_id', 'cust_name', 'shipper_id', 'shipper_phone'],
        primaryKey: ['order_id'],
        foreignKeys: [],
        rows: [],
        sourceType: '2NF',
        metadata: { rowCount: 0, attributeTypes: {} }
      }];

      const fds: FunctionalDependency[] = [
        fd(['order_id'], 'cust_id'),
        fd(['order_id'], 'shipper_id'),
        fd(['cust_id'], 'cust_name'),
        fd(['shipper_id'], 'shipper_phone'),
      ];

      const relations3NF = await NormalizationEngine.apply3NF(relations2NF, fds);
      expect(relations3NF.length).toBe(3);

      const orderResidual = relations3NF.find(r => r.primaryKey.includes('order_id'));
      expect(orderResidual).toBeDefined();
      expect(orderResidual!.attributes).toContain('order_id');
      expect(orderResidual!.attributes).toContain('cust_id');
      expect(orderResidual!.attributes).toContain('shipper_id');
    });
  });

  // =========================================================================
  // SECTION 3: BCNF Recursive Decomposition (decomposeBCNF)
  // =========================================================================
  describe('BCNF Recursive Decomposition (decomposeBCNF)', () => {
    it('decomposes classic textbook Student-Course-Instructor schema into two BCNF relations', async () => {
      // Benchmark B5: R(student, course, instructor)
      // Candidate keys: {student, course}, {student, instructor}
      // instructor -> course satisfies 3NF (course is prime) but violates BCNF!
      const relation: RelationSchema = {
        name: 'SCI',
        attributes: ['student', 'course', 'instructor'],
        primaryKey: ['student', 'course'],
        foreignKeys: [],
        rows: [
          { student: 'S1', course: 'C1', instructor: 'Prof X' },
          { student: 'S2', course: 'C1', instructor: 'Prof X' },
        ],
        sourceType: 'Base',
        metadata: { rowCount: 2, attributeTypes: {} }
      };

      const fds: FunctionalDependency[] = [
        fd(['student', 'course'], 'instructor'),
        fd(['instructor'], 'course'),
      ];

      const bcnfRelations = await NormalizationEngine.decomposeBCNF(relation, fds);

      expect(bcnfRelations).toHaveLength(2);

      const r1 = bcnfRelations.find(r => r.attributes.includes('instructor') && r.attributes.includes('course') && !r.attributes.includes('student'));
      const r2 = bcnfRelations.find(r => r.attributes.includes('student') && r.attributes.includes('instructor') && !r.attributes.includes('course'));

      expect(r1).toBeDefined();
      expect(r2).toBeDefined();

      expect([...r1!.attributes].sort()).toEqual(['course', 'instructor']);
      expect([...r2!.attributes].sort()).toEqual(['instructor', 'student']);

      // Verify each decomposed relation is strictly in BCNF
      for (const rel of bcnfRelations) {
        const keyRes = await NormalizationEngine.findKeys(rel.attributes, fds);
        const check = NormalizationEngine.isBCNF(rel.attributes, fds, keyRes.candidateKeys);
        expect(check.isBCNF).toBe(true);
      }
    });

    it('recursively decomposes multi-level BCNF violations until all relations satisfy BCNF', async () => {
      // R(A, B, C, D, E), F = { A -> B, B -> C, C -> D }, Key: {A, E}
      const relation: RelationSchema = {
        name: 'MultiViolation',
        attributes: ['A', 'B', 'C', 'D', 'E'],
        primaryKey: ['A', 'E'],
        foreignKeys: [],
        rows: [],
        sourceType: 'Base',
        metadata: { rowCount: 0, attributeTypes: {} }
      };

      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
        fd(['C'], 'D'),
      ];

      const bcnfRelations = await NormalizationEngine.decomposeBCNF(relation, fds);

      expect(bcnfRelations.length).toBeGreaterThanOrEqual(3);
      for (const rel of bcnfRelations) {
        const keyRes = await NormalizationEngine.findKeys(rel.attributes, fds);
        const check = NormalizationEngine.isBCNF(rel.attributes, fds, keyRes.candidateKeys);
        expect(check.isBCNF).toBe(true);
      }
    });

    it('returns unchanged relation when input schema already satisfies BCNF', async () => {
      const relation: RelationSchema = {
        name: 'AlreadyBCNF',
        attributes: ['user_id', 'email', 'name'],
        primaryKey: ['user_id'],
        foreignKeys: [],
        rows: [],
        sourceType: 'Base',
        metadata: { rowCount: 0, attributeTypes: {} }
      };

      const fds: FunctionalDependency[] = [
        fd(['user_id'], 'email'),
        fd(['user_id'], 'name'),
      ];

      const bcnfRelations = await NormalizationEngine.decomposeBCNF(relation, fds);
      expect(bcnfRelations).toHaveLength(1);
      expect(bcnfRelations[0].name).toBe('AlreadyBCNF');
    });

    it('decomposes relations with composite determinant BCNF violations', async () => {
      // R(A, B, C, D), AB -> C, C -> D, Key {A, B}
      const relation: RelationSchema = {
        name: 'CompositeBCNF',
        attributes: ['A', 'B', 'C', 'D'],
        primaryKey: ['A', 'B'],
        foreignKeys: [],
        rows: [],
        sourceType: 'Base',
        metadata: { rowCount: 0, attributeTypes: {} }
      };
      const fds: FunctionalDependency[] = [
        fd(['A', 'B'], 'C'),
        fd(['C'], 'D'),
      ];

      const bcnfRelations = await NormalizationEngine.decomposeBCNF(relation, fds);
      expect(bcnfRelations).toHaveLength(2);

      const r1 = bcnfRelations.find(r => r.attributes.includes('C') && r.attributes.includes('D') && !r.attributes.includes('A'));
      const r2 = bcnfRelations.find(r => r.attributes.includes('A') && r.attributes.includes('B') && r.attributes.includes('C') && !r.attributes.includes('D'));

      expect(r1).toBeDefined();
      expect(r2).toBeDefined();
      expect([...r1!.attributes].sort()).toEqual(['C', 'D']);
      expect([...r2!.attributes].sort()).toEqual(['A', 'B', 'C']);

      for (const rel of bcnfRelations) {
        const keyRes = await NormalizationEngine.findKeys(rel.attributes, fds);
        const check = NormalizationEngine.isBCNF(rel.attributes, fds, keyRes.candidateKeys);
        expect(check.isBCNF).toBe(true);
      }
    });

    it('guarantees lossless join property for any BCNF decomposition', async () => {
      const relation: RelationSchema = {
        name: 'SCI',
        attributes: ['student', 'course', 'instructor'],
        primaryKey: ['student', 'course'],
        foreignKeys: [],
        rows: [],
        sourceType: 'Base',
        metadata: { rowCount: 0, attributeTypes: {} }
      };

      const fds: FunctionalDependency[] = [
        fd(['student', 'course'], 'instructor'),
        fd(['instructor'], 'course'),
      ];

      const bcnfRelations = await NormalizationEngine.decomposeBCNF(relation, fds);
      const isLossless = await NormalizationEngine.checkLosslessJoin(bcnfRelations, fds);
      expect(isLossless).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 4: Chase Algorithm (Lossless Join Verification)
  // =========================================================================
  describe('Chase Algorithm (checkLosslessJoin)', () => {
    it('REGRESSION: correctly initializes tableau with column-indexed distinguished symbols (a_j)', () => {
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const allAttributes = ['A', 'B', 'C'];
      const tableau = NormalizationEngine.initializeTableau(relations, allAttributes);

      // In R1: A is col 0 -> 'a_0', B is col 1 -> 'a_1', C is col 2 -> 'b_0_2'
      expect(tableau[0]).toEqual(['a_0', 'a_1', 'b_0_2']);
      // In R2: A is col 0 -> 'b_1_0', B is col 1 -> 'a_1', C is col 2 -> 'a_2'
      expect(tableau[1]).toEqual(['b_1_0', 'a_1', 'a_2']);
      // Both relations share attribute B at col 1 with identical symbol 'a_1'!
      expect(tableau[0][1]).toBe(tableau[1][1]);
    });

    it('confirms true lossless binary decomposition returns true under Heath theorem', async () => {
      // Benchmark B6: R(A, B, C), F = { A -> B }, D = { R1(A, B), R2(A, C) }
      // Common attribute is A, and A -> B. Thus R1 ∩ R2 -> R1, satisfying Heath's theorem!
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['A', 'C'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);
    });

    it('REGRESSION: correctly rejects known lossy binary decomposition as false', async () => {
      // Benchmark B6: R(A, B, C), F = { A -> B }, D = { R1(A, B), R2(B, C) }
      // Common attribute is B. B does NOT determine B -> A or B -> C.
      // This is mathematically LOSSY!
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(false);
    });

    it('confirms multi-relation chain decomposition returns true for lossless join', async () => {
      // Benchmark B7: R(A, B, C, D), F = { A -> B, B -> C, C -> D }
      // D = { R1(A, B), R2(B, C), R3(C, D) }
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R3', attributes: ['C', 'D'], primaryKey: ['C'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
        fd(['C'], 'D'),
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);
    });

    it('rejects multi-relation decomposition as false when join dependency is lossy', async () => {
      // Benchmark B7 lossy variant: R(A, B, C, D), F = { A -> B, C -> D }
      // D = { R1(A, C), R2(B, C), R3(C, D) }
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'C'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R3', attributes: ['C', 'D'], primaryKey: ['C'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['C'], 'D'),
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(false);
    });

    it('REGRESSION: never overwrites distinguished symbols with non-distinguished symbols regardless of row order', async () => {
      // Test specifically verifying that if row 0 has non-distinguished symbol b
      // and row 1 has distinguished symbol a, the Chase step replaces b with a, NOT vice-versa!
      const relations: RelationSchema[] = [
        { name: 'R1_NoA', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2_HasA', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      // FD: B -> A. Since R1 has B, and R2 has A and B, B -> A should equate R1's A to R2's distinguished A!
      const fds: FunctionalDependency[] = [
        fd(['B'], 'A'),
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      // R1 becomes [a_A, a_B, a_C], so decomposition is lossless!
      expect(isLossless).toBe(true);
    });

    it('trivially returns true for a single relation schema', async () => {
      const relations: RelationSchema[] = [
        { name: 'Universal', attributes: ['A', 'B', 'C'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, []);
      expect(isLossless).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 5: Dependency Preservation Verification (checkDependencyPreservation)
  // =========================================================================
  describe('Dependency Preservation (checkDependencyPreservation)', () => {
    it('REGRESSION: verifies multi-table transitive dependency chain is preserved (Bug 11.1 fix)', async () => {
      // Benchmark B8: F = { A -> B, B -> C, A -> C }, D = { R1(A, B), R2(B, C) }
      // A -> C is NOT contained in R1 or R2 alone, but IS preserved through the closure under projected dependencies!
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
        fd(['A'], 'C'),
      ];

      const isPreserved = await NormalizationEngine.checkDependencyPreservation(relations, fds);
      expect(isPreserved).toBe(true);
    });

    it('detects lost functional dependency in BCNF decomposition of Student-Course-Instructor', async () => {
      // Benchmark B5: F = { {student, course} -> instructor, instructor -> course }
      // D = { R1(instructor, course), R2(student, instructor) }
      // The dependency {student, course} -> instructor is LOST in this BCNF decomposition!
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['instructor', 'course'], primaryKey: ['instructor'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['student', 'instructor'], primaryKey: ['student', 'instructor'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['student', 'course'], 'instructor'),
        fd(['instructor'], 'course'),
      ];

      const isPreserved = await NormalizationEngine.checkDependencyPreservation(relations, fds);
      expect(isPreserved).toBe(false);
    });

    it('returns true when all dependencies are directly contained within individual relations', async () => {
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['C', 'D'], primaryKey: ['C'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['C'], 'D'),
      ];

      const isPreserved = await NormalizationEngine.checkDependencyPreservation(relations, fds);
      expect(isPreserved).toBe(true);
    });

    it('handles empty functional dependency set without error', async () => {
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'test', metadata: { rowCount: 0, attributeTypes: {} } },
      ];

      const isPreserved = await NormalizationEngine.checkDependencyPreservation(relations, []);
      expect(isPreserved).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 6: Relational Algebra Invariants & Synthesis Guarantees
  // =========================================================================
  describe('Relational Algebra Invariants & Guarantees', () => {
    it('verifies Bernstein 3NF synthesis simultaneously guarantees lossless join and dependency preservation', async () => {
      // In relational theory, Bernstein's 3NF synthesis is PROVEN to always guarantee BOTH
      // lossless join decomposition AND dependency preservation!
      const fds: FunctionalDependency[] = [
        fd(['emp_id'], 'emp_name'),
        fd(['emp_id'], 'dept_id'),
        fd(['dept_id'], 'dept_name'),
        fd(['proj_id'], 'proj_name'),
        fd(['emp_id', 'proj_id'], 'hours'),
      ];
      const candidateKeys = [['emp_id', 'proj_id']];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, []);

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);

      const isPreserved = await NormalizationEngine.checkDependencyPreservation(relations, fds);
      expect(isPreserved).toBe(true);
    });

    it('verifies BCNF decomposition guarantees lossless join even when dependency preservation fails', async () => {
      // In relational theory, BCNF decomposition is PROVEN to always guarantee lossless join,
      // but may not preserve dependencies.
      const relation: RelationSchema = {
        name: 'SCI',
        attributes: ['student', 'course', 'instructor'],
        primaryKey: ['student', 'course'],
        foreignKeys: [],
        rows: [],
        sourceType: 'Base',
        metadata: { rowCount: 0, attributeTypes: {} }
      };
      const fds: FunctionalDependency[] = [
        fd(['student', 'course'], 'instructor'),
        fd(['instructor'], 'course'),
      ];

      const bcnfRelations = await NormalizationEngine.decomposeBCNF(relation, fds);

      const isLossless = await NormalizationEngine.checkLosslessJoin(bcnfRelations, fds);
      expect(isLossless).toBe(true);

      const isPreserved = await NormalizationEngine.checkDependencyPreservation(bcnfRelations, fds);
      expect(isPreserved).toBe(false); // Known dependency loss in BCNF
    });
  });
});
