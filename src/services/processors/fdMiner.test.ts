import { describe, it, expect } from 'vitest';
import { mineFunctionalDependencies } from './fdMiner';

describe('fdMiner - Milestone 2 Composite Key & Edge Case Test Suite', () => {
  const hasFD = (fds: any[], lhs: string[], rhs: string) =>
    fds.some(
      fd =>
        fd.lhs.length === lhs.length &&
        lhs.every((attr: string) => fd.lhs.includes(attr)) &&
        fd.rhs === rhs
    );

  it('REGRESSION: mines composite candidate key FDs when level > 1 and classCount === rowCount', () => {
    // In this dataset:
    // student_id alone does NOT determine grade (student 1 has grades 'A' and 'B')
    // course_id alone does NOT determine grade (course 101 has grades 'A' and 'B')
    // {student_id, course_id} uniquely identifies every row (classCount === 4 === rowCount)
    // Previously, line 231 hit `continue;` before the RHS loop, silencing {student_id, course_id} -> grade!
    const data = [
      { student_id: 'S1', course_id: 'C101', grade: 'A' },
      { student_id: 'S1', course_id: 'C102', grade: 'B' },
      { student_id: 'S2', course_id: 'C101', grade: 'B' },
      { student_id: 'S2', course_id: 'C102', grade: 'A' },
    ];

    const { fds } = mineFunctionalDependencies(data, { maxLhsSize: 2, minConfidence: 1 });

    expect(hasFD(fds, ['student_id', 'course_id'], 'grade')).toBe(true);
    const fd = fds.find(f => f.lhs.includes('student_id') && f.lhs.includes('course_id') && f.rhs === 'grade');
    expect(fd).toBeDefined();
    expect(fd!.confidence).toBe(1.0);
    expect(fd!.violations).toBe(0);
  });

  it('mines 3-attribute composite determinant dependencies at higher lattice levels', () => {
    // project_id, employee_id, role_id together determine hours
    const data = [
      { proj: 'P1', emp: 'E1', role: 'Dev', hours: 40 },
      { proj: 'P1', emp: 'E1', role: 'QA', hours: 10 },
      { proj: 'P1', emp: 'E2', role: 'Dev', hours: 35 },
      { proj: 'P2', emp: 'E1', role: 'Dev', hours: 20 },
    ];

    const { fds } = mineFunctionalDependencies(data, { maxLhsSize: 3, minConfidence: 1 });
    expect(hasFD(fds, ['proj', 'emp', 'role'], 'hours')).toBe(true);
  });

  it('maintains minimality: does NOT emit {A, B} -> C if A -> C already holds', () => {
    // A determines C directly
    // {A, B} is a superset; {A, B} -> C is non-minimal and must be pruned
    const data = [
      { a: '1', b: 'x', c: 'alpha' },
      { a: '1', b: 'y', c: 'alpha' },
      { a: '2', b: 'x', c: 'beta' },
      { a: '2', b: 'z', c: 'beta' },
    ];

    const { fds } = mineFunctionalDependencies(data, { maxLhsSize: 2, minConfidence: 1 });
    expect(hasFD(fds, ['a'], 'c')).toBe(true);
    expect(hasFD(fds, ['a', 'b'], 'c')).toBe(false);
  });

  it('mines multiple non-overlapping composite dependencies', () => {
    // {a, b} -> c and {d, e} -> f
    const data = [
      { a: 1, b: 1, c: 'c1', d: 10, e: 10, f: 'f1' },
      { a: 1, b: 2, c: 'c2', d: 10, e: 20, f: 'f2' },
      { a: 2, b: 1, c: 'c3', d: 20, e: 10, f: 'f3' },
      { a: 2, b: 2, c: 'c4', d: 20, e: 20, f: 'f4' },
    ];

    const { fds } = mineFunctionalDependencies(data, { maxLhsSize: 2, minConfidence: 1 });
    expect(hasFD(fds, ['a', 'b'], 'c')).toBe(true);
    expect(hasFD(fds, ['d', 'e'], 'f')).toBe(true);
  });

  it('correctly calculates confidence and violations on composite determinants with noisy data', () => {
    // 9 rows satisfy {a, b} -> c, 1 row violates
    const data = [
      { a: 1, b: 1, c: 'X' },
      { a: 1, b: 1, c: 'X' },
      { a: 1, b: 1, c: 'X' },
      { a: 1, b: 2, c: 'Y' },
      { a: 1, b: 2, c: 'Y' },
      { a: 2, b: 1, c: 'Z' },
      { a: 2, b: 1, c: 'Z' },
      { a: 2, b: 2, c: 'W' },
      { a: 2, b: 2, c: 'W' },
      { a: 1, b: 1, c: 'CONFLICT' }, // Violating row
    ];

    const { fds } = mineFunctionalDependencies(data, { maxLhsSize: 2, minConfidence: 0.8 });
    const approx = fds.find(f => f.lhs.includes('a') && f.lhs.includes('b') && f.rhs === 'c');
    expect(approx).toBeDefined();
    expect(approx!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(approx!.confidence).toBeLessThan(1.0);
    expect(approx!.violations).toBeGreaterThan(0);
  });
});
