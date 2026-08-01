/**
 * Derived analytics for the Tubby Smith archive.
 *
 * IMPORTANT: everything in this module is *computed* from the stored box-score data.
 * None of it is an official statistic, and the UI labels it as derived wherever it is
 * shown. The archive only stores per-game rate stats (mpg/ppg/rpg/apg/spg/bpg/tov) and
 * games played, so every derivation below is built strictly from those inputs — no
 * shooting splits, possessions or play-by-play exist in this dataset, and nothing here
 * pretends otherwise.
 */

import {
  allGames,
  allPlayerSeasons,
  careerOf,
  getSeason,
  playedSeasons,
  seasons,
  type GameEntry,
  type PlayerSeasonEntry,
} from '@/lib/archive';
import { heightToInches, winPctNumber } from '@/lib/format';
import { postseasonPaths, seasonsReaching, secTournamentTitles } from '@/lib/tournament';
import {
  isExemptTournamentPhase,
  isPostseasonPhase,
  type Game,
  type GameResult,
  type Position,
  type Season,
} from '@/types/archive';

// ---------------------------------------------------------------------------
// Rate statistics
// ---------------------------------------------------------------------------

/** The five box-score rate categories the archive stores for every player-season. */
export const RATE_KEYS = ['ppg', 'rpg', 'apg', 'spg', 'bpg'] as const;
export type RateKey = (typeof RATE_KEYS)[number];

/** Rate categories plus turnovers, which is a lower-is-better stat. */
export const BOX_KEYS = [...RATE_KEYS, 'tov'] as const;
export type BoxKey = (typeof BOX_KEYS)[number];

export const STAT_LABEL: Record<BoxKey | 'mpg' | 'gp', string> = {
  gp: 'GP',
  mpg: 'MPG',
  ppg: 'PPG',
  rpg: 'RPG',
  apg: 'APG',
  spg: 'SPG',
  bpg: 'BPG',
  tov: 'TOV',
};

export const STAT_FULL_LABEL: Record<BoxKey | 'mpg' | 'gp', string> = {
  gp: 'Games played',
  mpg: 'Minutes per game',
  ppg: 'Points per game',
  rpg: 'Rebounds per game',
  apg: 'Assists per game',
  spg: 'Steals per game',
  bpg: 'Blocks per game',
  tov: 'Turnovers per game',
};

/** Lower values are better for these categories. */
export const INVERTED_STATS = new Set<BoxKey>(['tov']);

/**
 * Per-40-minute rate. Standard normalisation for comparing players with very
 * different playing time. Guarded against tiny minute totals, which would otherwise
 * explode into meaningless numbers for deep-bench players.
 */
export function per40(value: number, mpg: number): number | null {
  if (mpg < 4) return null;
  return (value / mpg) * 40;
}

/** Total production across a season, reconstructed from the per-game rate and GP. */
export function seasonTotal(value: number, gp: number): number {
  return value * gp;
}

// ---------------------------------------------------------------------------
// Team share
// ---------------------------------------------------------------------------

/**
 * A player's share of their team's total output in a category, using reconstructed
 * season totals. Answers "how much of this team ran through this player?".
 */
export function teamShare(entry: PlayerSeasonEntry, key: BoxKey): number {
  const season = getSeason(entry.seasonId);
  if (!season) return 0;
  const teamTotal = season.roster.reduce((sum, line) => sum + seasonTotal(line[key], line.gp), 0);
  if (teamTotal <= 0) return 0;
  return seasonTotal(entry[key], entry.gp) / teamTotal;
}

// ---------------------------------------------------------------------------
// Era-relative scoring
// ---------------------------------------------------------------------------

