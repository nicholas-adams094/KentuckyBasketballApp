import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isStringArray, readJson, STORAGE_KEYS, storageAvailable, writeJson } from '@/lib/storage';
import {
  PreferencesContext,
  type Density,
  type PreferencesValue,
  type SavedLineup,
  type ThemeChoice,
} from '@/state/preferences';

const MAX_SAVED_LINEUPS = 12;

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isDensity(value: unknown): value is Density {
  return value === 'comfortable' || value === 'compact';
}

function isSavedLineupArray(value: unknown): value is SavedLineup[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SavedLineup).id === 'string' &&
        typeof (item as SavedLineup).seasonId === 'string' &&
        typeof (item as SavedLineup).lineup === 'object',
    )
  );
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/** Owns everything the reader can personalise, persisted best-effort to localStorage. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const persistenceAvailable = storageAvailable();

  const [theme, setThemeState] = useState<ThemeChoice>(() =>
    readJson<ThemeChoice>(STORAGE_KEYS.theme, 'system', isThemeChoice),
  );
  const [density, setDensityState] = useState<Density>(() =>
    readJson<Density>(STORAGE_KEYS.density, 'comfortable', isDensity),
  );
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(readJson<string[]>(STORAGE_KEYS.favorites, [], isStringArray)),
  );
  const [savedLineups, setSavedLineups] = useState<SavedLineup[]>(() =>
    readJson<SavedLineup[]>(STORAGE_KEYS.savedLineups, [], isSavedLineupArray),
  );

  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // The document element carries the theme so CSS custom properties can switch without
  // any component re-rendering.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.density = density;
    root.style.colorScheme = resolvedTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolvedTheme === 'dark' ? '#05070f' : '#0033a0');
  }, [resolvedTheme, density]);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    writeJson(STORAGE_KEYS.theme, next);
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    writeJson(STORAGE_KEYS.density, next);
  }, []);

  const toggleFavorite = useCallback((playerId: string) => {
    setFavorites((previous) => {
      const next = new Set(previous);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      writeJson(STORAGE_KEYS.favorites, [...next]);
      return next;
    });
  }, []);

  const saveLineup = useCallback((lineup: Omit<SavedLineup, 'id' | 'createdAt'>) => {
    setSavedLineups((previous) => {
      const entry: SavedLineup = {
        ...lineup,
        id: `${lineup.seasonId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      const next = [entry, ...previous].slice(0, MAX_SAVED_LINEUPS);
      writeJson(STORAGE_KEYS.savedLineups, next);
      return next;
    });
  }, []);

  const deleteLineup = useCallback((id: string) => {
    setSavedLineups((previous) => {
      const next = previous.filter((item) => item.id !== id);
      writeJson(STORAGE_KEYS.savedLineups, next);
      return next;
    });
  }, []);

  const value = useMemo<PreferencesValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      density,
      setDensity,
      favorites,
      isFavorite: (playerId: string) => favorites.has(playerId),
      toggleFavorite,
      savedLineups,
      saveLineup,
      deleteLineup,
      persistenceAvailable,
    }),
    [
      theme,
      resolvedTheme,
      setTheme,
      density,
      setDensity,
      favorites,
      toggleFavorite,
      savedLineups,
      saveLineup,
      deleteLineup,
      persistenceAvailable,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
