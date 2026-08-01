/**
 * localStorage access that degrades gracefully.
 *
 * Private-browsing modes, disabled storage and quota errors must never break the
 * archive — the app stays fully usable, it just stops remembering preferences. Every
 * read is validated before use so a corrupted or hand-edited value cannot crash a view.
 */

const PREFIX = 'bba:';

export const STORAGE_KEYS = {
  favorites: `${PREFIX}favorites`,
  savedLineups: `${PREFIX}saved-lineups`,
  theme: `${PREFIX}theme`,
  density: `${PREFIX}density`,
  recent: `${PREFIX}recent`,
} as const;

let available: boolean | null = null;

export function storageAvailable(): boolean {
  if (available !== null) return available;
  try {
    const probe = `${PREFIX}__probe__`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function readJson<T>(key: string, fallback: T, validate?: (value: unknown) => value is T): T {
  if (!storageAvailable()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Most often a quota error. The in-memory state stays correct either way.
    return false;
  }
}

export function remove(key: string): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

// --- validators -------------------------------------------------------------

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Reset for tests. */
export function __resetStorageProbe(): void {
  available = null;
}
