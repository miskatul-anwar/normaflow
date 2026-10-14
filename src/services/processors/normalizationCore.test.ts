import { describe, it, expect } from 'vitest';
import {
  NormalizationEngine,
  FunctionalDependency
} from './normalizationEngine';

describe('Normalization Core - Milestone 2 Test Suite', () => {

  // =========================================================================
  // SECTION 1: Attribute Closure (computeClosure)
  // =========================================================================
  describe('Attribute Closure (computeClosure)', () => {
    it('returns the attribute itself when no functional dependencies exist', () => {
      const closure = NormalizationEngine.computeClosure(['A'], []);
      expect(Array.from(closure).sort()).toEqual(['A']);
    });

    it('computes direct single-step dependency closure', () => {
      const fds: FunctionalDependency[] = [
        { lhs: ['A'], rhs: 'B', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 }
      ];
      const closure = NormalizationEngine.computeClosure(['A'], fds);
      expect(Array.from(closure).sort()).toEqual(['A', 'B']);
    });

    it('computes multi-step transitive closure', () => {
      const fds: FunctionalDependency[] = [
        { lhs: ['A'], rhs: 'B', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['B'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['C'], rhs: 'D', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const closure = NormalizationEngine.computeClosure(['A'], fds);
      expect(Array.from(closure).sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('computes composite determinant closure requiring all LHS attributes', () => {
      const fds: FunctionalDependency[] = [
        { lhs: ['A', 'B'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['C'], rhs: 'D', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      // Only A is present -> cannot fire AB -> C
      const closureA = NormalizationEngine.computeClosure(['A'], fds);
      expect(Array.from(closureA).sort()).toEqual(['A']);

      // Both A and B are present -> fires AB -> C, then C -> D
      const closureAB = NormalizationEngine.computeClosure(['A', 'B'], fds);
      expect(Array.from(closureAB).sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('handles cyclic dependencies without infinite looping', () => {
      const fds: FunctionalDependency[] = [
        { lhs: ['A'], rhs: 'B', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['B'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['C'], rhs: 'A', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const closure = NormalizationEngine.computeClosure(['A'], fds);
      expect(Array.from(closure).sort()).toEqual(['A', 'B', 'C']);
    });

    it('handles comma-separated and array-based RHS attributes in FDs', () => {
      const fds1 = [{ lhs: ['A'], rhs: 'B, C' }];
      const closure1 = NormalizationEngine.computeClosure(['A'], fds1);
      expect(Array.from(closure1).sort()).toEqual(['A', 'B', 'C']);

      const fds2 = [{ lhs: ['A'], rhs: ['B', 'C', 'D'] }];
      const closure2 = NormalizationEngine.computeClosure(['A'], fds2);
      expect(Array.from(closure2).sort()).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  // =========================================================================
  // SECTION 2: Candidate Key Discovery (findCandidateKeys & findKeys)
  // =========================================================================
  describe('Candidate Key Discovery (findCandidateKeys & findKeys)', () => {
    it('discovers a single natural candidate key', async () => {
      const attributes = ['id', 'name', 'email'];
      const fds: FunctionalDependency[] = [
        { lhs: ['id'], rhs: 'name', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['id'], rhs: 'email', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const result = await NormalizationEngine.findKeys(attributes, fds);
      expect(result.candidateKeys).toHaveLength(1);
      expect(result.candidateKeys[0]).toEqual(['id']);

      const direct = NormalizationEngine.findCandidateKeys(attributes, fds);
      expect(direct).toEqual([['id']]);
    });

    it('discovers multiple candidate keys of the same size', async () => {
      const attributes = ['id', 'ssn', 'name'];
      const fds: FunctionalDependency[] = [
        { lhs: ['id'], rhs: 'ssn', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['id'], rhs: 'name', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['ssn'], rhs: 'id', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['ssn'], rhs: 'name', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const result = await NormalizationEngine.findKeys(attributes, fds);
      const keys = result.candidateKeys.map(k => k.sort().join(',')).sort();
      expect(keys).toEqual(['id', 'ssn']);
    });

    it('REGRESSION: discovers coexisting single and composite candidate keys (Phase 1 + Phase 2)', async () => {
      // R(A, B, C, D) where A is a key, but {B, C} is also a candidate key!
      // In the buggy engine, Phase 1 finds ['A'] and skips Phase 2 entirely.
      const attributes = ['A', 'B', 'C', 'D'];
      const fds: FunctionalDependency[] = [
        { lhs: ['A'], rhs: 'B', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['A'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['A'], rhs: 'D', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['B', 'C'], rhs: 'A', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['B', 'C'], rhs: 'D', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const result = await NormalizationEngine.findKeys(attributes, fds);
      const keySignatures = result.candidateKeys.map(k => [...k].sort().join('+')).sort();
      expect(keySignatures).toContain('A');
      expect(keySignatures).toContain('B+C');
    });

    it('REGRESSION: discovers candidate keys of different composite cardinalities (sizes 2 and 3)', async () => {
      // R(A, B, C, D, E) with key {A, B} (size 2) and key {C, D, E} (size 3)
      // In the buggy engine, systematic search broke on first size found (size 2)
      const attributes = ['A', 'B', 'C', 'D', 'E'];
      const fds: FunctionalDependency[] = [
        { lhs: ['A', 'B'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['A', 'B'], rhs: 'D', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['A', 'B'], rhs: 'E', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['C', 'D', 'E'], rhs: 'A', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['C', 'D', 'E'], rhs: 'B', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const result = await NormalizationEngine.findKeys(attributes, fds);
      const keySignatures = result.candidateKeys.map(k => [...k].sort().join('+')).sort();
      expect(keySignatures).toContain('A+B');
      expect(keySignatures).toContain('C+D+E');
    });

    it('REGRESSION: discovers composite candidate key with 6 attributes without Math.min 5 cap', async () => {
      const attributes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      const fds: FunctionalDependency[] = [
        { lhs: ['A', 'B', 'C', 'D', 'E', 'F'], rhs: 'G', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const result = await NormalizationEngine.findKeys(attributes, fds);
      expect(result.candidateKeys).toHaveLength(1);
      expect(result.candidateKeys[0].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    });

    it('discovers cyclic candidate keys', async () => {
      const attributes = ['A', 'B', 'C'];
      const fds: FunctionalDependency[] = [
        { lhs: ['A'], rhs: 'B', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['B'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['C'], rhs: 'A', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const result = await NormalizationEngine.findKeys(attributes, fds);
      const keys = result.candidateKeys.map(k => k[0]).sort();
      expect(keys).toEqual(['A', 'B', 'C']);
    });

    it('falls back to all attributes when no functional dependencies exist', async () => {
      const attributes = ['col1', 'col2', 'col3'];
      const result = await NormalizationEngine.findKeys(attributes, []);
      expect(result.candidateKeys).toHaveLength(1);
      expect(result.candidateKeys[0].sort()).toEqual(['col1', 'col2', 'col3']);
    });

    it('does not mutate input array in extractCandidateKeys', () => {
      const original = [['Z', 'A'], ['B', 'C']];
      const extracted = NormalizationEngine.extractCandidateKeys(original);
      expect(original[0]).toEqual(['Z', 'A']); // Not mutated in place!
      expect(extracted).toHaveLength(2);
    });
  });

  // =========================================================================
  // SECTION 3: Minimal Cover / Canonical Cover (computeCanonicalCover)
  // =========================================================================
  describe('Minimal / Canonical Cover (computeCanonicalCover)', () => {
    it('decomposes non-singleton RHS into singleton FDs (Step 1)', () => {
      const fds: any[] = [
        { lhs: ['A'], rhs: 'B, C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const res = NormalizationEngine.computeCanonicalCover(fds);
      expect(res.singletonCover.some(f => f.lhs.join(',') === 'A' && f.rhs === 'B')).toBe(true);
      expect(res.singletonCover.some(f => f.lhs.join(',') === 'A' && f.rhs === 'C')).toBe(true);
      expect(res.groupedCover).toEqual([{ lhs: ['A'], rhs: ['B', 'C'] }]);
    });

    it('eliminates extraneous attributes from LHS (Step 2)', () => {
      // In F = { A -> C, AB -> C }, attribute B is extraneous in AB -> C
      const fds: any[] = [
        { lhs: ['A'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['A', 'B'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const res = NormalizationEngine.computeCanonicalCover(fds);
      expect(res.singletonCover).toHaveLength(1);
      expect(res.singletonCover[0].lhs).toEqual(['A']);
      expect(res.singletonCover[0].rhs).toBe('C');
      expect(res.extraneousAttributesRemoved).toBe(1);

      // Verify computeMinimalCover helper returns the singletonCover
      const minCover = NormalizationEngine.computeMinimalCover(fds);
      expect(minCover).toHaveLength(1);
      expect(minCover[0].lhs).toEqual(['A']);
    });

    it('eliminates redundant functional dependencies (Step 3)', () => {
      // F = { A -> B, B -> C, A -> C }
      // A -> C is redundant because C is in Closure({A}, {A -> B, B -> C})
      const fds: any[] = [
        { lhs: ['A'], rhs: 'B', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['B'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['A'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const res = NormalizationEngine.computeCanonicalCover(fds);
      expect(res.singletonCover).toHaveLength(2);
      expect(res.singletonCover.some(f => f.lhs[0] === 'A' && f.rhs === 'B')).toBe(true);
      expect(res.singletonCover.some(f => f.lhs[0] === 'B' && f.rhs === 'C')).toBe(true);
      expect(res.singletonCover.some(f => f.lhs[0] === 'A' && f.rhs === 'C')).toBe(false);
      expect(res.redundantFDsRemoved).toBe(1);
    });

    it('computes minimal cover on textbook cyclic dependency set', () => {
      // F = { A -> B, B -> C, C -> A, A -> C }
      // A -> C is redundant
      const fds: any[] = [
        { lhs: ['A'], rhs: 'B', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['B'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['C'], rhs: 'A', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['A'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const cover = NormalizationEngine.computeMinimalCover(fds);
      expect(cover).toHaveLength(3);
      expect(cover.some(f => f.lhs[0] === 'A' && f.rhs === 'C')).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 4: Prime vs Non-Prime Attribute Classification
  // =========================================================================
  describe('Prime Attribute Classification (classifyPrimeAttributes & classifyAttributes)', () => {
    it('classifies attributes for a single candidate key', () => {
      const attributes = ['id', 'name', 'email', 'dept'];
      const candidateKeys = [['id']];
      const { prime, nonPrime } = NormalizationEngine.classifyAttributes(attributes, candidateKeys);
      expect(prime.sort()).toEqual(['id']);
      expect(nonPrime.sort()).toEqual(['dept', 'email', 'name']);

      const classification = NormalizationEngine.classifyPrimeAttributes(attributes, candidateKeys);
      expect(classification.isPrime('id')).toBe(true);
      expect(classification.isPrime('name')).toBe(false);
    });

    it('classifies attributes for multiple overlapping candidate keys', () => {
      const attributes = ['A', 'B', 'C', 'D'];
      const candidateKeys = [['A', 'B'], ['B', 'C']];
      const { prime, nonPrime } = NormalizationEngine.classifyAttributes(attributes, candidateKeys);
      expect(prime.sort()).toEqual(['A', 'B', 'C']);
      expect(nonPrime.sort()).toEqual(['D']);
    });

    it('classifies all attributes as prime when every attribute belongs to a key', () => {
      const attributes = ['student', 'course', 'instructor'];
      const candidateKeys = [['student', 'course'], ['student', 'instructor']];
      const { prime, nonPrime } = NormalizationEngine.classifyAttributes(attributes, candidateKeys);
      expect(prime.sort()).toEqual(['course', 'instructor', 'student']);
      expect(nonPrime).toHaveLength(0);
    });
  });

  // =========================================================================
  // SECTION 5: Non-Destructive 1NF Atomicity & Verification
  // =========================================================================
  describe('Non-Destructive 1NF Atomicity Verification & Transformation', () => {
    it('REGRESSION: preserves natural strings with commas intact without truncation in apply1NF', async () => {
      const rawData = [
        { id: 1, name: 'Smith, John', address: '123 Main St, Springfield, IL 62701' },
        { id: 2, name: 'Doe, Jane', address: '456 Oak Ave, Suite 200, Boston, MA' },
      ];
      const result = await NormalizationEngine.apply1NF(rawData);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Smith, John');
      expect(result[0].address).toBe('123 Main St, Springfield, IL 62701');
      expect(result[1].name).toBe('Doe, Jane');
      expect(result[1].address).toBe('456 Oak Ave, Suite 200, Boston, MA');
    });

    it('REGRESSION: preserves strings with conjunctions (&, and) intact in apply1NF', async () => {
      const rawData = [
        { id: 1, company: 'Barnes & Noble', title: 'War and Peace' },
        { id: 2, company: 'Procter & Gamble', title: 'Romeo & Juliet' },
      ];
      const result = await NormalizationEngine.apply1NF(rawData);
      expect(result[0].company).toBe('Barnes & Noble');
      expect(result[0].title).toBe('War and Peace');
      expect(result[1].company).toBe('Procter & Gamble');
    });

    it('identifies true non-atomic structures in is1NF verification without mutating data', () => {
      const dataWithNested = [
        { id: 1, tags: ['frontend', 'react'] },
        { id: 2, tags: ['backend', 'node'] },
      ];
      const check = NormalizationEngine.is1NF(dataWithNested);
      expect(check.is1NF).toBe(false);
      expect(check.isNormalized).toBe(false);
      expect(check.nonAtomicAttributes).toContain('tags');
      expect(check.violations.length).toBeGreaterThan(0);
      // Original data must NOT be mutated
      expect(Array.isArray(dataWithNested[0].tags)).toBe(true);
    });

    it('reports is1NF = true for clean atomic relational rows', () => {
      const cleanData = [
        { id: 1, name: 'Alice Smith', score: 95, active: true },
        { id: 2, name: 'Bob Jones', score: 88, active: false },
      ];
      const check = NormalizationEngine.is1NF(cleanData);
      expect(check.is1NF).toBe(true);
      expect(check.isNormalized).toBe(true);
      expect(check.violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // SECTION 6: Normal Form Checkers (1NF, 2NF, 3NF, BCNF) on Textbook Schemas
  // =========================================================================
  describe('Normal Form Checkers across Textbook Schemas', () => {
    // -----------------------------------------------------------------------
    // 6.1 Textbook Student-Course Schema (Violates 2NF)
    // -----------------------------------------------------------------------
    it('correctly evaluates Student-Course schema (1NF, not 2NF)', () => {
      const attributes = ['student_id', 'course_id', 'student_name', 'course_name', 'grade'];
      const fds: any[] = [
        { lhs: ['student_id'], rhs: 'student_name', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['course_id'], rhs: 'course_name', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['student_id', 'course_id'], rhs: 'grade', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const candidateKeys = [['student_id', 'course_id']];

      const res2NF = NormalizationEngine.is2NF(attributes, fds, candidateKeys);
      expect(res2NF.is2NF).toBe(false);
      expect(res2NF.isNormalized).toBe(false);
      expect(res2NF.partialDependencies!.length).toBe(2);

      const res3NF = NormalizationEngine.is3NF(attributes, fds, candidateKeys);
      expect(res3NF.is3NF).toBe(false);

      const resBCNF = NormalizationEngine.isBCNF(attributes, fds, candidateKeys);
      expect(resBCNF.isBCNF).toBe(false);

      const assessment = NormalizationEngine.determineNormalForm(attributes, fds, [{ student_id: 1, course_id: 101, student_name: 'Alice', course_name: 'CS101', grade: 'A' }], candidateKeys);
      expect(assessment.highestNormalForm).toBe('1NF');
    });

    // -----------------------------------------------------------------------
    // 6.2 Textbook Employee-Department Schema (Satisfies 2NF, Violates 3NF)
    // -----------------------------------------------------------------------
    it('correctly evaluates Employee-Department schema (2NF, not 3NF)', () => {
      const attributes = ['emp_id', 'emp_name', 'dept_id', 'dept_name', 'manager'];
      const fds: any[] = [
        { lhs: ['emp_id'], rhs: 'emp_name', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['emp_id'], rhs: 'dept_id', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['dept_id'], rhs: 'dept_name', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['dept_id'], rhs: 'manager', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const candidateKeys = [['emp_id']];

      const res2NF = NormalizationEngine.is2NF(attributes, fds, candidateKeys);
      expect(res2NF.is2NF).toBe(true); // Single attribute key cannot have partial dependencies

      const res3NF = NormalizationEngine.is3NF(attributes, fds, candidateKeys);
      expect(res3NF.is3NF).toBe(false);
      expect(res3NF.transitiveDependencies!.some(d => d.lhs.includes('dept_id'))).toBe(true);

      const resBCNF = NormalizationEngine.isBCNF(attributes, fds, candidateKeys);
      expect(resBCNF.isBCNF).toBe(false);

      const assessment = NormalizationEngine.determineNormalForm(attributes, fds, [{ emp_id: 1, emp_name: 'Bob', dept_id: 10, dept_name: 'Sales', manager: 'Alice' }], candidateKeys);
      expect(assessment.highestNormalForm).toBe('2NF');
    });

    // -----------------------------------------------------------------------
    // 6.3 Textbook Student-Course-Instructor Schema (Satisfies 3NF, Violates BCNF)
    // -----------------------------------------------------------------------
    it('correctly evaluates Student-Course-Instructor schema (3NF, not BCNF due to prime RHS)', () => {
      const attributes = ['student', 'course', 'instructor'];
      const fds: any[] = [
        { lhs: ['student', 'course'], rhs: 'instructor', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['instructor'], rhs: 'course', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      // Candidate keys: {student, course} and {student, instructor}
      const candidateKeys = [['student', 'course'], ['student', 'instructor']];

      const res2NF = NormalizationEngine.is2NF(attributes, fds, candidateKeys);
      expect(res2NF.is2NF).toBe(true);

      // In instructor -> course: instructor is not a superkey, but 'course' is a PRIME attribute!
      // Therefore, this relation SATISFIES 3NF!
      const res3NF = NormalizationEngine.is3NF(attributes, fds, candidateKeys);
      expect(res3NF.is3NF).toBe(true);

      // For BCNF, every determinant must be a superkey. 'instructor' is NOT a superkey!
      // Therefore, this relation VIOLATES BCNF!
      const resBCNF = NormalizationEngine.isBCNF(attributes, fds, candidateKeys);
      expect(resBCNF.isBCNF).toBe(false);
      expect(resBCNF.violations.some(v => v.lhs.includes('instructor'))).toBe(true);

      const assessment = NormalizationEngine.determineNormalForm(attributes, fds, [{ student: 'S1', course: 'C1', instructor: 'Prof X' }], candidateKeys);
      expect(assessment.highestNormalForm).toBe('3NF');
    });

    // -----------------------------------------------------------------------
    // 6.4 Fully Normalized BCNF Schema
    // -----------------------------------------------------------------------
    it('correctly evaluates fully normalized relation (satisfies BCNF)', () => {
      const attributes = ['user_id', 'email', 'created_at'];
      const fds: any[] = [
        { lhs: ['user_id'], rhs: 'email', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['user_id'], rhs: 'created_at', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['email'], rhs: 'user_id', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['email'], rhs: 'created_at', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const candidateKeys = [['user_id'], ['email']];

      expect(NormalizationEngine.is2NF(attributes, fds, candidateKeys).is2NF).toBe(true);
      expect(NormalizationEngine.is3NF(attributes, fds, candidateKeys).is3NF).toBe(true);
      expect(NormalizationEngine.isBCNF(attributes, fds, candidateKeys).isBCNF).toBe(true);

      const assessment = NormalizationEngine.determineNormalForm(attributes, fds, [{ user_id: 1, email: 'a@b.com', created_at: '2026-01-01' }], candidateKeys);
      expect(assessment.highestNormalForm).toBe('BCNF');
    });

    // -----------------------------------------------------------------------
    // 6.5 Cyclic Dependencies Schema (Satisfies BCNF)
    // -----------------------------------------------------------------------
    it('correctly evaluates cyclic dependency schema (A -> B, B -> C, C -> A) as BCNF', () => {
      const attributes = ['A', 'B', 'C'];
      const fds: any[] = [
        { lhs: ['A'], rhs: 'B', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['B'], rhs: 'C', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
        { lhs: ['C'], rhs: 'A', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1 },
      ];
      const candidateKeys = [['A'], ['B'], ['C']];

      expect(NormalizationEngine.is2NF(attributes, fds, candidateKeys).is2NF).toBe(true);
      expect(NormalizationEngine.is3NF(attributes, fds, candidateKeys).is3NF).toBe(true);
      expect(NormalizationEngine.isBCNF(attributes, fds, candidateKeys).isBCNF).toBe(true);

      const assessment = NormalizationEngine.determineNormalForm(attributes, fds, [{ A: '1', B: '2', C: '3' }], candidateKeys);
      expect(assessment.highestNormalForm).toBe('BCNF');
    });
  });
});
