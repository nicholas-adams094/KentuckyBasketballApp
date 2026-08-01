import { describe, expect, it } from 'vitest';
import { getSeason, playerSeason, seasons, type PlayerSeasonEntry } from '@/lib/archive';
import {
  analyzeSeason,
  BOX_KEYS,
  careerSummary,
  decadeTotals,
  eraDistributions,
  eraPercentile,
  eraZScore,
  evaluateLineup,
  impactRating,
  leaderboard,
  longestStreak,
  multiSeasonCareers,
  opponentRecords,
  optimizeLineup,
  per40,
  positionFit,
  recordTrace,
  rotationSeasons,
  seasonLeader,
  seasonSplits,
  streaks,
  teamShare,
} from '@/lib/analytics';
import { POSITIONS } from '@/types/archive';

const entry = (id: string, seasonId: string): PlayerSeasonEntry => {
  const found = playerSeason(id, seasonId);
  if (!found) throw new Error(`fixture missing: ${id} @ ${seasonId}`);
  return found;
};

describe('per-40 normalisation', () => {
  it('scales a rate by minutes played', () => {
    expect(per40(10, 20)).toBeCloseTo(20, 5);
    expect(per40(20, 40)).toBeCloseTo(20, 5);
  });

  it('suppresses the extrapolation below four minutes per game', () => {
    // A 2-point average in 1.5 minutes would extrapolate to 53 per 40 — meaningless.
    expect(per40(2, 1.5)).toBeNull();
    expect(per40(2, 3.9)).toBeNull();
    expect(per40(2, 4)).not.toBeNull();
  });
});

describe('era-relative scoring', () => {
  it('builds its baseline only from rotation player-seasons', () => {
    expect(rotationSeasons.length).toBeGreaterThan(50);
    expect(rotationSeasons.every((e) => e.mpg >= 8 && e.gp > 0)).toBe(true);
    for (const key of BOX_KEYS) {
      expect(eraDistributions[key].count).toBe(rotationSeasons.length);
      expect(eraDistributions[key].stdDev).toBeGreaterThan(0);
    }
  });

  it('inverts turnovers so that positive always means better', () => {
    const heavy = [...rotationSeasons].sort((a, b) => b.tov - a.tov)[0];
    const light = [...rotationSeasons].sort((a, b) => a.tov - b.tov)[0];
    expect(eraZScore(heavy, 'tov')).toBeLessThan(0);
    expect(eraZScore(light, 'tov')).toBeGreaterThan(0);
  });

  it('puts the decade scoring leader in the top percentile', () => {
    const top = [...rotationSeasons].sort((a, b) => b.ppg - a.ppg)[0];
    expect(eraPercentile(top, 'ppg')).toBeGreaterThan(0.95);
  });

  it('keeps the impact rating inside its stated 1–99 range', () => {
    for (const line of rotationSeasons) {
      const rating = impactRating(line);
      expect(rating).toBeGreaterThanOrEqual(1);
      expect(rating).toBeLessThanOrEqual(99);
    }
  });

  it('rates a star season above a deep-bench season', () => {
    const star = impactRating(entry('keith-bogans', '2002-03'));
    const bench = [...rotationSeasons].sort((a, b) => a.mpg - b.mpg)[0];
    expect(star).toBeGreaterThan(impactRating(bench));
  });

  it('returns zero for a player who did not play', () => {
    const dnp = seasons
      .flatMap((season) => season.roster.map((line) => ({ line, seasonId: season.id })))
      .find(({ line }) => line.gp === 0);
    if (dnp) {
      expect(impactRating(entry(dnp.line.id, dnp.seasonId))).toBe(0);
    }
  });
});

describe('team share', () => {
  it('never exceeds the whole team and sums sensibly', () => {
    for (const season of seasons) {
      const total = season.roster
        .filter((line) => line.gp > 0)
        .reduce((sum, line) => sum + teamShare(entry(line.id, season.id), 'ppg'), 0);
      // Every player's share of scoring must add up to the whole team.
      expect(total).toBeCloseTo(1, 5);
    }
  });

  it('gives the leading scorer the largest share', () => {
    const season = getSeason('2002-03')!;
    const shares = season.roster
      .filter((line) => line.gp > 0)
      .map((line) => ({ id: line.id, share: teamShare(entry(line.id, season.id), 'ppg') }))
      .sort((a, b) => b.share - a.share);
    expect(shares[0].id).toBe(seasonLeader('2002-03', 'ppg')?.id);
  });
});

