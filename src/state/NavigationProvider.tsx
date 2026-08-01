import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSeason, getSeasonIndex, seasons } from '@/lib/archive';
import {
  buildHash,
  currentRoute,
  DEFAULT_SEASON,
  opponentHash,
  parseHash,
  type Route,
} from '@/lib/router';
import { NavigationContext, type NavigationValue } from '@/state/navigation';

/**
 * Owns the single source of navigation truth: `window.location.hash`.
 *
 * All navigation writes to the hash and lets the `hashchange` listener drive state,
 * so browser back/forward, a pasted deep link and an in-app click all follow exactly
 * the same code path.
 */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => currentRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    // Normalise a bare URL to a canonical route so the address bar is always shareable.
    if (!window.location.hash) {
      window.history.replaceState(null, '', buildHash({ seasonId: DEFAULT_SEASON, view: 'overview' }));
      setRoute(currentRoute());
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((hash: string) => {
    if (window.location.hash === hash) {
      // Same target: re-sync state anyway so repeated selection still feels responsive.
      setRoute(parseHash(hash));
      return;
    }
    window.location.hash = hash;
  }, []);

  /** Replace, rather than push, for transient UI state such as filters. */
  const replace = useCallback((hash: string) => {
    window.history.replaceState(null, '', hash);
    setRoute(parseHash(hash));
  }, []);

  const value = useMemo<NavigationValue>(() => {
    const season = getSeason(route.seasonId) ?? seasons[0];
    const seasonIndex = getSeasonIndex(season.id);

    const withParams = (mutate: (params: URLSearchParams) => void, options?: { replace?: boolean }) => {
      const params = new URLSearchParams(route.params);
      mutate(params);
      // Preserve an open player dialog across filter changes.
      const hash = buildHash({
        seasonId: season.id,
        view: route.view,
        params,
        playerId: route.playerId,
      });
      if (options?.replace) replace(hash);
      else navigate(hash);
    };

    return {
      route,
      season,
      seasonIndex,
      view: route.view,
      openPlayerId: route.playerId,
      openOpponent: route.opponent,

      goToSeason: (seasonId) => {
        // Season-scoped filters (sort, schedule filter, compare picks) are dropped on a
        // season change: they refer to players and games that may not exist in the new one.
        navigate(buildHash({ seasonId, view: route.view }));
      },
      goToView: (view) => navigate(buildHash({ seasonId: season.id, view })),
      goTo: (seasonId, view) => navigate(buildHash({ seasonId, view })),

      openPlayer: (playerId) =>
        navigate(buildHash({ seasonId: season.id, view: route.view, params: route.params, playerId })),
      closePlayer: () =>
        navigate(buildHash({ seasonId: season.id, view: route.view, params: route.params, playerId: null })),

      openOpponentPanel: (opponent) => navigate(opponentHash(opponent)),
      closeOpponentPanel: () => navigate(buildHash({ seasonId: season.id, view: 'era' })),

      navigate,
      getParam: (key) => route.params.get(key),
      setParam: (key, paramValue) =>
        withParams(
          (params) => {
            if (paramValue === null || paramValue === '') params.delete(key);
            else params.set(key, paramValue);
          },
          { replace: true },
        ),
      setParams: (values) =>
        withParams(
          (params) => {
            for (const [key, paramValue] of Object.entries(values)) {
              if (paramValue === null || paramValue === '') params.delete(key);
              else params.set(key, paramValue);
            }
          },
          { replace: true },
        ),
    };
  }, [route, navigate, replace]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
