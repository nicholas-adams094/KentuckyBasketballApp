import { createContext, useContext } from 'react';
import type { Position } from '@/types/archive';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

export interface SavedLineup {
  id: string;
  seasonId: string;
  name: string;
  lineup: Partial<Record<Position, string>>;
  score: number;
  createdAt: string;
}

export interface PreferencesValue {
  theme: ThemeChoice;
  /** The theme actually applied, after resolving `system`. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeChoice) => void;

  density: Density;
  setDensity: (density: Density) => void;

  favorites: ReadonlySet<string>;
  isFavorite: (playerId: string) => boolean;
  toggleFavorite: (playerId: string) => void;

  savedLineups: readonly SavedLineup[];
  saveLineup: (lineup: Omit<SavedLineup, 'id' | 'createdAt'>) => void;
  deleteLineup: (id: string) => void;

  /** False when localStorage is unavailable; the UI explains that nothing will persist. */
  persistenceAvailable: boolean;
}

export const PreferencesContext = createContext<PreferencesValue | null>(null);

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return value;
}
