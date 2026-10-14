import { describe, expect, it } from 'vitest';
import {
  NormalizationEngine,
  FunctionalDependency,
  RelationSchema
} from '../services/processors/normalizationEngine';

// Helper to construct FunctionalDependency objects
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

describe('Milestone 3 Challenger: Adversarial Stress Suite for 3NF Synthesis & Decomposition', () => {

  // =========================================================================
  // SUITE 1: 3NF SYNTHESIS — CANDIDATE KEY INJECTION ON UNSPANNED ATTRIBUTES
  // =========================================================================
  describe('1. Candidate Key Injection on Unspanned Attributes', () => {
    it('injects candidate key relation when candidate key AD contains unspanned attribute D', async () => {
      // R(A, B, C, D), F = { A -> B, B -> C }, candidate key: {A, D}
      // D does not appear in any FD. Neither R_A(A, B) nor R_B(B, C) contains D.
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

      // Must produce: {A, B}, {B, C}, and candidate key relation {A, D}
      expect(relations).toHaveLength(3);

      const ckRel = relations.find(r => r.attributes.includes('A') && r.attributes.includes('D'));
      expect(ckRel).toBeDefined();
      expect(ckRel!.primaryKey).toEqual(['A', 'D']);
      expect([...ckRel!.attributes].sort()).toEqual(['A', 'D']);
      expect(ckRel!.sourceType).toBe('3NF_CandidateKey_Lossless');

      // Verify Chase confirms lossless join
      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);

      // Verify all FDs preserved
      const isPreserved = await NormalizationEngine.checkDependencyPreservation(relations, fds);
      expect(isPreserved).toBe(true);
    });

    it('injects candidate key with multiple isolated unspanned attributes (N1, N2, N3)', async () => {
      // R(A, B, C, N1, N2, N3), F = { A -> B, B -> C }, candidate key: {A, N1, N2, N3}
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
      ];
      const allAttrs = ['A', 'B', 'C', 'N1', 'N2', 'N3'];
      const candidateKeys = [['A', 'N1', 'N2', 'N3']];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, [], allAttrs);

      const ckRel = relations.find(r => r.attributes.includes('N1'));
      expect(ckRel).toBeDefined();
      expect([...ckRel!.primaryKey].sort()).toEqual(['A', 'N1', 'N2', 'N3']);
      expect([...ckRel!.attributes].sort()).toEqual(['A', 'N1', 'N2', 'N3']);

      // Ensure every single attribute in allAttrs is accounted for
      const unionAttrs = new Set(relations.flatMap(r => r.attributes));
      expect(allAttrs.every(a => unionAttrs.has(a))).toBe(true);

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);
    });

    it('chooses the shortest candidate key when multiple candidate keys exist and none is covered', async () => {
      // R(A, B, C, D, E), F = { A -> B, B -> C, D -> E }
      // Candidate keys: {A, D} (length 2) and {B, C, D} is not minimal, but suppose {A, D} and {B, D}
      // FDs: A -> B, B -> A (cycle), B -> C. Keys: {A, D} and {B, D}.
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'A'),
        fd(['B'], 'C'),
      ];
      const candidateKeys = [['A', 'D'], ['B', 'D']];
      const allAttrs = ['A', 'B', 'C', 'D'];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, [], allAttrs);

      // Candidate key relations: should add one candidate key relation with D
      const ckRels = relations.filter(r => r.sourceType === '3NF_CandidateKey_Lossless');
      expect(ckRels).toHaveLength(1);
      expect(ckRels[0].attributes).toContain('D');
      expect(ckRels[0].primaryKey).toHaveLength(2);

      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);
    });

    it('does NOT inject an extra candidate key relation when a synthesized relation already embeds a candidate key', async () => {
      // R(A, B, C), F = { A -> B, A -> C }, CK = {A}
      // Synthesized relation: {A, B, C} with PK A. Candidate key {A} is already covered!
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['A'], 'C'),
      ];
      const candidateKeys = [['A']];
      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, []);

      expect(relations).toHaveLength(1);
      expect(relations[0].sourceType).toBe('3NF_Synthesized');
      expect(relations.some(r => r.sourceType === '3NF_CandidateKey_Lossless')).toBe(false);
    });

    it('does NOT inject an extra candidate key when composite candidate key is fully embedded in a relation', async () => {
      // R(A, B, C, D), F = { AB -> C, AB -> D }, CK = {A, B}
      const fds: FunctionalDependency[] = [
        fd(['A', 'B'], 'C'),
        fd(['A', 'B'], 'D'),
      ];
      const candidateKeys = [['A', 'B']];
      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, []);

      expect(relations).toHaveLength(1);
      expect([...relations[0].attributes].sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(relations[0].primaryKey).toEqual(['A', 'B']);
      expect(relations.some(r => r.sourceType === '3NF_CandidateKey_Lossless')).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 2: 3NF SYNTHESIS — CYCLIC FUNCTIONAL DEPENDENCIES
  // =========================================================================
  describe('2. Cyclic Functional Dependencies Handling', () => {
    it('eliminates duplicate relations in 2-cycle A <-> B', async () => {
      // F = { A -> B, B -> A }. Candidate keys: {A}, {B}.
      // Synthesized from A: {A, B}. Synthesized from B: {A, B}.
      // Redundancy elimination must output exactly ONE relation!
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'A'),
      ];
      const candidateKeys = [['A'], ['B']];
      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, []);

      expect(relations).toHaveLength(1);
      expect([...relations[0].attributes].sort()).toEqual(['A', 'B']);
      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);
    });

    it('eliminates duplicate relations when cyclic FDs share common dependent attributes', async () => {
      // F = { A -> B, B -> A, A -> C, B -> C }
      // Relation from A: {A, B, C}. Relation from B: {B, A, C}.
      // Must collapse to exactly ONE relation {A, B, C}.
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'A'),
        fd(['A'], 'C'),
        fd(['B'], 'C'),
      ];
      const candidateKeys = [['A'], ['B']];
      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, []);

      expect(relations).toHaveLength(1);
      expect([...relations[0].attributes].sort()).toEqual(['A', 'B', 'C']);
      expect(await NormalizationEngine.checkLosslessJoin(relations, fds)).toBe(true);
    });

    it('correctly synthesizes 3-cycle A -> B -> C -> A without loss or false pruning', async () => {
      // F = { A -> B, B -> C, C -> A }.
      // Grouped FDs: R_A(A, B), R_B(B, C), R_C(C, A).
      // None of these is a proper subset of another! All 3 must exist to preserve all FDs!
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
        fd(['C'], 'A'),
      ];
      const candidateKeys = [['A'], ['B'], ['C']];
      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, []);

      expect(relations).toHaveLength(3);
      const attrSets = relations.map(r => r.attributes.sort().join(','));
      expect(attrSets).toContain('A,B');
      expect(attrSets).toContain('B,C');
      expect(attrSets).toContain('A,C');

      // Verify Chase confirms lossless join
      expect(await NormalizationEngine.checkLosslessJoin(relations, fds)).toBe(true);
      // Verify dependency preservation
      expect(await NormalizationEngine.checkDependencyPreservation(relations, fds)).toBe(true);
    });

    it('handles overlapping multi-attribute cycles (AB -> C, C -> A, C -> B)', async () => {
      // F = { AB -> C, C -> A, C -> B }
      // Canonical cover: AB -> C, C -> A, C -> B
      // Synthesized: R1(A, B, C) with PK AB; R2(A, B, C) with PK C.
      // Since attributes are identical, one must be pruned!
      const fds: FunctionalDependency[] = [
        fd(['A', 'B'], 'C'),
        fd(['C'], 'A'),
        fd(['C'], 'B'),
      ];
      const candidateKeys = [['A', 'B'], ['C']];
      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, []);

      expect(relations).toHaveLength(1);
      expect([...relations[0].attributes].sort()).toEqual(['A', 'B', 'C']);
      expect(await NormalizationEngine.checkLosslessJoin(relations, fds)).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 3: 3NF SYNTHESIS — ISOLATED ATTRIBUTES & ZERO-FD FALLBACK
  // =========================================================================
  describe('3. Isolated Attributes and Zero-FD Fallback', () => {
    it('synthesizes universal candidate key relation when FD set is empty', async () => {
      const allAttrs = ['colA', 'colB', 'colC'];
      const data = [{ colA: 1, colB: 2, colC: 3 }];
      const relations = await NormalizationEngine.synthesize3NF([], [], data, allAttrs);

      expect(relations).toHaveLength(1);
      expect(relations[0].name).toBe('MainRelation_3NF');
      expect(relations[0].sourceType).toBe('3NF_Universal');
      expect([...relations[0].attributes].sort()).toEqual(['colA', 'colB', 'colC']);
      expect(relations[0].primaryKey).toEqual(['colA', 'colB', 'colC']);
      expect(relations[0].rows).toHaveLength(1);
    });

    it('retains isolated attributes not covered by any candidate key or FD', async () => {
      // Suppose caller passed candidate key {A} but attributes contains unreferenced Z
      const fds: FunctionalDependency[] = [fd(['A'], 'B')];
      const candidateKeys = [['A']];
      const allAttrs = ['A', 'B', 'Z'];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, [], allAttrs);

      const zRel = relations.find(r => r.attributes.includes('Z'));
      expect(zRel).toBeDefined();
      expect(zRel!.attributes).toEqual(['Z']);
    });

    it('never injects Universal_Lossless_Relation fallback across diverse edge-case schemas', async () => {
      const testCases: Array<{ fds: FunctionalDependency[]; keys: string[][]; attrs: string[] }> = [
        { fds: [fd(['A'], 'B')], keys: [['A', 'C']], attrs: ['A', 'B', 'C'] },
        { fds: [fd(['A'], 'B'), fd(['B'], 'C'), fd(['C'], 'D')], keys: [['A']], attrs: ['A', 'B', 'C', 'D'] },
        { fds: [fd(['A', 'B'], 'C'), fd(['D'], 'E')], keys: [['A', 'B', 'D']], attrs: ['A', 'B', 'C', 'D', 'E'] },
        { fds: [fd(['X'], 'Y')], keys: [['X', 'Z1', 'Z2']], attrs: ['X', 'Y', 'Z1', 'Z2'] },
        { fds: [], keys: [['A', 'B']], attrs: ['A', 'B'] },
      ];

      for (const tc of testCases) {
        const relations = await NormalizationEngine.synthesize3NF(tc.fds, tc.keys, [], tc.attrs);
        for (const rel of relations) {
          expect(rel.name).not.toBe('Universal_Lossless_Relation');
        }
      }
    });
  });

  // =========================================================================
  // SUITE 4: 3NF DECOMPOSITION — DETERMINANT RETENTION & MULTI-ATTRIBUTE LHS
  // =========================================================================
  describe('4. 3NF Decomposition (apply3NF)', () => {
    it('retains multi-attribute determinant (AB) in residual relation for transitive FD AB -> C', async () => {
      // R(K, A, B, C), PK = K.
      // Full dependencies: K -> A, K -> B.
      // Transitive dependency: AB -> C (AB is not a superkey, C is non-prime).
      const relations2NF: RelationSchema[] = [{
        name: 'OrdersWithDetails',
        attributes: ['K', 'A', 'B', 'C'],
        primaryKey: ['K'],
        foreignKeys: [],
        rows: [
          { K: 'k1', A: 'a1', B: 'b1', C: 'c1' },
          { K: 'k2', A: 'a1', B: 'b1', C: 'c1' },
        ],
        sourceType: '2NF',
        metadata: { rowCount: 2, attributeTypes: {} }
      }];

      const fds: FunctionalDependency[] = [
        fd(['K'], 'A'),
        fd(['K'], 'B'),
        fd(['A', 'B'], 'C'),
      ];

      const relations3NF = await NormalizationEngine.apply3NF(relations2NF, fds);

      expect(relations3NF).toHaveLength(2);

      // Decomposed relation: {A, B, C} with PK {A, B}
      const decompRel = relations3NF.find(r => r.attributes.includes('C'));
      expect(decompRel).toBeDefined();
      expect([...decompRel!.attributes].sort()).toEqual(['A', 'B', 'C']);
      expect([...decompRel!.primaryKey].sort()).toEqual(['A', 'B']);

      // Residual relation: {K, A, B} — MUST RETAIN A and B!
      const residualRel = relations3NF.find(r => r.attributes.includes('K'));
      expect(residualRel).toBeDefined();
      expect(residualRel!.attributes).toContain('K');
      expect(residualRel!.attributes).toContain('A');
      expect(residualRel!.attributes).toContain('B');
      expect(residualRel!.attributes).not.toContain('C');

      // Residual PK must remain K
      expect(residualRel!.primaryKey).toEqual(['K']);

      // Residual table must have Foreign Key referencing decompRel on [A, B]
      expect(residualRel!.foreignKeys.length).toBeGreaterThan(0);
      const fk = residualRel!.foreignKeys.find(f => f.references === decompRel!.name);
      expect(fk).toBeDefined();
      expect([...fk!.attributes].sort()).toEqual(['A', 'B']);
      expect([...fk!.referencedKey].sort()).toEqual(['A', 'B']);

      // Common columns check
      const common = residualRel!.attributes.filter(a => decompRel!.attributes.includes(a));
      expect([...common].sort()).toEqual(['A', 'B']);

      // Lossless join check on decomposed schema
      const isLossless = await NormalizationEngine.checkLosslessJoin(relations3NF, fds);
      expect(isLossless).toBe(true);
    });

    it('does NOT decompose relations that satisfy Boyce 3NF prime attribute condition', async () => {
      // Classic Boyce textbook example:
      // R(City, Street, Zip)
      // Candidate keys: {Street, Zip} and {City, Street}
      // FDs: {City, Street} -> Zip, Zip -> City.
      // In Zip -> City: Zip is not a superkey, BUT City is prime!
      // Therefore, R is in 3NF (even though it violates BCNF).
      // apply3NF MUST NOT decompose this relation!
      const relations2NF: RelationSchema[] = [{
        name: 'PostalAddresses',
        attributes: ['City', 'Street', 'Zip'],
        primaryKey: ['Street', 'Zip'],
        foreignKeys: [],
        rows: [
          { City: 'San Francisco', Street: 'Market St', Zip: '94102' },
          { City: 'San Francisco', Street: 'Mission St', Zip: '94103' },
        ],
        sourceType: '2NF',
        metadata: { rowCount: 2, attributeTypes: {} }
      }];

      const fds: FunctionalDependency[] = [
        fd(['City', 'Street'], 'Zip'),
        fd(['Zip'], 'City'),
      ];

      const relations3NF = await NormalizationEngine.apply3NF(relations2NF, fds);

      expect(relations3NF).toHaveLength(1);
      expect(relations3NF[0].name).toBe('PostalAddresses');
      expect([...relations3NF[0].attributes].sort()).toEqual(['City', 'Street', 'Zip']);
    });

    it('preserves single-attribute residual relation without silent drop', async () => {
      // Suppose R(PK, X) where X violates 3NF due to transitive FD
      // Residual relation is [PK], which has length 1.
      // Regression test: Old engine had `if (residualSet.length >= 2)` which silently discarded it!
      const relations2NF: RelationSchema[] = [{
        name: 'SingleResidual',
        attributes: ['ID', 'Det', 'Val'],
        primaryKey: ['ID'],
        foreignKeys: [],
        rows: [{ ID: 1, Det: 'd1', Val: 'v1' }],
        sourceType: '2NF',
        metadata: { rowCount: 1, attributeTypes: {} }
      }];

      const fds: FunctionalDependency[] = [
        fd(['ID'], 'Det'),
        fd(['Det'], 'Val'),
      ];

      const relations3NF = await NormalizationEngine.apply3NF(relations2NF, fds);

      expect(relations3NF).toHaveLength(2);
      const residual = relations3NF.find(r => r.primaryKey.includes('ID'));
      expect(residual).toBeDefined();
      expect(residual!.attributes).toContain('ID');
      expect(residual!.attributes).toContain('Det');
    });

    it('correctly handles chained transitive dependencies (A -> B, B -> C, C -> D)', async () => {
      // R(A, B, C, D), PK = A.
      // FDs: A -> B, B -> C, C -> D.
      // Violations: B -> C, C -> D.
      const relations2NF: RelationSchema[] = [{
        name: 'ChainedRelation',
        attributes: ['A', 'B', 'C', 'D'],
        primaryKey: ['A'],
        foreignKeys: [],
        rows: [
          { A: '1', B: '10', C: '100', D: '1000' },
          { A: '2', B: '20', C: '200', D: '2000' },
        ],
        sourceType: '2NF',
        metadata: { rowCount: 2, attributeTypes: {} }
      }];

      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
        fd(['C'], 'D'),
      ];

      const relations3NF = await NormalizationEngine.apply3NF(relations2NF, fds);

      // Violations extracted: Rel for B -> C {B, C}, Rel for C -> D {C, D}
      // Residual table: {A, B}
      expect(relations3NF.length).toBeGreaterThanOrEqual(3);

      const relBC = relations3NF.find(r => r.primaryKey.includes('B') && r.attributes.includes('C'));
      const relCD = relations3NF.find(r => r.primaryKey.includes('C') && r.attributes.includes('D'));
      const relRes = relations3NF.find(r => r.primaryKey.includes('A'));

      expect(relBC).toBeDefined();
      expect(relCD).toBeDefined();
      expect(relRes).toBeDefined();

      // All original attributes must be covered
      const allExtractedAttrs = new Set(relations3NF.flatMap(r => r.attributes));
      expect(['A', 'B', 'C', 'D'].every(a => allExtractedAttrs.has(a))).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 5: THEORETICAL INVARIANTS & PROPERTY-BASED RANDOM SCHEMAS
  // =========================================================================
  describe('5. Theoretical Invariants & Stress Testing', () => {
    it('satisfies Bernstein 3NF synthesis guarantees across complex multi-branch schemas', async () => {
      // R(A, B, C, D, E, F, G, H)
      // F = { A -> B, B -> C, D -> E, DF -> G, G -> H }
      // Candidate keys: {A, D, F}
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
        fd(['D'], 'E'),
        fd(['D', 'F'], 'G'),
        fd(['G'], 'H'),
      ];
      const allAttrs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const candidateKeys = [['A', 'D', 'F']];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, [], allAttrs);

      // 1. Lossless Join guaranteed
      const isLossless = await NormalizationEngine.checkLosslessJoin(relations, fds);
      expect(isLossless).toBe(true);

      // 2. Dependency Preservation guaranteed
      const depCheck = await NormalizationEngine.checkDependencyPreservation(relations, fds);
      expect(depCheck).toBe(true);

      // 3. Every relation is in 3NF
      for (const rel of relations) {
        const check3NF = NormalizationEngine.is3NF(rel.attributes, fds, [rel.primaryKey]);
        expect(check3NF.is3NF).toBe(true);
      }

      // 4. Candidate key {A, D, F} must be embedded in some relation
      const hasKey = relations.some(r => ['A', 'D', 'F'].every(k => r.attributes.includes(k)));
      expect(hasKey).toBe(true);
    });

    it('correctly preserves false and 0 values across extracted relation rows', async () => {
      const fds: FunctionalDependency[] = [
        fd(['id'], 'count'),
        fd(['id'], 'isActive'),
      ];
      const candidateKeys = [['id']];
      const data = [
        { id: '1', count: 0, isActive: false },
        { id: '2', count: 42, isActive: true },
      ];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, data);
      expect(relations).toHaveLength(1);
      const r = relations[0];
      expect(r.rows).toHaveLength(2);
      expect(r.rows[0].count).toBe(0);
      expect(r.rows[0].isActive).toBe(false);
    });

    it('handles long 6-cycle (A->B->C->D->E->F->A) preserving all relations and lossless join', async () => {
      const attrs = ['A', 'B', 'C', 'D', 'E', 'F'];
      const fds: FunctionalDependency[] = [
        fd(['A'], 'B'),
        fd(['B'], 'C'),
        fd(['C'], 'D'),
        fd(['D'], 'E'),
        fd(['E'], 'F'),
        fd(['F'], 'A'),
      ];
      const candidateKeys = [['A'], ['B'], ['C'], ['D'], ['E'], ['F']];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, [], attrs);

      // In a pure cycle of length 6, canonical cover keeps all 6 binary FDs
      // and each forms a 2-attribute relation: {A, B}, {B, C}, etc.
      expect(relations).toHaveLength(6);
      expect(await NormalizationEngine.checkLosslessJoin(relations, fds)).toBe(true);
      expect(await NormalizationEngine.checkDependencyPreservation(relations, fds)).toBe(true);
    });

    it('collapses complete graph K4 cyclic FDs to a single 4-attribute relation without duplicates', async () => {
      const attrs = ['A', 'B', 'C', 'D'];
      const fds: FunctionalDependency[] = [];
      for (const a of attrs) {
        for (const b of attrs) {
          if (a !== b) fds.push(fd([a], b));
        }
      }
      const candidateKeys = [['A'], ['B'], ['C'], ['D']];

      const relations = await NormalizationEngine.synthesize3NF(fds, candidateKeys, [], attrs);

      // In K4, all attributes are equivalent. Canonical cover will group/prune them into 1 relation!
      expect(relations).toHaveLength(1);
      expect([...relations[0].attributes].sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(await NormalizationEngine.checkLosslessJoin(relations, fds)).toBe(true);
    });

    it('handles multiple overlapping candidate keys in apply3NF without destroying non-violation keys', async () => {
      // R(A, B, C, D)
      // Candidate keys: {A, B} and {B, C}
      // FDs: {A, B} -> C, {B, C} -> A (makes both AB and BC candidate keys)
      // Violation: B -> D (B is not a superkey, D is non-prime)
      // apply3NF must decompose on B -> D into R1(B, D) and R2(A, B, C).
      // Residual relation R2(A, B, C) retains both candidate keys {A, B} and {B, C}!
      const relations2NF: RelationSchema[] = [{
        name: 'MultiKeyRel',
        attributes: ['A', 'B', 'C', 'D'],
        primaryKey: ['A', 'B'],
        foreignKeys: [],
        rows: [],
        sourceType: '2NF',
        metadata: { rowCount: 0, attributeTypes: {} }
      }];

      const fds: FunctionalDependency[] = [
        fd(['A', 'B'], 'C'),
        fd(['B', 'C'], 'A'),
        fd(['B'], 'D'),
      ];

      const relations3NF = await NormalizationEngine.apply3NF(relations2NF, fds);
      expect(relations3NF).toHaveLength(2);

      const decompRel = relations3NF.find(r => r.attributes.includes('D'));
      const residualRel = relations3NF.find(r => !r.attributes.includes('D'));

      expect(decompRel).toBeDefined();
      expect([...decompRel!.attributes].sort()).toEqual(['B', 'D']);
      expect(decompRel!.primaryKey).toEqual(['B']);

      expect(residualRel).toBeDefined();
      expect([...residualRel!.attributes].sort()).toEqual(['A', 'B', 'C']);
      expect(residualRel!.primaryKey).toEqual(['A', 'B']);
    });

    it('empirically verifies 15 randomized relational schemas satisfy all 3NF invariants', async () => {
      const allAttrsPool = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

      for (let trial = 0; trial < 15; trial++) {
        // Pick 4 to 6 attributes
        const numAttrs = 4 + (trial % 3);
        const schemaAttrs = allAttrsPool.slice(0, numAttrs);

        // Generate 2-4 valid random FDs
        const testFDs: FunctionalDependency[] = [];
        const numFDs = 2 + (trial % 3);
        for (let f = 0; f < numFDs; f++) {
          const lhsSize = 1 + (f % 2);
          const lhs = schemaAttrs.slice(0, lhsSize);
          const remaining = schemaAttrs.filter(a => !lhs.includes(a));
          if (remaining.length > 0) {
            const rhs = remaining[(trial + f) % remaining.length];
            testFDs.push(fd(lhs, rhs));
          }
        }

        const candidateKeys = NormalizationEngine.findCandidateKeys(schemaAttrs, testFDs);
        const relations = await NormalizationEngine.synthesize3NF(testFDs, candidateKeys, [], schemaAttrs);

        // Invariant 1: Lossless Join
        const isLossless = await NormalizationEngine.checkLosslessJoin(relations, testFDs);
        expect(isLossless).toBe(true);

        // Invariant 2: Dependency Preservation
        const isPreserved = await NormalizationEngine.checkDependencyPreservation(relations, testFDs);
        expect(isPreserved).toBe(true);

        // Invariant 3: Zero Universal_Lossless_Relation
        for (const rel of relations) {
          expect(rel.name).not.toBe('Universal_Lossless_Relation');
        }

        // Invariant 4: Attribute preservation
        const unionAttrs = new Set(relations.flatMap(r => r.attributes));
        for (const attr of schemaAttrs) {
          expect(unionAttrs.has(attr)).toBe(true);
        }

        // Invariant 5: Each relation is in 3NF
        for (const rel of relations) {
          const check = NormalizationEngine.is3NF(rel.attributes, testFDs, [rel.primaryKey]);
          expect(check.is3NF).toBe(true);
        }
      }
    });
  });
});
