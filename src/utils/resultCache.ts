/**
 * Result cache — single source of truth for the latest pipeline output.
 *
 * Previously results were written to sessionStorage, localStorage AND a window
 * global in different code paths, with three different read fallbacks. This
 * module unifies that behind one small API (sessionStorage only — results can
 * be large and should not outlive the tab).
 */

const STORAGE_KEY = 'normaflow_latest_results';

export function loadCachedResult<T = unknown>(): T | null {
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
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  } catch {
    // Storage full or unavailable — non-fatal.
  }
}

export function clearCachedResult(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