describe('season analysis', () => {
  it('splits every game into at least one venue bucket', () => {
    for (const season of seasons) {
      const splits = seasonSplits(season);
      const venue = splits.filter((s) => ['Home', 'Away', 'Neutral'].includes(s.label));
      expect(venue.reduce((sum, s) => sum + s.games, 0)).toBe(season.games.length);
    }
  });

  it('accounts for the named early-season events as regular-season games', () => {
    // 2002-03 played three Maui Invitational games; they belong to the non-conference
    // record, not the postseason.
    const splits = seasonSplits(getSeason('2002-03')!);
    const maui = splits.find((s) => s.label === 'Early-season tournament');
    const nonConf = splits.find((s) => s.label === 'Non-conference');
    expect(maui?.games).toBe(3);
    expect(nonConf!.games).toBeGreaterThanOrEqual(3);

    const sec = splits.find((s) => s.label === 'SEC regular season')!;
    const secT = splits.find((s) => s.label === 'SEC Tournament')!;
    const ncaa = splits.find((s) => s.label === 'NCAA Tournament')!;
    // Non-conference + SEC + both tournaments must cover every game exactly once.
    expect(nonConf!.games + sec.games + secT.games + ncaa.games).toBe(36);
  });

  it('finds the longest streaks', () => {
    const results = [
      { result: 'W' as const },
      { result: 'W' as const },
      { result: 'L' as const },
      { result: 'W' as const },
      { result: 'W' as const },
      { result: 'W' as const },
    ];
    expect(streaks(results)).toHaveLength(3);
    expect(longestStreak(results, 'W')).toMatchObject({ length: 3, startIndex: 3, endIndex: 5 });
    expect(longestStreak(results, 'L')).toMatchObject({ length: 1 });
    expect(longestStreak([], 'W')).toBeNull();
  });

  it('traces a running differential that ends at wins minus losses', () => {
    for (const season of seasons) {
      const trace = recordTrace(analyzeSeason(season).trace.length ? [] : []);
      expect(trace).toEqual([]);
      const analysis = analyzeSeason(season);
      const last = analysis.trace.at(-1)!;
      expect(last.wins).toBe(season.record[0]);
      expect(last.losses).toBe(season.record[1]);
      expect(last.diff).toBe(season.record[0] - season.record[1]);
    }
  });

  it('ranks 2002-03 as the best margin season and 1997-98 by win rate', () => {
    expect(analyzeSeason(getSeason('2002-03')!).ranks.margin).toBeLessThanOrEqual(2);
    expect(analyzeSeason(getSeason('1997-98')!).ranks.winPct).toBe(1);
  });

  it('identifies a biggest win with a positive margin', () => {
    for (const season of seasons) {
      const analysis = analyzeSeason(season);
      expect(analysis.biggestWin!.margin).toBeGreaterThan(0);
      expect(analysis.toughestLoss!.margin).toBeLessThan(0);
    }
  });
});

