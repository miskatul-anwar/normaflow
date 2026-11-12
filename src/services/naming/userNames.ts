/**
 * Names the user typed and the on-device naming switch, remembered on this machine (localStorage) by relation signature,
 * i.e. table + columns + key. The same set of columns is found again on the next run and keeps the user's name.
 */
const NAMES_KEY = 'normaflow.relationNames';
const MODEL_KEY = 'normaflow.modelNaming';

export function loadUserNames(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(NAMES_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveUserName(signature: string, name: string): void {
  try {
    const all = loadUserNames();
    if (name.trim()) all[signature] = name.trim();
    else delete all[signature];
    localStorage.setItem(NAMES_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: the name lasts for this session only */
  }
}

export function modelNamingEnabled(): boolean {
  try {
    return localStorage.getItem(MODEL_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setModelNaming(on: boolean): void {
  try {
    localStorage.setItem(MODEL_KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}
