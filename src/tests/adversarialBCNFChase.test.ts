import { describe, expect, it } from 'vitest';
import {
  NormalizationEngine,
  FunctionalDependency,
  RelationSchema
} from '../services/processors/normalizationEngine';

// Helper to construct FunctionalDependency objects
function fd(lhs: string[], rhs: string | string[], confidence: number = 1): FunctionalDependency {
  return {
    lhs,
    rhs: rhs as any,
    confidence,
    coverage: 1,
    violations: 0,
    uniqueGroups: 1,
  };
}

describe('Milestone 3 Challenger 2: Adversarial Stress Suite for BCNF, Chase Algorithm & Dependency Preservation', () => {

  // =========================================================================
  // SECTION 1: Chase Algorithm — Lossless vs Lossy Decompositions
  // =========================================================================
  describe('1. Chase Algorithm: Lossless vs Lossy Decompositions', () => {
    it('confirms textbook Heath theorem lossless join: R(A, B, C) -> {AB, BC} with B -> C', async () => {
      // Benchmark: R(A, B, C), F = { B -> C }, D = { R1(A, B), R2(B, C) }
      // R1 ∩ R2 = {B}, B -> C determines R2. By Heath's theorem, this is LOSSLESS.
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A', 'B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['B'], 'C'),
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);

      const chaseResult = NormalizationEngine.chaseAlgorithm(relations, fds);
      expect(chaseResult.isLossless).toBe(true);
      expect(chaseResult.fullyDistinguishedRowIndex).toBe(0); // Row 0 (R1) acquires a_C from R2!
    });

    it('adversarially rejects lossy decomposition: R(A, B, C) -> {AB, AC} with B -> C', async () => {
      // Benchmark: R(A, B, C), F = { B -> C }, D = { R1(A, B), R2(A, C) }
      // R1 ∩ R2 = {A}. Does A -> B or A -> C? Neither!
      // B -> C cannot equate anything because R1 and R2 do not share B.
      // Decomposition is mathematically LOSSY!
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['A', 'C'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['B'], 'C'),
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(false);

      const chaseResult = NormalizationEngine.chaseAlgorithm(relations, fds);
      expect(chaseResult.isLossless).toBe(false);
      expect(chaseResult.fullyDistinguishedRowIndex).toBe(-1);
    });

    it('adversarially rejects lossy decomposition where common attribute is not a determinant: R(A, B, C) -> {AB, BC} with A -> B', async () => {
      // Benchmark: R(A, B, C), F = { A -> B }, D = { R1(A, B), R2(B, C) }
      // Common attribute is B. But only A -> B holds, not B -> A or B -> C.
      // R1 and R2 do not agree on A (R1 has a_0, R2 has b_1_0).
      // So A -> B cannot equate anything! Lossy!
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(false);
    });

    it('rejects decomposition of disjoint independent schemas with zero common attributes', async () => {
      // D = { R1(A, B), R2(C, D) }, F = { A -> B, C -> D }
      // No shared attributes at all! Cross product is lossy.
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['C', 'D'], primaryKey: ['C'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['C'], 'D'),
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(false);
    });

    it('rejects cyclic pairwise decompositions lacking a unifying key: {AB, BC, AC} with no FDs', async () => {
      // Classic SPJ lossy join example: R(A, B, C), decomposed into AB, BC, AC without FDs.
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A', 'B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B', 'C'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R3', attributes: ['A', 'C'], primaryKey: ['A', 'C'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, []);
      expect(isLossless).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 2: Chase Algorithm — Multi-Row Cascade Propagation
  // =========================================================================
  describe('2. Chase Algorithm: Multi-Row Cascade Propagation', () => {
    it('propagates distinguished symbols forward across a 4-relation cascade chain', async () => {
      // Schema: R(A, B, C, D, E)
      // Decomposition: R1(A, B), R2(B, C), R3(C, D), R4(D, E)
      // FDs: B -> C, C -> D, D -> E
      // Cascade flow:
      // Step 1: R1 and R2 agree on B -> R1 acquires a_C
      // Step 2: R1 and R3 agree on C -> R1 acquires a_D
      // Step 3: R1 and R4 agree on D -> R1 acquires a_E
      // Row 0 becomes [a_A, a_B, a_C, a_D, a_E]!
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R3', attributes: ['C', 'D'], primaryKey: ['C'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R4', attributes: ['D', 'E'], primaryKey: ['D'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['B'], 'C'),
        fd(['C'], 'D'),
        fd(['D'], 'E'),
      ];

      const result = NormalizationEngine.chaseAlgorithm(relations, fds);
      expect(result.isLossless).toBe(true);
      expect(result.fullyDistinguishedRowIndex).toBe(0);
      expect(result.iterations).toBeGreaterThanOrEqual(1);

      // Verify Row 0 contains all distinguished symbols
      const expectedDistinguished = result.attributes.map((_, idx) => `a_${idx}`);
      expect(result.tableau[0]).toEqual(expectedDistinguished);
    });

    it('propagates distinguished symbols in reverse cascade: information flows from last row to first', async () => {
      // Schema: R(A, B, C, D)
      // Decomposition: R1(A, B), R2(B, C), R3(C, D)
      // FDs: C -> B, B -> A (Reverse dependencies!)
      // Flow:
      // R3 has C, D. R2 has B, C.
      // Agree on C: C -> B equates R3's B column to a_B!
      // Now R3 has B, C, D. R1 has A, B.
      // Agree on B: B -> A equates R3's A column to a_A!
      // Row 2 (R3) becomes [a_A, a_B, a_C, a_D]!
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R3', attributes: ['C', 'D'], primaryKey: ['C'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['C'], 'B'),
        fd(['B'], 'A'),
      ];

      const result = NormalizationEngine.chaseAlgorithm(relations, fds);
      expect(result.isLossless).toBe(true);
      expect(result.fullyDistinguishedRowIndex).toBe(2);

      const expectedDistinguished = result.attributes.map((_, idx) => `a_${idx}`);
      expect(result.tableau[2]).toEqual(expectedDistinguished);
    });

    it('handles deep 6-relation cascade without stack overflow or premature termination', async () => {
      // Chain: A -> B -> C -> D -> E -> F
      // Relations: (A, B), (B, C), (C, D), (D, E), (E, F)
      const attributes = ['A', 'B', 'C', 'D', 'E', 'F'];
      const relations: RelationSchema[] = [];
      for (let i = 0; i < attributes.length - 1; i++) {
        relations.push({
          name: `R_${i}`,
          attributes: [attributes[i], attributes[i + 1]],
          primaryKey: [attributes[i]],
          foreignKeys: [],
          rows: [],
          sourceType: 'Base',
          metadata: { rowCount: 0, attributeTypes: {} }
        });
      }
      const fds: FunctionalDependency[] = [];
      for (let i = 1; i < attributes.length - 1; i++) {
        fds.push(fd([attributes[i]], attributes[i + 1]));
      }

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);
    });

    it('correctly propagates equivalence class when non-distinguished symbols equate before reaching distinguished symbol', async () => {
      // Scenario:
      // R1: {W, X}
      // R2: {W, Y}
      // R3: {Z, Y, X}
      // FDs: W -> Y, Y -> X, Z -> W
      // Attributes: W, X, Y, Z
      // Initially, R1 has [a_W, a_X, b_0_Y, b_0_Z]
      // R2 has [a_W, b_1_X, a_Y, b_1_Z]
      // Agreement on W: W -> Y equates R1's Y column (b_0_Y) with R2's a_Y.
      // Then R1 has [a_W, a_X, a_Y, b_0_Z].
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['W', 'X'], primaryKey: ['W'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['W', 'Y'], primaryKey: ['W'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R3', attributes: ['Z', 'W'], primaryKey: ['Z'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      // If Z -> W, and W -> X, Y:
      const fds: FunctionalDependency[] = [
        fd(['W'], 'Y'),
        fd(['W'], 'X'),
        fd(['Z'], 'W'),
      ];

      const result = NormalizationEngine.chaseAlgorithm(relations, fds);
      expect(result.isLossless).toBe(true);
      // Either R1, R2, or R3 will acquire distinguished status
      expect(result.fullyDistinguishedRowIndex).toBeGreaterThanOrEqual(0);
    });

    it('propagates cascade triggered by composite determinants after partial equate', async () => {
      // Schema: R(A, B, C, D)
      // Decomposition: R1(A, D), R2(B, D), R3(A, B, C)
      // FDs: D -> B, {A, B} -> C, D -> A
      // Notice: R1 has A, D.
      // D -> B gives R1 attribute B (equating b_0_B to a_B).
      // Now R1 has {A, B, D}.
      // {A, B} -> C gives R1 attribute C (equating b_0_C to a_C).
      // R1 becomes [a_A, a_B, a_C, a_D]! Fully distinguished!
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'D'], primaryKey: ['D'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'D'], primaryKey: ['D'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R3', attributes: ['A', 'B', 'C'], primaryKey: ['A', 'B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['D'], 'B'),
        fd(['A', 'B'], 'C'),
      ];

      const result = NormalizationEngine.chaseAlgorithm(relations, fds);
      expect(result.isLossless).toBe(true);
      expect(result.fullyDistinguishedRowIndex).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 3: Chase Algorithm — Tableau Structure & Invariants
  // =========================================================================
  describe('3. Chase Algorithm: Tableau Structure & Indexing Invariants', () => {
    it('verifies tableau columns correspond strictly to sorted universal attributes', () => {
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['Z', 'A'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['M', 'A'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const allAttributes = ['A', 'M', 'Z']; // sorted order

      const tableau = NormalizationEngine.initializeTableau(relations, allAttributes);

      // In R1: A is col 0 -> 'a_0', M is col 1 -> 'b_0_1', Z is col 2 -> 'a_2'
      expect(tableau[0]).toEqual(['a_0', 'b_0_1', 'a_2']);
      // In R2: A is col 0 -> 'a_0', M is col 1 -> 'a_1', Z is col 2 -> 'b_1_2'
      expect(tableau[1]).toEqual(['a_0', 'a_1', 'b_1_2']);
    });

    it('verifies ChaseStepLog captures exact iteration, triggering FD, and equated symbols', () => {
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['B'], 'C'),
      ];

      const result = NormalizationEngine.chaseAlgorithm(relations, fds);
      expect(result.steps?.length).toBeGreaterThan(0);

      const step = result.steps![0];
      expect(step.fd.lhs).toEqual(['B']);
      expect(step.fd.rhs).toBe('C');
      expect(step.equatedSymbol).toBe('a_2'); // C is column index 2 in ['A', 'B', 'C']
      expect(step.replacedSymbol).toBe('b_0_2');
      expect(step.affectedRows).toContain(0);
    });

    it('handles empty relation set and single relation gracefully', async () => {
      const emptyResult = NormalizationEngine.chaseAlgorithm([], []);
      expect(emptyResult.isLossless).toBe(false);

      const singleRel: RelationSchema[] = [
        { name: 'Single', attributes: ['X', 'Y'], primaryKey: ['X'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const singleResult = NormalizationEngine.chaseAlgorithm(singleRel, []);
      expect(singleResult.isLossless).toBe(true);
      expect(singleResult.fullyDistinguishedRowIndex).toBe(0);
      expect(singleResult.tableau).toEqual([['a_0', 'a_1']]);
    });
  });

  // =========================================================================
  // SECTION 4: Dependency Preservation Verification (checkDependencyPreservation)
  // =========================================================================
  describe('4. Dependency Preservation: Projected Closure Fixpoint', () => {
    it('detects loss of {Street, City} -> Zip in classic BCNF decomposition of Address', async () => {
      // Classic Textbook Example (Ullman, Garcia-Molina):
      // R(Street, City, Zip)
      // F = { Zip -> City, {Street, City} -> Zip }
      // Candidate keys: {Street, City}, {Street, Zip}
      // Both keys are prime. Table is in 3NF, but NOT in BCNF because Zip -> City (Zip is not superkey).
      // BCNF decomposition decomposes on Zip -> City:
      // R1(Zip, City)
      // R2(Street, Zip)
      //
      // Dependency Preservation Check:
      // In R1: Zip -> City is preserved.
      // In R2: No non-trivial FDs.
      // Can {Street, City} -> Zip be derived?
      // Z_0 = {Street, City}
      // Z_0 ∩ R1 = {City}. Closure under F is {City}. Intersection with R1 = {City}.
      // Z_0 ∩ R2 = {Street}. Closure under F is {Street}. Intersection with R2 = {Street}.
      // Fixpoint reached with Z = {Street, City}.
      // Zip is NOT in Z!
      // Therefore, {Street, City} -> Zip is LOST!
      const relations: RelationSchema[] = [
        { name: 'R1_ZipCity', attributes: ['Zip', 'City'], primaryKey: ['Zip'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2_StreetZip', attributes: ['Street', 'Zip'], primaryKey: ['Street', 'Zip'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['Zip'], 'City'),
        fd(['Street', 'City'], 'Zip'),
      ];

      const details = NormalizationEngine.checkDependencyPreservationDetails(relations, fds);
      expect(details.isPreserved).toBe(false);
      expect(details.preservationRatio).toBe(0.5);
      expect(details.preserved).toHaveLength(1);
      expect(details.preserved[0].lhs).toEqual(['Zip']);
      expect(details.lost).toHaveLength(1);
      expect(details.lost[0].lhs).toEqual(['Street', 'City']);

      const isPreserved = await NormalizationEngine.checkDependencyPreservation(relations, fds);
      expect(isPreserved).toBe(false);
    });

    it('verifies multi-relation transitive closure fixpoint across 4 relations: A -> B -> C -> D -> E', () => {
      // Schema: R(A, B, C, D, E)
      // Relations: R1(A, B), R2(B, C), R3(C, D), R4(D, E)
      // FDs: A -> B, B -> C, C -> D, D -> E, and original FD to verify: A -> E
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R3', attributes: ['C', 'D'], primaryKey: ['C'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R4', attributes: ['D', 'E'], primaryKey: ['D'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
        fd(['C'], 'D'),
        fd(['D'], 'E'),
        fd(['A'], 'E'),
      ];

      // Projected closure of {A} must expand:
      // Iteration 1: Z ∩ R1 = {A} -> closure {A,B,C,D,E} ∩ R1 = {A, B} -> Z = {A, B}
      // Iteration 2: Z ∩ R2 = {B} -> closure {A,B,C,D,E} ∩ R2 = {B, C} -> Z = {A, B, C}
      // Iteration 3: Z ∩ R3 = {C} -> closure {A,B,C,D,E} ∩ R3 = {C, D} -> Z = {A, B, C, D}
      // Iteration 4: Z ∩ R4 = {D} -> closure {A,B,C,D,E} ∩ R4 = {D, E} -> Z = {A, B, C, D, E}
      const projectedClosure = NormalizationEngine.computeProjectedClosure(['A'], relations, fds);
      expect(Array.from(projectedClosure).sort()).toEqual(['A', 'B', 'C', 'D', 'E']);

      const details = NormalizationEngine.checkDependencyPreservationDetails(relations, fds);
      expect(details.isPreserved).toBe(true);
      expect(details.preservationRatio).toBe(1.0);
    });

    it('verifies composite LHS preservation across intermediate relations: AB -> C, C -> D, BD -> E preserves AB -> E', () => {
      // Schema: R(A, B, C, D, E)
      // Relations: R1(A, B, C), R2(C, D), R3(B, D, E)
      // FDs: AB -> C, C -> D, BD -> E, AB -> E
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B', 'C'], primaryKey: ['A', 'B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['C', 'D'], primaryKey: ['C'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R3', attributes: ['B', 'D', 'E'], primaryKey: ['B', 'D'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A', 'B'], 'C'),
        fd(['C'], 'D'),
        fd(['B', 'D'], 'E'),
        fd(['A', 'B'], 'E'),
      ];

      const projectedClosure = NormalizationEngine.computeProjectedClosure(['A', 'B'], relations, fds);
      expect(projectedClosure.has('E')).toBe(true);

      const details = NormalizationEngine.checkDependencyPreservationDetails(relations, fds);
      expect(details.isPreserved).toBe(true);
      expect(details.lost).toHaveLength(0);
    });

    it('detects loss when composite dependency cannot be reconstructed: AB -> C with R1(A, C), R2(B, C) under C -> B', () => {
      // Schema: R(A, B, C), F = { AB -> C, C -> B }
      // Decomposition: R1(A, C), R2(B, C)
      // AB -> C is LOST because neither A nor B alone determines C.
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'C'], primaryKey: ['A', 'C'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['C'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A', 'B'], 'C'),
        fd(['C'], 'B'),
      ];

      const details = NormalizationEngine.checkDependencyPreservationDetails(relations, fds);
      expect(details.isPreserved).toBe(false);
      expect(details.lost.some(l => l.lhs.includes('A') && l.lhs.includes('B'))).toBe(true);
    });

    it('handles multi-attribute RHS dependencies in dependency preservation analysis', () => {
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B', 'C'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      const fds: FunctionalDependency[] = [
        fd(['A'], ['B', 'C']),
      ];

      const details = NormalizationEngine.checkDependencyPreservationDetails(relations, fds);
      expect(details.isPreserved).toBe(true);
      expect(details.preserved).toHaveLength(1);
    });
  });

  // =========================================================================
  // SECTION 5: BCNF Decomposition (decomposeBCNF & applyBCNF)
  // =========================================================================
  describe('5. BCNF Decomposition: Recursive Splitting & Normal Form Verification', () => {
    it('recursively decomposes a multi-step BCNF violation chain into valid BCNF subrelations', async () => {
      // Schema: R(A, B, C, D, E), F = { A -> B, B -> C, C -> D }, Candidate Key: {A, E}
      // Step 1: A -> BCD violates BCNF (A is not superkey, misses E).
      //   Decompose into R1(A, B, C, D) and R2(A, E).
      // Step 2: R2(A, E) is binary -> automatically in BCNF.
      //   In R1(A, B, C, D): B -> CD violates BCNF (B is not superkey, misses A).
      //   Decompose into R11(B, C, D) and R12(A, B).
      // Step 3: R12(A, B) is binary -> in BCNF.
      //   In R11(B, C, D): C -> D violates BCNF (C is not superkey, misses B).
      //   Decompose into R111(C, D) and R112(B, C).
      // Final leaves: {C, D}, {B, C}, {A, B}, {A, E}.
      const relation: RelationSchema = {
        name: 'MultiChain',
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

      const detailedResult = await NormalizationEngine.decomposeBCNFDetailed(relation, fds);
      expect(detailedResult.decompositionSteps.length).toBeGreaterThanOrEqual(1);

      // Verify all resulting relations satisfy BCNF
      for (const rel of detailedResult.relations) {
        const check = NormalizationEngine.isBCNF(rel.attributes, fds);
        expect(check.isBCNF).toBe(true);
      }

      // Verify the recursive decomposition is LOSSLESS
      expect(detailedResult.isLossless).toBe(true);

      const chaseCheck = await NormalizationEngine.checkLosslessJoin(detailedResult.relations, fds);
      expect(chaseCheck).toBe(true);
    });

    it('performs a no-op decomposition when schema is already in BCNF', async () => {
      // R(A, B, C), F = { A -> B, A -> C }. Key is {A}. Determinant is a superkey!
      const relation: RelationSchema = {
        name: 'AlreadyBCNF',
        attributes: ['A', 'B', 'C'],
        primaryKey: ['A'],
        foreignKeys: [],
        rows: [],
        sourceType: 'Base',
        metadata: { rowCount: 0, attributeTypes: {} }
      };
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['A'], 'C'),
      ];

      const result = await NormalizationEngine.decomposeBCNF(relation, fds);
      expect(result).toHaveLength(1);
      expect([...result[0].attributes].sort()).toEqual(['A', 'B', 'C']);
      expect(result[0].primaryKey).toEqual(['A']);
    });

    it('handles all-key relation with zero non-trivial FDs as trivially BCNF', async () => {
      // R(A, B, C) where no FDs exist. Entire relation is candidate key.
      const relation: RelationSchema = {
        name: 'AllKey',
        attributes: ['A', 'B', 'C'],
        primaryKey: ['A', 'B', 'C'],
        foreignKeys: [],
        rows: [],
        sourceType: 'Base',
        metadata: { rowCount: 0, attributeTypes: {} }
      };

      const result = await NormalizationEngine.decomposeBCNF(relation, []);
      expect(result).toHaveLength(1);
      expect(result[0].attributes).toHaveLength(3);
    });

    it('decomposes classic Student-Course-Instructor into two BCNF relations with correct foreign keys', async () => {
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

      const relations = await NormalizationEngine.decomposeBCNF(relation, fds);
      expect(relations).toHaveLength(2);

      const rInst = relations.find(r => r.attributes.includes('instructor') && r.attributes.includes('course') && !r.attributes.includes('student'));
      const rStud = relations.find(r => r.attributes.includes('student') && r.attributes.includes('instructor') && !r.attributes.includes('course'));

      expect(rInst).toBeDefined();
      expect(rStud).toBeDefined();

      // Check lossless join
      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);

      // Check dependency preservation (fails as expected for this textbook BCNF decomposition)
      const isPreserved = await NormalizationEngine.checkDependencyPreservation(relations, fds);
      expect(isPreserved).toBe(false);
    });

    it('applyBCNF decomposes only violating relations while leaving conforming relations intact', async () => {
      const conformingRel: RelationSchema = {
        name: 'Dept',
        attributes: ['dept_id', 'dept_name'],
        primaryKey: ['dept_id'],
        foreignKeys: [],
        rows: [],
        sourceType: 'Base',
        metadata: { rowCount: 0, attributeTypes: {} }
      };
      const violatingRel: RelationSchema = {
        name: 'CourseOffering',
        attributes: ['course_id', 'dept_id', 'dept_head'],
        primaryKey: ['course_id'],
        foreignKeys: [],
        rows: [],
        sourceType: 'Base',
        metadata: { rowCount: 0, attributeTypes: {} }
      };
      const fds: FunctionalDependency[] = [
        fd(['dept_id'], 'dept_name'),
        fd(['course_id'], 'dept_id'),
        fd(['dept_id'], 'dept_head'),
      ];

      const result = await NormalizationEngine.applyBCNF([conformingRel, violatingRel], fds);

      // Dept should remain intact. CourseOffering should be decomposed.
      const hasDept = result.some(r => r.name === 'Dept' && r.attributes.includes('dept_id') && r.attributes.includes('dept_name'));
      expect(hasDept).toBe(true);

      // All relations in result must satisfy BCNF
      for (const rel of result) {
        const check = NormalizationEngine.isBCNF(rel.attributes, fds);
        expect(check.isBCNF).toBe(true);
      }
    });
  });

  // =========================================================================
  // SECTION 6: Cross-Algorithm Invariants & Edge Cases
  // =========================================================================
  describe('6. Cross-Algorithm Invariants & Edge Cases', () => {
    it('verifies BCNF decomposition preserves data records with integer 0 and boolean false values', async () => {
      const relation: RelationSchema = {
        name: 'ProductStore',
        attributes: ['prod_id', 'store_id', 'is_active', 'stock_count'],
        primaryKey: ['prod_id', 'store_id'],
        foreignKeys: [],
        rows: [
          { prod_id: 'P1', store_id: 'S1', is_active: false, stock_count: 0 },
          { prod_id: 'P2', store_id: 'S1', is_active: true, stock_count: 10 },
        ],
        sourceType: 'Base',
        metadata: { rowCount: 2, attributeTypes: {} }
      };
      const fds: FunctionalDependency[] = [
        fd(['prod_id'], 'is_active'),
      ];

      const decomposed = await NormalizationEngine.decomposeBCNF(relation, fds);
      expect(decomposed.length).toBeGreaterThanOrEqual(2);

      const prodRel = decomposed.find(r => r.attributes.includes('prod_id') && r.attributes.includes('is_active'));
      expect(prodRel).toBeDefined();

      const rowP1 = prodRel!.rows.find((r: any) => r.prod_id === 'P1');
      expect(rowP1).toBeDefined();
      // Crucial: 0 and false must NOT be erased to ''
      expect(rowP1.is_active).toBe(false);

      const stockRel = decomposed.find(r => r.attributes.includes('stock_count'));
      expect(stockRel).toBeDefined();
      const rowStockP1 = stockRel!.rows.find((r: any) => r.prod_id === 'P1');
      expect(rowStockP1).toBeDefined();
      expect(rowStockP1.stock_count).toBe(0);
    });

    it('verifies that checkLosslessJoin is strictly true for all BCNF decompositions', async () => {
      // Heath's theorem guarantees binary decomposition R1 = X ∪ Y, R2 = R \ Y is lossless.
      // We test 3 distinct schemas:
      const testSchemas = [
        {
          name: 'Schema1',
          attributes: ['A', 'B', 'C'],
          fds: [fd(['A'], 'B'), fd(['B'], 'C')],
        },
        {
          name: 'Schema2',
          attributes: ['A', 'B', 'C', 'D'],
          fds: [fd(['A', 'B'], 'C'), fd(['C'], 'D')],
        },
        {
          name: 'Schema3',
          attributes: ['W', 'X', 'Y', 'Z'],
          fds: [fd(['W'], 'X'), fd(['X'], 'Y'), fd(['Y'], 'Z')],
        },
      ];

      for (const s of testSchemas) {
        const rel: RelationSchema = {
          name: s.name,
          attributes: s.attributes,
          primaryKey: [s.attributes[0]],
          foreignKeys: [],
          rows: [],
          sourceType: 'Base',
          metadata: { rowCount: 0, attributeTypes: {} }
        };
        const bcnfRels = await NormalizationEngine.decomposeBCNF(rel, s.fds);
        const lossless = await NormalizationEngine.checkLosslessJoin(bcnfRels, s.fds);
        expect(lossless).toBe(true);
      }
    });

    it('handles FDs with irrelevant attributes that do not belong to the relations', async () => {
      const relations: RelationSchema[] = [
        { name: 'R1', attributes: ['A', 'B'], primaryKey: ['A'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
        { name: 'R2', attributes: ['B', 'C'], primaryKey: ['B'], foreignKeys: [], rows: [], sourceType: 'Base', metadata: { rowCount: 0, attributeTypes: {} } },
      ];
      // FD refers to X, Y which do not exist in R1 or R2
      const fds: FunctionalDependency[] = [
        fd(['B'], 'C'),
        fd(['X'], 'Y'),
        fd(['A', 'Z'], 'W'),
      ];

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);

      const isPreserved = await NormalizationEngine.checkDependencyPreservation(relations, fds);
      // X -> Y and AZ -> W cannot be preserved since they are not in the schema
      expect(isPreserved).toBe(false);
    });
  });
});
