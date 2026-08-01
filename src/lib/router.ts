/**
 * Hash-based routing.
 *
 * A hash router is deliberate: the archive is a static bundle that must work from a
 * subdirectory, from Sites, from a file share, or offline, with no server rewrite
 * rules. Every meaningful piece of state — season, view, open player, schedule filter,
 * compare selection, lineup — lives in the URL so any screen can be linked and shared.
 */

import { getSeason, seasonIds } from '@/lib/archive';

export const VIEWS = [
  'overview',
  'roster',
  'lineup',
  'schedule',
  'postseason',
  'compare',
  'era',
  'sources',
] as const;

export type ViewId = (typeof VIEWS)[number];

export const VIEW_META: Record<ViewId, { label: string; short: string; description: string }> = {
  overview: { label: 'Season HQ', short: 'HQ', description: 'Records, story, leaders and signature moments' },
  roster: { label: 'Roster & Stats', short: 'Roster', description: 'Every player, sortable and searchable' },
  lineup: { label: 'Lineup Lab', short: 'Lineup', description: 'Build and score a five-man unit' },
  schedule: { label: 'Schedule', short: 'Games', description: 'All results with filters and charts' },
  postseason: { label: 'Postseason', short: 'Bracket', description: 'SEC and NCAA Tournament paths' },
  compare: { label: 'Compare', short: 'Compare', description: 'Up to four player-seasons side by side' },
  era: { label: 'Era Vault', short: 'Vault', description: 'Decade leaderboards, teams and rivals' },
  sources: { label: 'Sources', short: 'Sources', description: 'Citations, photo provenance and method' },
};

export const DEFAULT_SEASON = seasonIds[0];
export const DEFAULT_VIEW: ViewId = 'overview';

export interface Route {
  seasonId: string;
  view: ViewId;
  /** Player dialog target, if any. */
  playerId: string | null;
  /** Opponent detail target, if any. */
  opponent: string | null;
  params: URLSearchParams;
}

function isView(value: string): value is ViewId {
  return (VIEWS as readonly string[]).includes(value);
}

function safeSeason(value: string | undefined): string {
  return value && getSeason(value) ? value : DEFAULT_SEASON;
}

/**
 * Parses `#/season/2002-03/roster?sort=ppg`, `#/player/rajon-rondo`,
 * `#/opponent/Louisville`. Unknown shapes fall back to the default season overview
 * rather than rendering a blank screen.
 */
export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#/, '');
  const [pathPart, queryPart = ''] = cleaned.split('?');
  const params = new URLSearchParams(queryPart);
  const segments = pathPart.split('/').filter(Boolean);

  const base: Route = {
    seasonId: safeSeason(params.get('season') ?? undefined),
    view: DEFAULT_VIEW,
    playerId: null,
    opponent: null,
    params,
  };

  if (segments.length === 0) return base;

  switch (segments[0]) {
    case 'season': {
      const seasonId = safeSeason(segments[1]);
      const view = segments[2] && isView(segments[2]) ? segments[2] : DEFAULT_VIEW;
      return { ...base, seasonId, view, playerId: params.get('player') };
    }
    case 'player': {
      const playerId = segments[1] ? decodeURIComponent(segments[1]) : null;
      return { ...base, view: 'roster', playerId };
    }
    case 'opponent': {
      const opponent = segments[1] ? decodeURIComponent(segments[1]) : null;
      return { ...base, view: 'era', opponent };
    }
    default:
      return base;
  }
}

/**
 * Builds a canonical season route.
 *
 * `playerId` is tri-state and the distinction matters:
 *   - a string  → open that player
 *   - `null`    → explicitly close any open player
 *   - omitted   → leave whatever `params` already says
 *
 * Treating "omitted" as "close" is what a caller that sets `player` inside `params`
 * would run into, so the field is only honoured when it is actually present.
 */
export function buildHash(
  route: Omit<Partial<Route>, 'playerId'> & {
    seasonId: string;
    view: ViewId;
    playerId?: string | null;
  },
): string {
  const params = new URLSearchParams(route.params ?? undefined);
  params.delete('season');
  if (route.playerId !== undefined) {
    if (route.playerId === null) params.delete('player');
    else params.set('player', route.playerId);
  }
  const query = params.toString();
  return `#/season/${route.seasonId}/${route.view}${query ? `?${query}` : ''}`;
}

export function playerHash(playerId: string): string {
  return `#/player/${encodeURIComponent(playerId)}`;
}

export function opponentHash(opponent: string): string {
  return `#/opponent/${encodeURIComponent(opponent)}`;
}

export function seasonHash(seasonId: string, view: ViewId = DEFAULT_VIEW): string {
  return `#/season/${seasonId}/${view}`;
}

export function currentRoute(): Route {
  return parseHash(typeof window === 'undefined' ? '' : window.location.hash);
}
