/**
 * Pipeline planner: targets -> minimal valid pipeline.
 *
 * The operation set is a DAG, not a list. The plan is the dependency closure of
 * the requested operations, sorted by `order` (already a topological order in
 * `src/config/operations.ts`), which is also the order the canvas hook accepts
 * additions in.
 */
import { OPERATIONS } from '../../../config/operations';

export interface PlanResult {
  /** Operations in a valid add-order (ascending `order`). */
  plan: string[];
  /** Subset of `plan` the user did not ask for directly (pulled in as dependencies). */
  addedAsDependencies: string[];
}

export class PlanConflictError extends Error {
  constructor(
    public excluded: string[],
    public targets: string[],
    /** For each excluded operation, the requested targets that need it. */
    public neededBy: Record<string, string[]> = {},
  ) {
    super(`Excluded operation(s) are required: ${excluded.join(', ')}`);
    this.name = 'PlanConflictError';
  }
}

export function dependencyClosure(targets: string[]): Set<string> {
  const seen = new Set<string>();
  const visit = (name: string) => {
    if (seen.has(name)) return;
    const op = OPERATIONS[name];
    if (!op) throw new Error(`Unknown operation: ${name}`);
    seen.add(name);
    op.dependencies.forEach(visit);
  };
  targets.forEach(visit);
  return seen;
}

export function planFor(targets: string[], exclude: ReadonlySet<string> = new Set()): PlanResult {
  const closure = dependencyClosure(targets);
  const conflicts = [...closure].filter(n => exclude.has(n));
  if (conflicts.length) {
    const neededBy: Record<string, string[]> = {};
    for (const c of conflicts) neededBy[c] = targets.filter(t => t !== c && dependencyClosure([t]).has(c));
    throw new PlanConflictError(conflicts, targets, neededBy);
  }
  const plan = [...closure].sort((a, b) => OPERATIONS[a].order - OPERATIONS[b].order);
  return { plan, addedAsDependencies: plan.filter(n => !targets.includes(n)) };
}

/**
 * What clicking `label` on the palette should add when some prerequisites are
 * missing: the not-yet-placed part of its dependency closure, in valid order.
 * The canvas accepts any operation whose dependencies are placed (it only warns
 * about phase order), so this never fails.
 */
export function prerequisitesToAdd(label: string, placed: readonly string[]): { add: string[]; prerequisites: string[] } {
  const add = planFor([label]).plan.filter(p => !placed.includes(p));
  return { add, prerequisites: add.filter(p => p !== label) };
}

/** True when every dependency of `label` is already on the canvas. */
export function dependenciesMet(label: string, placed: readonly string[]): boolean {
  return (OPERATIONS[label]?.dependencies ?? []).every(d => placed.includes(d));
}
