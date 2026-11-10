/**
 * Result cache — single source of truth for the latest pipeline output of each workspace tab.
 *
 * The full result lives in memory, so large inputs never hit the storage
 * quota. A slimmed copy (row arrays cut to a preview) goes to sessionStorage
 * so a page reload still shows the schema, ERD, SQL and report. Anything that
 * does not fit is dropped, never half-written.
 */

const STORAGE_KEY = 'normaflow_latest_results';
const DEFAULT_KEY = 'default';
const storageKey = (key: string) => (key === DEFAULT_KEY ? STORAGE_KEY : `${STORAGE_KEY}:${key}`);
const ROW_PREVIEW = 50;

const memory = new Map<string, unknown>();

/** JSON replacer that keeps only a preview of row arrays. */
function slimReplacer(key: string, value: unknown): unknown {
  if (key === 'rows' && Array.isArray(value) && value.length > ROW_PREVIEW) {
    return value.slice(0, ROW_PREVIEW);
  }
  return value;
}

export function loadCachedResult<T = unknown>(key: string = DEFAULT_KEY): T | null {
  if (memory.get(key)) return memory.get(key) as T;
  try {
    const cached = sessionStorage.getItem(storageKey(key));
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed && (parsed.success || parsed.tables)) return parsed as T;
  } catch {
    // Corrupt cache — ignore and treat as empty.
  }
  return null;
}

export function saveCachedResult(result: unknown, key: string = DEFAULT_KEY): void {
  memory.set(key, result);
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(result, slimReplacer));
  } catch {
    // Quota exceeded or storage unavailable: the in-memory copy still serves this session.
    try {
      sessionStorage.removeItem(storageKey(key));
    } catch {
      // ignore
    }
  }
}

export function clearCachedResult(key: string = DEFAULT_KEY): void {
  memory.delete(key);
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}
