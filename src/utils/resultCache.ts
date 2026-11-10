/**
 * Result cache — single source of truth for the latest pipeline output.
 *
 * The full result lives in memory, so large inputs never hit the storage
 * quota. A slimmed copy (row arrays cut to a preview) goes to sessionStorage
 * so a page reload still shows the schema, ERD, SQL and report. Anything that
 * does not fit is dropped, never half-written.
 */

const STORAGE_KEY = 'normaflow_latest_results';
const ROW_PREVIEW = 50;

let memory: unknown = null;

/** JSON replacer that keeps only a preview of row arrays. */
function slimReplacer(key: string, value: unknown): unknown {
  if (key === 'rows' && Array.isArray(value) && value.length > ROW_PREVIEW) {
    return value.slice(0, ROW_PREVIEW);
  }
  return value;
}

export function loadCachedResult<T = unknown>(): T | null {
  if (memory) return memory as T;
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed && (parsed.success || parsed.tables)) return parsed as T;
  } catch {
    // Corrupt cache — ignore and treat as empty.
  }
  return null;
}

export function saveCachedResult(result: unknown): void {
  memory = result;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result, slimReplacer));
  } catch {
    // Quota exceeded or storage unavailable: the in-memory copy still serves this session.
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function clearCachedResult(): void {
  memory = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
