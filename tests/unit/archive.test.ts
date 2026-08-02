import { describe, expect, it } from 'vitest';
import {
  allGames,
  allPlayerSeasons,
  bestSeasonOf,
  careerOf,
  eraNcaaRecord,
  eraRecord,
  eraSecRecord,
  gameCount,
  getSeason,
  getSeasonIndex,
  imageUrl,
  photoItem,
  playedSeasons,
  playerImageUrl,
  playerSeason,
  playerSurname,
  profileCount,
  rosterEntryCount,
  seasonGames,
  seasons,
} from '@/lib/archive';

/**
 * These assertions pin the archive's headline facts. If a data edit changes any of
 * them, that is either a sourced correction (and this test is updated alongside
 * docs/DATA_CHANGELOG.md) or an accident these tests are here to catch.
 */
describe('archive shape', () => {
  it('holds exactly the ten Tubby Smith seasons in chronological order', () => {
    expect(seasons).toHaveLength(10);
    expect(seasons[0].id).toBe('1997-98');
    expect(seasons.at(-1)?.id).toBe('2006-07');
    const ids = seasons.map((s) => s.id);
    expect([...ids].sort()).toEqual(ids);
  });

  it('matches the documented aggregate counts', () => {
    expect(profileCount).toBe(58);
    expect(rosterEntryCount).toBe(145);
    expect(gameCount).toBe(346);
  });

  it('reconciles the era record to 263-83 overall and 120-40 in SEC play', () => {
    expect(eraRecord).toEqual([263, 83]);
    expect(eraSecRecord).toEqual([120, 40]);
  });

  it('derives a 23-9 NCAA Tournament record from the game log', () => {
    expect(eraNcaaRecord).toEqual([23, 9]);
  });

  it('maps every roster entry to a profile', () => {
    for (const entry of allPlayerSeasons) {
      expect(entry.profile, `${entry.id} in ${entry.seasonId}`).toBeDefined();
      expect(entry.profile.name.length).toBeGreaterThan(0);
    }
  });

  it('places every documented starter on that season roster', () => {
    for (const season of seasons) {
      const rosterIds = new Set(season.roster.map((line) => line.id));
      for (const [position, playerId] of Object.entries(season.starters)) {
        expect(rosterIds.has(playerId), `${season.id} ${position} ${playerId}`).toBe(true);
      }
    }
  });

  it('gives each game a season-scoped number in schedule order', () => {
    for (const season of seasons) {
      const games = seasonGames(season.id);
      expect(games).toHaveLength(season.games.length);
      expect(games.map((g) => g.gameNumber)).toEqual(games.map((_, i) => i + 1));
    }
  });

  it('keeps every game margin consistent with its score', () => {
    for (const game of allGames) {
      expect(game.margin).toBe(game.uk - game.opp);
      expect(game.result).toBe(game.uk > game.opp ? 'W' : 'L');
    }
  });
});

describe('lookups', () => {
  it('resolves seasons by id and returns -1 for unknown ids', () => {
    expect(getSeason('2002-03')?.record).toEqual([32, 4]);
    expect(getSeason('1899-00')).toBeUndefined();
    expect(getSeasonIndex('1997-98')).toBe(0);
    expect(getSeasonIndex('nope')).toBe(-1);
  });

  it('returns a career in chronological order', () => {
    const career = careerOf('tayshaun-prince');
    expect(career.length).toBeGreaterThan(1);
    expect(career.map((entry) => entry.seasonId)).toEqual([...career.map((e) => e.seasonId)].sort());
  });

  it('finds a specific player-season and nothing for a season they missed', () => {
    expect(playerSeason('rajon-rondo', '2005-06')?.ppg).toBeGreaterThan(0);
    expect(playerSeason('rajon-rondo', '1997-98')).toBeUndefined();
  });

  it('picks a played season as the representative best season', () => {
    const best = bestSeasonOf('keith-bogans');
    expect(best).toBeDefined();
    expect(best!.gp).toBeGreaterThan(0);
  });

  it('extracts surnames for dense table cells', () => {
    expect(playerSurname('rajon-rondo')).toBe('Rondo');
    expect(playerSurname('not-a-player')).toBe('not-a-player');
  });

  it('excludes zero-game entries from the played set', () => {
    expect(playedSeasons.every((entry) => entry.gp > 0)).toBe(true);
    expect(playedSeasons.length).toBeLessThan(allPlayerSeasons.length);
  });
});

describe('images', () => {
  it('resolves a URL for every profile image key', () => {
    for (const entry of allPlayerSeasons) {
      expect(playerImageUrl(entry.id), entry.id).toBeTruthy();
    }
  });

  it('has a manifest entry for every team image, and no URL while it is withheld', () => {
    // Team photographs are withheld from publication pending replacements. The entries
    // and their sources remain; only the derivative is gone, and imageUrl returning
    // undefined is precisely what drives the empty frame in the interface.
    for (const season of seasons) {
      const item = photoItem(season.teamImage);
      expect(item, season.id).toBeDefined();
      if (item!.withheld) {
        expect(imageUrl(season.teamImage), season.id).toBeUndefined();
        expect(item!.processed_path, season.id).toBeUndefined();
        expect(item!.original_path, season.id).toBeTruthy();
      } else {
        expect(imageUrl(season.teamImage), season.id).toBeTruthy();
      }
    }
  });

  it('returns undefined for an unknown key rather than throwing', () => {
    expect(imageUrl('does_not_exist')).toBeUndefined();
    expect(imageUrl(undefined)).toBeUndefined();
  });
});
