import { createContext, useContext } from 'react';
import type { Route, ViewId } from '@/lib/router';
import type { Season } from '@/types/archive';

export interface NavigationValue {
  route: Route;
  season: Season;
  seasonIndex: number;
  view: ViewId;
  /** Player id whose profile dialog is open, or null. */
  openPlayerId: string | null;
  /** Opponent whose head-to-head panel is open, or null. */
  openOpponent: string | null;

  goToSeason: (seasonId: string) => void;
  goToView: (view: ViewId) => void;
  goTo: (seasonId: string, view: ViewId) => void;
  openPlayer: (playerId: string) => void;
  closePlayer: () => void;
  openOpponentPanel: (opponent: string) => void;
  closeOpponentPanel: () => void;
  /** Navigate to an arbitrary in-app hash (used by search and deep links). */
  navigate: (hash: string) => void;
  /** Read/write a single query parameter without losing the rest of the route. */
  getParam: (key: string) => string | null;
  setParam: (key: string, value: string | null) => void;
  /**
   * Writes several parameters in one navigation.
   *
   * Two `setParam` calls in the same handler would both read the same pre-update route,
   * so the second would silently discard the first. Anything that changes more than one
   * parameter at once (for example sorting, which sets both the key and the direction)
   * must use this instead.
   */
  setParams: (values: Record<string, string | null>) => void;
}

export const NavigationContext = createContext<NavigationValue | null>(null);

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation must be used inside <NavigationProvider>');
  return value;
}