describe('leaderboards', () => {
  it('sorts descending and applies a minutes floor for decade boards', () => {
    const board = leaderboard('ppg', { limit: 5 });
    expect(board).toHaveLength(5);
    expect(board.map((row) => row.value)).toEqual([...board.map((r) => r.value)].sort((a, b) => b - a));
    expect(board.every((row) => row.entry.mpg >= 8)).toBe(true);
    expect(board.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('sorts turnovers ascending because fewer is better', () => {
    const board = leaderboard('tov', { limit: 5 });
    expect(board.map((row) => row.value)).toEqual([...board.map((r) => r.value)].sort((a, b) => a - b));
  });

  it('drops the minutes floor for single-season leaders', () => {
    for (const season of seasons) {
      expect(seasonLeader(season.id, 'ppg'), season.id).toBeDefined();
    }
  });
});

describe('opponent records', () => {
  it('accounts for every game exactly once', () => {
    const rivals = opponentRecords();
    const total = rivals.reduce((sum, rival) => sum + rival.games.length, 0);
    expect(total).toBe(346);
    for (const rival of rivals) {
      expect(rival.wins + rival.losses).toBe(rival.games.length);
    }
  });

  it('orders by number of meetings', () => {
    const rivals = opponentRecords();
    const counts = rivals.map((r) => r.games.length);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe('careers', () => {
  it('computes minutes-weighted career averages', () => {
    const summary = careerSummary('tayshaun-prince')!;
    const played = summary.seasons.filter((s) => s.gp > 0);
    const manual =
      played.reduce((sum, s) => sum + s.ppg * s.gp, 0) / played.reduce((sum, s) => sum + s.gp, 0);
    expect(summary.averages.ppg).toBeCloseTo(manual, 6);
  });

  it('returns null for an unknown player', () => {
    expect(careerSummary('nobody')).toBeNull();
  });

  it('only lists genuinely multi-season players', () => {
    for (const career of multiSeasonCareers()) {
      expect(career.seasons.length).toBeGreaterThan(1);
    }
  });
});

describe('lineup evaluation', () => {
  it('scores the documented starters as a complete, legal five', () => {
    for (const season of seasons) {
      const result = evaluateLineup(season.starters, season.id);
      expect(result.players, season.id).toHaveLength(5);
      expect(result.duplicates).toBe(0);
      expect(result.score).toBeGreaterThan(5);
      expect(result.score).toBeLessThanOrEqual(99);
      expect(result.verdict).not.toMatch(/Incomplete|not a legal/i);
    }
  });

  it('penalises a duplicated player and says why', () => {
    const season = getSeason('2002-03')!;
    const duplicated = { ...season.starters, SG: season.starters.PG };
    const clean = evaluateLineup(season.starters, season.id);
    const dirty = evaluateLineup(duplicated, season.id);
    expect(dirty.duplicates).toBeGreaterThan(0);
    expect(dirty.score).toBeLessThan(clean.score);
    expect(dirty.verdict).toMatch(/not a legal five/i);
  });

  it('flags an incomplete five', () => {
    const season = getSeason('2002-03')!;
    const partial = { PG: season.starters.PG, SG: season.starters.SG };
    expect(evaluateLineup(partial, season.id).verdict).toBe('Incomplete lineup');
  });

  it('ignores ids that are not on that season roster', () => {
    const result = evaluateLineup({ PG: 'rajon-rondo' }, '1997-98');
    expect(result.players).toHaveLength(0);
  });

  it('rates positional fit highest for a natural match', () => {
    expect(positionFit('PG', 'PG')).toBe(1);
    expect(positionFit('PG', 'G')).toBeGreaterThan(0.5);
    expect(positionFit('C', 'PG')).toBeLessThan(0.5);
  });

  it('always returns five distinct players from the optimizer', () => {
    for (const season of seasons) {
      for (const objective of ['offense', 'defense', 'passing', 'balanced'] as const) {
        const five = optimizeLineup(season.id, objective);
        const ids = POSITIONS.map((slot) => five[slot]).filter(Boolean);
        expect(ids, `${season.id}/${objective}`).toHaveLength(5);
        expect(new Set(ids).size).toBe(5);
      }
    }
  });

  it('returns the documented starters verbatim for the documented preset', () => {
    const season = getSeason('2004-05')!;
    expect(optimizeLineup(season.id, 'documented')).toEqual(season.starters);
  });

  it('builds a higher-scoring five for the offense objective than the defense one', () => {
    const offense = evaluateLineup(optimizeLineup('2002-03', 'offense'), '2002-03');
    const defense = evaluateLineup(optimizeLineup('2002-03', 'defense'), '2002-03');
    expect(offense.totals.ppg).toBeGreaterThan(defense.totals.ppg);
    expect(defense.totals.spg + defense.totals.bpg).toBeGreaterThan(0);
  });
});

describe('decade totals', () => {
  it('derives the postseason record from the game log', () => {
    const totals = decadeTotals();
    expect(totals.games).toBe(346);
    expect(totals.wins).toBe(263);
    expect(totals.losses).toBe(83);
    expect(totals.ncaaWins).toBe(23);
    expect(totals.ncaaLosses).toBe(9);
    expect(totals.ncaaAppearances).toBe(10);
    expect(totals.titles).toBe(1);
    // Five SEC Tournament championships, derived from the championship-game results
    // rather than the season's prose summary.
    expect(totals.secTourneyTitles).toBe(5);
  });

  it('nests the tournament depth counts correctly', () => {
    const totals = decadeTotals();
    expect(totals.sweet16s).toBeGreaterThanOrEqual(totals.eliteEights);
    expect(totals.eliteEights).toBeGreaterThanOrEqual(totals.finalFours);
    expect(totals.finalFours).toBeGreaterThanOrEqual(totals.titles);
  });
});
