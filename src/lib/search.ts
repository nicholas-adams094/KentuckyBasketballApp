/**
 * A small, dependency-free search index over the whole archive.
 *
 * Powers the command palette (⌘K) and the global search field. Everything is indexed
 * once at module load: 58 players, 10 seasons, 346 games, every opponent and every
 * view. That is a few thousand short strings, so a linear scored scan is instant and
 * avoids shipping a search library.
 */

import { allGames, bestSeasonOf, careerOf, profiles, seasons } from '@/lib/archive';
import { gameDate, seasonLabel } from '@/lib/format';
import { opponentRecords } from '@/lib/analytics';

export type SearchKind = 'player' | 'season' | 'game' | 'opponent' | 'view';

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  /** Lower-cased haystack of every searchable token for this document. */
  haystack: string;
  /** Ties are broken by this; higher surfaces first among equal text matches. */
  weight: number;
  route: string;
  imageKey?: string;
  /** Player id, so the palette can serve the small responsive portrait variant. */
  playerId?: string;
}

export interface SearchResult extends SearchDoc {
  score: number;
}

const VIEW_DOCS: SearchDoc[] = [
  {
    id: 'view:overview',
    kind: 'view',
    title: 'Season HQ',
    subtitle: 'Records, story, leaders and signature moments',
    haystack: 'season hq overview home dashboard summary leaders story',
    weight: 6,
    route: '#/season/{season}/overview',
  },
  {
    id: 'view:roster',
    kind: 'view',
    title: 'Roster & Stats',
    subtitle: 'Every player, sortable table and profile cards',
    haystack: 'roster stats players table cards sort filter',
    weight: 6,
    route: '#/season/{season}/roster',
  },
  {
    id: 'view:lineup',
    kind: 'view',
    title: 'Lineup Lab',
    subtitle: 'Build and score a five-man unit',
    haystack: 'lineup lab five starters depth chart rotation builder court',
    weight: 6,
    route: '#/season/{season}/lineup',
  },
  {
    id: 'view:schedule',
    kind: 'view',
    title: 'Schedule',
    subtitle: 'Every game with filters and result charts',
    haystack: 'schedule games results scores calendar opponents',
    weight: 6,
    route: '#/season/{season}/schedule',
  },
  {
    id: 'view:postseason',
    kind: 'view',
    title: 'Postseason',
    subtitle: 'SEC and NCAA Tournament paths',
    haystack: 'postseason ncaa tournament sec bracket march madness',
    weight: 6,
    route: '#/season/{season}/postseason',
  },
  {
    id: 'view:compare',
    kind: 'view',
    title: 'Compare',
    subtitle: 'Put up to four player-seasons side by side',
    haystack: 'compare comparison versus radar side by side players',
    weight: 6,
    route: '#/season/{season}/compare',
  },
  {
    id: 'view:era',
    kind: 'view',
    title: 'Era Vault',
    subtitle: 'Decade leaderboards, all-decade teams and rivals',
    haystack: 'era vault decade leaderboards all decade team rivals timeline alumni',
    weight: 6,
    route: '#/season/{season}/era',
  },
  {
    id: 'view:sources',
    kind: 'view',
    title: 'Sources & Provenance',
    subtitle: 'Every source, photo credit and review status',
    haystack: 'sources provenance credits citations attribution rights photos methodology',
    weight: 6,
    route: '#/season/{season}/sources',
  },
];