export interface Distribution {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

function describe(values: number[]): Distribution {
  const count = values.length;
  if (count === 0) return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / count;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / count;
  return {
    mean,
    stdDev: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
    count,
  };
}

/**
 * Distribution of each box-score category across every rotation player-season of the
 * decade. "Rotation" is defined as 8+ minutes per game, which keeps a 2-minute
 * garbage-time appearance from distorting the baseline.
 */
const ROTATION_MINUTES = 8;

export const rotationSeasons: readonly PlayerSeasonEntry[] = playedSeasons.filter(
  (entry) => entry.mpg >= ROTATION_MINUTES,
);

export const eraDistributions: Record<BoxKey, Distribution> = BOX_KEYS.reduce(
  (acc, key) => {
    acc[key] = describe(rotationSeasons.map((entry) => entry[key]));
    return acc;
  },
  {} as Record<BoxKey, Distribution>,
);

/**
 * How many standard deviations a player-season sits from the decade's rotation
 * average. Sign is flipped for turnovers so that positive always means "better".
 */
export function eraZScore(entry: PlayerSeasonEntry, key: BoxKey): number {
  const dist = eraDistributions[key];
  if (dist.stdDev === 0) return 0;
  const z = (entry[key] - dist.mean) / dist.stdDev;
  return INVERTED_STATS.has(key) ? -z : z;
}

/** Percentile (0–1) within all rotation player-seasons of the decade. */
export function eraPercentile(entry: PlayerSeasonEntry, key: BoxKey): number {
  const values = rotationSeasons.map((e) => e[key]);
  if (values.length === 0) return 0;
  const target = entry[key];
  const below = INVERTED_STATS.has(key)
    ? values.filter((v) => v > target).length
    : values.filter((v) => v < target).length;
  return below / values.length;
}

/**
 * Composite two-way rating, 0–100, scaled so the decade's rotation average lands
 * near 50. A blunt, transparent instrument: a weighted sum of era z-scores across the
 * six stored categories. Explicitly a fan metric, not an efficiency rating.
 */
const IMPACT_WEIGHTS: Record<BoxKey, number> = {
  ppg: 1.0,
  rpg: 0.75,
  apg: 0.75,
  spg: 0.55,
  bpg: 0.45,
  tov: 0.35,
};

export function impactRating(entry: PlayerSeasonEntry): number {
  if (entry.gp === 0) return 0;
  const weighted = BOX_KEYS.reduce((sum, key) => sum + eraZScore(entry, key) * IMPACT_WEIGHTS[key], 0);
  const totalWeight = BOX_KEYS.reduce((sum, key) => sum + IMPACT_WEIGHTS[key], 0);
  const normalized = weighted / totalWeight;
  // Minute-weighted confidence: a strong rate line over 6 minutes is not the same
  // claim as the same line over 32 minutes.
  const minuteWeight = Math.min(1, entry.mpg / 20);
  return clamp(Math.round(50 + normalized * 18 * (0.55 + 0.45 * minuteWeight)), 1, 99);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Every player-season ranked by composite impact, best first. */
export const impactBoard: readonly (PlayerSeasonEntry & { impact: number })[] = rotationSeasons
  .map((entry) => ({ ...entry, impact: impactRating(entry) }))
  .sort((a, b) => b.impact - a.impact);

// ---------------------------------------------------------------------------
// Season-level analytics
// ---------------------------------------------------------------------------

export interface SeasonSplit {
  label: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  games: number;
}

/** Works on any game-shaped record, so it serves both `Season.games` and `GameEntry`. */
function splitOf(
  label: string,
  games: readonly Pick<Game, 'result' | 'uk' | 'opp'>[],
): SeasonSplit {
  return {
    label,
    wins: games.filter((g) => g.result === 'W').length,
    losses: games.filter((g) => g.result === 'L').length,
    pointsFor: games.reduce((a, g) => a + g.uk, 0),
    pointsAgainst: games.reduce((a, g) => a + g.opp, 0),
    games: games.length,
  };
}

export function seasonSplits(season: Season): SeasonSplit[] {
  const games = season.games;
  // Non-conference covers every regular-season game that is not SEC-flagged, which
  // includes the named early-season events (Maui, Guardians Classic). Those also get
  // their own line so the split table adds up in both readings.
  return [
    splitOf('Home', games.filter((g) => g.loc === 'H')),
    splitOf('Away', games.filter((g) => g.loc === 'A')),
    splitOf('Neutral', games.filter((g) => g.loc === 'N')),
    splitOf('SEC regular season', games.filter((g) => g.sec && !isPostseasonPhase(g.phase))),
    splitOf('Non-conference', games.filter((g) => !g.sec && !isPostseasonPhase(g.phase))),
    splitOf('Early-season tournament', games.filter((g) => isExemptTournamentPhase(g.phase))),
    splitOf('SEC Tournament', games.filter((g) => g.phase === 'SEC Tournament')),
    splitOf('NCAA Tournament', games.filter((g) => g.phase === 'NCAA Tournament')),
  ].filter((split) => split.games > 0);
}

export interface StreakInfo {
  type: GameResult;
  length: number;
  startIndex: number;
  endIndex: number;
}

/** All win/loss streaks in schedule order. */
export function streaks(games: readonly { result: GameResult }[]): StreakInfo[] {
  const out: StreakInfo[] = [];
  let current: StreakInfo | null = null;
  games.forEach((game, index) => {
    if (current && current.type === game.result) {
      current.length += 1;
      current.endIndex = index;
    } else {
      if (current) out.push(current);
      current = { type: game.result, length: 1, startIndex: index, endIndex: index };
    }
  });
  if (current) out.push(current);
  return out;
}

export function longestStreak(games: readonly { result: GameResult }[], type: GameResult): StreakInfo | null {
  const matching = streaks(games).filter((s) => s.type === type);
  if (matching.length === 0) return null;
  return matching.reduce((best, s) => (s.length > best.length ? s : best));
}

/** Running win-loss differential after each game — the season's momentum trace. */
export function recordTrace(games: readonly GameEntry[]): { game: number; wins: number; losses: number; diff: number }[] {
  let wins = 0;
  let losses = 0;
  return games.map((game, index) => {
    if (game.result === 'W') wins += 1;
    else losses += 1;
    return { game: index + 1, wins, losses, diff: wins - losses };
  });
}

export interface SeasonAnalysis {
  season: Season;
  splits: SeasonSplit[];
  longestWinStreak: StreakInfo | null;
  longestLossStreak: StreakInfo | null;
  biggestWin: GameEntry | null;
  toughestLoss: GameEntry | null;
  closeGames: SeasonSplit;
  blowouts: SeasonSplit;
  overtimeGames: GameEntry[];
  trace: ReturnType<typeof recordTrace>;
  /** Era rank (1 = best of the ten seasons) for headline categories. */
  ranks: {
    winPct: number;
    margin: number;
    offense: number;
    defense: number;
  };
}

const CLOSE_GAME_MARGIN = 5;
const BLOWOUT_MARGIN = 20;

export function analyzeSeason(season: Season): SeasonAnalysis {
  const games = allGames.filter((g) => g.seasonId === season.id);
  const close = games.filter((g) => Math.abs(g.margin) <= CLOSE_GAME_MARGIN);
  const blowout = games.filter((g) => Math.abs(g.margin) >= BLOWOUT_MARGIN);
  const wins = games.filter((g) => g.result === 'W');
  const losses = games.filter((g) => g.result === 'L');

  return {
    season,
    splits: seasonSplits(season),
    longestWinStreak: longestStreak(games, 'W'),
    longestLossStreak: longestStreak(games, 'L'),
    biggestWin: wins.length ? wins.reduce((best, g) => (g.margin > best.margin ? g : best)) : null,
    toughestLoss: losses.length ? losses.reduce((worst, g) => (g.margin < worst.margin ? g : worst)) : null,
    closeGames: splitOf(`Games decided by ${CLOSE_GAME_MARGIN} or fewer`, close),
    blowouts: splitOf(`Games decided by ${BLOWOUT_MARGIN} or more`, blowout),
    overtimeGames: games.filter((g) => Boolean(g.overtime)),
    trace: recordTrace(games),
    ranks: {
      winPct: seasonRank(season, (s) => winPctNumber(s.record[0], s.record[1])),
      margin: seasonRank(season, (s) => s.margin),
      offense: seasonRank(season, (s) => s.ppg),
      defense: seasonRank(season, (s) => -s.oppPpg),
    },
  };
}

/** 1-based rank of a season among all ten, highest scoring value first. */
export function seasonRank(season: Season, score: (season: Season) => number): number {
  const target = score(season);
  const better = seasons.filter((s) => score(s) > target).length;
  return better + 1;
}

// ---------------------------------------------------------------------------
// Opponent / rivalry records across the decade
// ---------------------------------------------------------------------------

export interface OpponentRecord {
  opponent: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  games: GameEntry[];
  lastMeeting: GameEntry;
}

export function opponentRecords(): OpponentRecord[] {
  const map = new Map<string, OpponentRecord>();
  for (const game of allGames) {
    let entry = map.get(game.opponent);
    if (!entry) {
      entry = {
        opponent: game.opponent,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        games: [],
        lastMeeting: game,
      };
      map.set(game.opponent, entry);
    }
    if (game.result === 'W') entry.wins += 1;
    else entry.losses += 1;
    entry.pointsFor += game.uk;
    entry.pointsAgainst += game.opp;
    entry.games.push(game);
    if (game.date > entry.lastMeeting.date) entry.lastMeeting = game;
  }
  return [...map.values()].sort(
    (a, b) => b.games.length - a.games.length || a.opponent.localeCompare(b.opponent),
  );
}

// ---------------------------------------------------------------------------
// Career arcs
// ---------------------------------------------------------------------------

export interface CareerSummary {
  playerId: string;
  name: string;
  seasons: readonly PlayerSeasonEntry[];
  span: string;
  gamesPlayed: number;
  /** Minutes-weighted career averages, the correct way to combine per-game rates. */
  averages: Record<BoxKey | 'mpg', number>;
  peak: PlayerSeasonEntry | null;
  peakImpact: number;
  awards: string[];
}

export function careerSummary(playerId: string): CareerSummary | null {
  const career = careerOf(playerId);
  if (career.length === 0) return null;
  const played = career.filter((entry) => entry.gp > 0);
  const gamesPlayed = played.reduce((sum, entry) => sum + entry.gp, 0);

  const averages = ([...BOX_KEYS, 'mpg'] as const).reduce(
    (acc, key) => {
      acc[key] = gamesPlayed
        ? played.reduce((sum, entry) => sum + entry[key] * entry.gp, 0) / gamesPlayed
        : 0;
      return acc;
    },
    {} as Record<BoxKey | 'mpg', number>,
  );

  const rated = played.map((entry) => ({ entry, impact: impactRating(entry) }));
  const best = rated.length ? rated.reduce((a, b) => (b.impact > a.impact ? b : a)) : null;

  return {
    playerId,
    name: career[0].profile.name,
    seasons: career,
    span: career.length === 1 ? career[0].seasonId : `${career[0].seasonId} – ${career[career.length - 1].seasonId}`,
    gamesPlayed,
    averages,
    peak: best?.entry ?? null,
    peakImpact: best?.impact ?? 0,
    awards: [...new Set(career.flatMap((entry) => entry.awards))],
  };
}

/** Players with more than one season, ordered by total games played. */
export function multiSeasonCareers(): CareerSummary[] {
  const ids = [...new Set(allPlayerSeasons.map((entry) => entry.id))];
  return ids
    .map((id) => careerSummary(id))
    .filter((c): c is CareerSummary => c !== null && c.seasons.length > 1)
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed);
}

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------

export type LeaderboardScope = 'season' | 'era';

export interface LeaderboardRow {
  entry: PlayerSeasonEntry;
  value: number;
  rank: number;
}

/**
 * Top player-seasons in a category. A minimum-minutes gate keeps small-sample lines
 * out of decade leaderboards, matching how record books qualify leaders.
 */
export function leaderboard(
  key: BoxKey,
  options: { limit?: number; seasonId?: string; minMinutes?: number } = {},
): LeaderboardRow[] {
  const { limit = 10, seasonId, minMinutes = seasonId ? 0 : ROTATION_MINUTES } = options;
  const pool = playedSeasons.filter(
    (entry) => entry.mpg >= minMinutes && (!seasonId || entry.seasonId === seasonId),
  );
  const sorted = [...pool].sort((a, b) =>
    INVERTED_STATS.has(key) ? a[key] - b[key] : b[key] - a[key],
  );
  return sorted.slice(0, limit).map((entry, index) => ({ entry, value: entry[key], rank: index + 1 }));
}

/** The single statistical leader for a season in a category. */
export function seasonLeader(seasonId: string, key: BoxKey): PlayerSeasonEntry | undefined {
  return leaderboard(key, { seasonId, limit: 1 })[0]?.entry;
}

// ---------------------------------------------------------------------------
// Lineup evaluation
// ---------------------------------------------------------------------------

/** Positions each slot can plausibly be filled by, from the archive's position strings. */
const POSITION_FIT: Record<Position, string[]> = {
  PG: ['PG', 'G'],
  SG: ['G', 'SG', 'G/F', 'PG'],
  SF: ['G/F', 'F', 'G', 'SF'],
  PF: ['F', 'F/C', 'PF', 'C'],
  C: ['C', 'F/C'],
};

export function positionFit(slot: Position, listedPosition: string): number {
  const fits = POSITION_FIT[slot];
  const index = fits.indexOf(listedPosition);
  if (index === 0) return 1;
  if (index > 0) return 0.75;
  return 0.35;
}

export interface LineupEvaluation {
  players: PlayerSeasonEntry[];
  totals: Record<BoxKey, number>;
  /** Average minutes across the five, a rough proxy for how real the unit is. */
  minutes: number;
  score: number;
  fit: number;
  duplicates: number;
  tallestInches: number;
  tags: string[];
  verdict: string;
}

const EMPTY_TOTALS = (): Record<BoxKey, number> =>
  BOX_KEYS.reduce((acc, key) => ({ ...acc, [key]: 0 }), {} as Record<BoxKey, number>);

/**
 * Scores a five-man unit. This is a transparent fan metric built from era-relative
 * production, positional fit and ball security — not a possession-based efficiency
 * rating, which this dataset cannot support.
 */
export function evaluateLineup(
  lineup: Partial<Record<Position, string>>,
  seasonId: string,
): LineupEvaluation {
  const season = getSeason(seasonId);
  const slots: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const players: PlayerSeasonEntry[] = [];
  let fitSum = 0;

  for (const slot of slots) {
    const id = lineup[slot];
    if (!id || !season) continue;
    const line = allPlayerSeasons.find((entry) => entry.seasonId === seasonId && entry.id === id);
    if (!line) continue;
    players.push(line);
    fitSum += positionFit(slot, line.profile.pos);
  }

  const totals = players.reduce((acc, player) => {
    for (const key of BOX_KEYS) acc[key] += player[key];
    return acc;
  }, EMPTY_TOTALS());

  const uniqueIds = new Set(players.map((p) => p.id));
  const duplicates = players.length - uniqueIds.size;
  const fit = players.length ? fitSum / players.length : 0;
  const minutes = players.length ? players.reduce((a, p) => a + p.mpg, 0) / players.length : 0;
  const tallestInches = players.reduce((max, p) => Math.max(max, heightToInches(p.profile.height)), 0);

  // Era-relative production of the unit, averaged across its members.
  const impactAvg = players.length
    ? players.reduce((sum, p) => sum + impactRating(p), 0) / players.length
    : 0;

  const rawScore =
    impactAvg * 0.72 + // era-relative production carries the rating
    fit * 22 + // positional coherence
    Math.min(totals.apg, 16) * 0.9 - // creation, capped so one passer can't dominate
    Math.max(0, totals.tov - 9) * 1.6 - // ball security penalty above a normal load
    duplicates * 22; // a duplicated player is not a legal five

  const score = clamp(Math.round(rawScore), 5, 99);

  const tags: string[] = [];
  if (totals.ppg >= 55) tags.push('High-octane');
  if (totals.apg >= 12) tags.push('Playmaking');
  if (totals.spg + totals.bpg >= 7) tags.push('Pressure defense');
  if (totals.rpg >= 25) tags.push('Glass control');
  if (tallestInches >= 84) tags.push('Rim size');
  if (fit >= 0.95) tags.push('True positions');
  if (totals.tov <= 7.5 && players.length === 5) tags.push('Ball security');
  if (minutes >= 26) tags.push('Heavy-minute core');
  if (tags.length === 0) tags.push('Balanced');

  const verdict =
    duplicates > 0
      ? 'Not a legal five — a player is duplicated'
      : players.length < 5
        ? 'Incomplete lineup'
        : score >= 85
          ? 'Title-caliber balance'
          : score >= 72
            ? 'Strong two-way blend'
            : score >= 58
              ? 'Functional rotation unit'
              : 'Experimental mix';

  return { players, totals, minutes, score, fit, duplicates, tallestInches, tags, verdict };
}

/** Auto-builds a five by maximising a chosen statistic under positional fit. */
export function optimizeLineup(
  seasonId: string,
  objective: 'documented' | 'offense' | 'defense' | 'passing' | 'balanced',
): Record<Position, string> {
  const season = getSeason(seasonId);
  const slots: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  if (!season) return {} as Record<Position, string>;
  if (objective === 'documented') return { ...season.starters };

  const pool = allPlayerSeasons.filter((entry) => entry.seasonId === seasonId && entry.gp > 0);

  const value = (entry: PlayerSeasonEntry): number => {
    switch (objective) {
      case 'offense':
        return entry.ppg + entry.apg * 0.8;
      case 'defense':
        return entry.spg * 2.4 + entry.bpg * 2.2 + entry.rpg * 0.5;
      case 'passing':
        return entry.apg * 2.2 - entry.tov * 0.7;
      case 'balanced':
        return impactRating(entry);
    }
  };

  // Greedy assignment weighted by positional fit: fills the most constrained slot
  // (centre, then point guard) first so a wing-heavy roster still yields a real five.
  const order: Position[] = ['C', 'PG', 'PF', 'SG', 'SF'];
  const used = new Set<string>();
  const out = {} as Record<Position, string>;

  for (const slot of order) {
    const candidates = pool
      .filter((entry) => !used.has(entry.id))
      .map((entry) => ({ entry, score: value(entry) * (0.45 + 0.55 * positionFit(slot, entry.profile.pos)) }))
      .sort((a, b) => b.score - a.score);
    const pick = candidates[0]?.entry;
    if (pick) {
      out[slot] = pick.id;
      used.add(pick.id);
    }
  }

  // Return in canonical slot order for stable rendering.
  return slots.reduce((acc, slot) => {
    if (out[slot]) acc[slot] = out[slot];
    return acc;
  }, {} as Record<Position, string>);
}

// ---------------------------------------------------------------------------
// Decade-wide aggregates
// ---------------------------------------------------------------------------

export interface DecadeTotals {
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  ncaaWins: number;
  ncaaLosses: number;
  secTourneyTitles: number;
  ncaaAppearances: number;
  sweet16s: number;
  eliteEights: number;
  finalFours: number;
  titles: number;
}

export function decadeTotals(): DecadeTotals {
  const ncaa = allGames.filter((g) => g.phase === 'NCAA Tournament');
  return {
    games: allGames.length,
    wins: allGames.filter((g) => g.result === 'W').length,
    losses: allGames.filter((g) => g.result === 'L').length,
    pointsFor: allGames.reduce((a, g) => a + g.uk, 0),
    pointsAgainst: allGames.reduce((a, g) => a + g.opp, 0),
    ncaaWins: ncaa.filter((g) => g.result === 'W').length,
    ncaaLosses: ncaa.filter((g) => g.result === 'L').length,
    // Derived from the actual championship-game result rather than the prose in
    // `conferenceFinish`, whose wording varies from season to season.
    secTourneyTitles: secTournamentTitles.length,
    ncaaAppearances: seasons.filter((s) => s.games.some((g) => g.phase === 'NCAA Tournament')).length,
    sweet16s: seasonsReaching('Sweet 16').length,
    eliteEights: seasonsReaching('Elite Eight').length,
    finalFours: seasonsReaching('Final Four').length,
    titles: postseasonPaths.filter((path) => path.titleWon).length,
  };
}
