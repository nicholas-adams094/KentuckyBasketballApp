/**
 * Postseason round normalisation.
 *
 * The archive's `game.note` field records tournament rounds, but the wording is not
 * consistent across seasons — 1997–98 uses "NCAA First Round" and "NCAA Sweet Sixteen"
 * while 2002–03 uses "Round of 64" and "Sweet 16". Both are faithful to their source
 * media guides, so the data is left untouched; this module maps every variant onto a
 * canonical round so brackets render in the correct order regardless of season.
 */

import { allGames, seasons, type GameEntry } from '@/lib/archive';
import type { Season } from '@/types/archive';

export type NcaaRound =
  | 'Round of 64'
  | 'Round of 32'
  | 'Sweet 16'
  | 'Elite Eight'
  | 'Final Four'
  | 'National Championship';

export type SecRound = 'First Round' | 'Quarterfinal' | 'Semifinal' | 'Championship';

export const NCAA_ROUNDS: readonly NcaaRound[] = [
  'Round of 64',
  'Round of 32',
  'Sweet 16',
  'Elite Eight',
  'Final Four',
  'National Championship',
];

export const SEC_ROUNDS: readonly SecRound[] = ['First Round', 'Quarterfinal', 'Semifinal', 'Championship'];

/** Shorthand shown on bracket chips where horizontal space is tight. */
export const NCAA_ROUND_SHORT: Record<NcaaRound, string> = {
  'Round of 64': 'R64',
  'Round of 32': 'R32',
  'Sweet 16': 'S16',
  'Elite Eight': 'E8',
  'Final Four': 'F4',
  'National Championship': 'Title',
};

function normalizeNote(note: string | undefined): string {
  return (note ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function ncaaRoundOf(game: GameEntry, fallbackIndex: number): NcaaRound {
  const note = normalizeNote(game.note);
  // Most specific first: "regional semifinal" is the Sweet 16, not the Final Four, and
  // "regional final" is the Elite Eight.
  if (/sweet (16|sixteen)|regional semifinal/.test(note)) return 'Sweet 16';
  if (/elite eight|regional final/.test(note)) return 'Elite Eight';
  if (/national championship|championship game|national final/.test(note)) return 'National Championship';
  if (/final four|national semifinal/.test(note)) return 'Final Four';
  if (/second round|round of 32/.test(note)) return 'Round of 32';
  if (/first round|round of 64|opening round/.test(note)) return 'Round of 64';
  // A note that says only "championship" inside the NCAA phase is the title game.
  if (/championship/.test(note)) return 'National Championship';
  return NCAA_ROUNDS[Math.min(fallbackIndex, NCAA_ROUNDS.length - 1)];
}

export function secRoundOf(game: GameEntry, fallbackIndex: number, totalGames: number): SecRound {
  const note = normalizeNote(game.note);
  // Order matters: "semifinal" and "quarterfinal" both end in "final", so the more
  // specific rounds must be matched before the championship pattern.
  if (/quarterfinal/.test(note)) return 'Quarterfinal';
  if (/semifinal/.test(note)) return 'Semifinal';
  if (/championship|\bfinals?\b/.test(note)) return 'Championship';
  if (/first round|opening round|second round/.test(note)) return 'First Round';
  // Without a usable note, count backwards from the championship: the last game a team
  // played is the deepest round it reached.
  const fromEnd = totalGames - 1 - fallbackIndex;
  return (SEC_ROUNDS[SEC_ROUNDS.length - 1 - fromEnd] ?? 'First Round') as SecRound;
}

export interface BracketGame<R extends string> {
  round: R;
  game: GameEntry;
}

export interface PostseasonPath {
  seasonId: string;
  sec: BracketGame<SecRound>[];
  ncaa: BracketGame<NcaaRound>[];
  secTitle: boolean;
  secRunnerUp: boolean;
  ncaaSeed: number;
  deepestNcaaRound: NcaaRound | null;
  /** The game that ended the season, or null if the team ran the table. */
  eliminationGame: GameEntry | null;
  titleWon: boolean;
}

export function postseasonPath(season: Season): PostseasonPath {
  const games = allGames.filter((g) => g.seasonId === season.id);
  const secGames = games.filter((g) => g.phase === 'SEC Tournament');
  const ncaaGames = games.filter((g) => g.phase === 'NCAA Tournament');

  const sec = secGames.map((game, index) => ({
    round: secRoundOf(game, index, secGames.length),
    game,
  }));
  const ncaa = ncaaGames.map((game, index) => ({ round: ncaaRoundOf(game, index), game }));

  const secFinal = sec.find((b) => b.round === 'Championship');
  const lastNcaa = ncaa[ncaa.length - 1];
  const titleWon = lastNcaa?.round === 'National Championship' && lastNcaa.game.result === 'W';

  return {
    seasonId: season.id,
    sec,
    ncaa,
    secTitle: secFinal?.game.result === 'W',
    secRunnerUp: secFinal?.game.result === 'L',
    ncaaSeed: season.seed,
    deepestNcaaRound: lastNcaa?.round ?? null,
    eliminationGame: titleWon ? null : (lastNcaa?.game ?? sec[sec.length - 1]?.game ?? null),
    titleWon,
  };
}

/** Postseason paths for all ten seasons, computed once. */
export const postseasonPaths: readonly PostseasonPath[] = seasons.map(postseasonPath);

const pathBySeason = new Map(postseasonPaths.map((path) => [path.seasonId, path]));

export function pathFor(seasonId: string): PostseasonPath | undefined {
  return pathBySeason.get(seasonId);
}

/** Seasons that won the SEC Tournament, derived from the championship game result. */
export const secTournamentTitles: readonly string[] = postseasonPaths
  .filter((path) => path.secTitle)
  .map((path) => path.seasonId);

/** Seasons that reached at least the given NCAA round. */
export function seasonsReaching(round: NcaaRound): readonly string[] {
  const target = NCAA_ROUNDS.indexOf(round);
  return postseasonPaths
    .filter((path) => {
      const deepest = path.deepestNcaaRound ? NCAA_ROUNDS.indexOf(path.deepestNcaaRound) : -1;
      // Reaching a round means playing in it; losing in it still counts as reaching.
      return deepest >= target;
    })
    .map((path) => path.seasonId);
}