function buildIndex(): SearchDoc[] {
  const docs: SearchDoc[] = [...VIEW_DOCS];

  // Players — weighted by how much they actually played across the decade.
  for (const [id, profile] of Object.entries(profiles)) {
    const career = careerOf(id);
    const best = bestSeasonOf(id);
    const totalGames = career.reduce((sum, entry) => sum + entry.gp, 0);
    const span = career.length
      ? career.length === 1
        ? seasonLabel(career[0].seasonId)
        : `${seasonLabel(career[0].seasonId)} – ${seasonLabel(career[career.length - 1].seasonId)}`
      : 'Archive profile';
    const awards = career.flatMap((entry) => entry.awards);

    docs.push({
      id: `player:${id}`,
      kind: 'player',
      title: profile.name,
      subtitle: `${profile.pos} · ${profile.height} · ${span}`,
      haystack: [
        profile.name,
        profile.pos,
        profile.hometown,
        profile.highSchool,
        span,
        best ? `#${best.number}` : '',
        ...awards,
      ]
        .join(' ')
        .toLowerCase(),
      weight: 10 + Math.min(8, totalGames / 20),
      route: `#/player/${id}`,
      imageKey: profile.image,
      playerId: id,
    });
  }

  // Seasons.
  for (const season of seasons) {
    docs.push({
      id: `season:${season.id}`,
      kind: 'season',
      title: `${seasonLabel(season.id)} Wildcats`,
      subtitle: `${season.record[0]}–${season.record[1]} · ${season.finish}`,
      haystack: [
        season.id,
        seasonLabel(season.id),
        season.short,
        season.finish,
        season.conferenceFinish,
        season.signature,
      ]
        .join(' ')
        .toLowerCase(),
      weight: 12,
      route: `#/season/${season.id}/overview`,
      imageKey: season.teamImage,
    });
  }

  // Opponents — one document per program, spanning the decade.
  for (const rival of opponentRecords()) {
    docs.push({
      id: `opponent:${rival.opponent}`,
      kind: 'opponent',
      title: rival.opponent,
      subtitle: `Kentucky ${rival.wins}–${rival.losses} in ${rival.games.length} meeting${rival.games.length === 1 ? '' : 's'}`,
      haystack: `${rival.opponent} opponent rival`.toLowerCase(),
      weight: 4 + Math.min(6, rival.games.length),
      route: `#/opponent/${encodeURIComponent(rival.opponent)}`,
    });
  }

  // Individual games.
  for (const game of allGames) {
    docs.push({
      id: `game:${game.seasonId}:${game.gameNumber}`,
      kind: 'game',
      title: `${game.result === 'W' ? 'W' : 'L'} ${game.uk}–${game.opp} ${game.loc === 'A' ? 'at' : 'vs'} ${game.opponent}`,
      subtitle: `${seasonLabel(game.seasonId)} · ${gameDate(game.date)}${game.note ? ` · ${game.note}` : ''}`,
      haystack: [
        game.opponent,
        game.note ?? '',
        game.phase,
        game.date,
        seasonLabel(game.seasonId),
        `${game.uk} ${game.opp}`,
      ]
        .join(' ')
        .toLowerCase(),
      weight: 1,
      route: `#/season/${game.seasonId}/schedule?game=${game.gameNumber}`,
    });
  }

  return docs;
}

export const searchIndex: readonly SearchDoc[] = buildIndex();

/**
 * Scores one document against a query. Rewards, in order: exact title match, title
 * prefix, word-boundary hit in the title, then a substring anywhere in the haystack.
 * Returns 0 when any query token is missing entirely, so multi-word queries narrow.
 */
function scoreDoc(doc: SearchDoc, tokens: string[], raw: string): number {
  const title = doc.title.toLowerCase();
  let score = 0;

  if (title === raw) score += 200;
  else if (title.startsWith(raw)) score += 120;
  else if (title.includes(raw)) score += 70;
  else if (doc.haystack.includes(raw)) score += 30;

  for (const token of tokens) {
    if (!doc.haystack.includes(token)) return 0;
    if (title.startsWith(token)) score += 26;
    else if (new RegExp(`\\b${escapeRegExp(token)}`).test(title)) score += 18;
    else if (title.includes(token)) score += 10;
    else score += 4;
  }

  return score + doc.weight;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface SearchOptions {
  limit?: number;
  kinds?: SearchKind[];
}

export function search(query: string, options: SearchOptions = {}): SearchResult[] {
  const { limit = 20, kinds } = options;
  const raw = query.trim().toLowerCase();
  if (raw.length === 0) return [];

  const tokens = raw.split(/\s+/).filter(Boolean);
  const pool = kinds ? searchIndex.filter((doc) => kinds.includes(doc.kind)) : searchIndex;

  const results: SearchResult[] = [];
  for (const doc of pool) {
    const score = scoreDoc(doc, tokens, raw);
    if (score > 0) results.push({ ...doc, score });
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  player: 'Player',
  season: 'Season',
  game: 'Game',
  opponent: 'Opponent',
  view: 'Section',
};
