import { describe, expect, it, vi } from 'vitest';
import {
  apRank,
  gameDate,
  heightToInches,
  heightLabel,
  ordinal,
  percent,
  record,
  seasonLabel,
  signed,
  signedInt,
  stat,
  winPct,
  winPctNumber,
} from '@/lib/format';
import { buildHash, parseHash, playerHash, seasonHash, VIEWS } from '@/lib/router';
import { search, searchIndex } from '@/lib/search';
import {
  NCAA_ROUNDS,
  pathFor,
  postseasonPaths,
  secTournamentTitles,
  seasonsReaching,
} from '@/lib/tournament';
import { isStringArray, readJson, writeJson, __resetStorageProbe } from '@/lib/storage';

describe('format', () => {
  it('formats statistics to one decimal and handles missing values', () => {
    expect(stat(13.24)).toBe('13.2');
    expect(stat(7)).toBe('7.0');
    expect(stat(null)).toBe('—');
    expect(stat(undefined)).toBe('—');
    expect(stat(Number.NaN)).toBe('—');
  });

  it('uses a true minus sign for negatives', () => {
    expect(signed(4.2)).toBe('+4.2');
    expect(signed(-4.2)).toBe('−4.2');
    expect(signedInt(-9)).toBe('−9');
    expect(signedInt(9)).toBe('+9');
  });

  it('formats records with an en dash and percentages without a leading zero', () => {
    expect(record([32, 4])).toBe('32–4');
    expect(winPct(32, 4)).toBe('.889');
    expect(winPct(0, 0)).toBe('.000');
    expect(winPctNumber(0, 0)).toBe(0);
    expect(percent(0.154)).toBe('15.4%');
  });

  it('renders season ids with an en dash', () => {
    expect(seasonLabel('2002-03')).toBe('2002–03');
  });

  it('parses game dates as UTC so the day never shifts', () => {
    expect(gameDate('1997-11-20')).toBe('Nov 20, 1997');
    expect(gameDate('2003-03-30')).toBe('Mar 30, 2003');
    expect(gameDate('not-a-date')).toBe('not-a-date');
  });

  it('shows unranked for a null AP position', () => {
    expect(apRank(5)).toBe('#5');
    expect(apRank(null)).toBe('UR');
    expect(apRank(undefined)).toBe('UR');
  });

  it('produces correct ordinals including the teens', () => {
    expect(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']).toEqual([
      ordinal(1),
      ordinal(2),
      ordinal(3),
      ordinal(4),
      ordinal(11),
      ordinal(12),
      ordinal(13),
      ordinal(21),
      ordinal(22),
    ]);
  });

  it('converts and labels heights', () => {
    expect(heightToInches('6-5')).toBe(77);
    expect(heightToInches('7-3')).toBe(87);
    expect(heightToInches('bad')).toBe(0);
    expect(heightLabel('6-5')).toBe('6′ 5″');
  });
});

describe('router', () => {
  it('parses a full season route', () => {
    const route = parseHash('#/season/2002-03/roster?sort=ppg&dir=asc');
    expect(route.seasonId).toBe('2002-03');
    expect(route.view).toBe('roster');
    expect(route.params.get('sort')).toBe('ppg');
    expect(route.params.get('dir')).toBe('asc');
  });

  it('falls back to the first season and overview for unknown input', () => {
    for (const hash of ['', '#', '#/', '#/nonsense', '#/season/1899-00/nope']) {
      const route = parseHash(hash);
      expect(route.seasonId, hash).toBe('1997-98');
      expect(VIEWS).toContain(route.view);
    }
    expect(parseHash('#/season/2002-03/not-a-view').view).toBe('overview');
  });

  it('routes a player deep link into the roster view with the dialog open', () => {
    const route = parseHash('#/player/rajon-rondo');
    expect(route.view).toBe('roster');
    expect(route.playerId).toBe('rajon-rondo');
  });

  it('decodes an opponent deep link with spaces', () => {
    expect(parseHash('#/opponent/North%20Carolina').opponent).toBe('North Carolina');
  });

  it('round-trips a route through buildHash', () => {
    const original = parseHash('#/season/2004-05/schedule?filter=Wins');
    const rebuilt = parseHash(
      buildHash({ seasonId: original.seasonId, view: original.view, params: original.params }),
    );
    expect(rebuilt.seasonId).toBe('2004-05');
    expect(rebuilt.view).toBe('schedule');
    expect(rebuilt.params.get('filter')).toBe('Wins');
  });

  it('drops the player parameter when no player is open', () => {
    const params = new URLSearchParams('player=rajon-rondo&sort=ppg');
    const hash = buildHash({ seasonId: '2005-06', view: 'roster', params, playerId: null });
    expect(hash).not.toContain('player=');
    expect(hash).toContain('sort=ppg');
  });

  it('escapes ids in generated hashes', () => {
    expect(playerHash('rajon-rondo')).toBe('#/player/rajon-rondo');
    expect(seasonHash('2002-03', 'era')).toBe('#/season/2002-03/era');
  });
});

describe('search', () => {
  it('indexes players, seasons, games, opponents and views', () => {
    const kinds = new Set(searchIndex.map((doc) => doc.kind));
    expect(kinds).toEqual(new Set(['player', 'season', 'game', 'opponent', 'view']));
  });

  it('ranks an exact player name first', () => {
    const results = search('Rajon Rondo');
    expect(results[0].kind).toBe('player');
    expect(results[0].title).toBe('Rajon Rondo');
  });

  it('finds a season by year', () => {
    const results = search('2002-03', { kinds: ['season'] });
    expect(results[0].title).toContain('2002–03');
  });

  it('finds a player by hometown', () => {
    const results = search('Oak Hill', { kinds: ['player'] });
    expect(results.length).toBeGreaterThan(0);
  });

  it('narrows as tokens are added rather than widening', () => {
    const broad = search('a', { limit: 100 });
    const narrow = search('rondo louisville', { limit: 100 });
    expect(narrow.length).toBeLessThan(broad.length);
    expect(narrow.length).toBeGreaterThan(0);
  });

  it('returns nothing for an empty or unmatched query', () => {
    expect(search('')).toEqual([]);
    expect(search('   ')).toEqual([]);
    expect(search('zzzzqqqq')).toEqual([]);
  });

  it('respects the result limit', () => {
    expect(search('kentucky', { limit: 3 }).length).toBeLessThanOrEqual(3);
  });

  it('produces a routable hash for every result', () => {
    for (const result of search('duke', { limit: 10 })) {
      expect(result.route.startsWith('#/')).toBe(true);
    }
  });
});

describe('tournament normalisation', () => {
  it('normalises inconsistent round wording across seasons', () => {
    // 1997-98 stores "NCAA First Round"; 2002-03 stores "Round of 64".
    expect(pathFor('1997-98')!.ncaa[0].round).toBe('Round of 64');
    expect(pathFor('2002-03')!.ncaa[0].round).toBe('Round of 64');
    expect(pathFor('1997-98')!.ncaa.at(-1)!.round).toBe('National Championship');
    expect(pathFor('2002-03')!.ncaa.at(-1)!.round).toBe('Elite Eight');
  });

  it('orders every NCAA path by canonical round', () => {
    for (const path of postseasonPaths) {
      const indices = path.ncaa.map((node) => NCAA_ROUNDS.indexOf(node.round));
      expect(indices, path.seasonId).toEqual([...indices].sort((a, b) => a - b));
    }
  });

  it('identifies 1997-98 as the only national title', () => {
    const champions = postseasonPaths.filter((path) => path.titleWon);
    expect(champions.map((p) => p.seasonId)).toEqual(['1997-98']);
    expect(champions[0].eliminationGame).toBeNull();
  });

  it('derives five SEC Tournament titles from the championship-game results', () => {
    expect(secTournamentTitles).toEqual(['1997-98', '1998-99', '2000-01', '2002-03', '2003-04']);
  });

  it('records 2004-05 as an SEC Tournament runner-up, not a champion', () => {
    const path = pathFor('2004-05')!;
    expect(path.secTitle).toBe(false);
    expect(path.secRunnerUp).toBe(true);
  });

  it('counts a round as reached even when the game was lost', () => {
    // 2002-03 lost in the Elite Eight, so it reached the Elite Eight.
    expect(seasonsReaching('Elite Eight')).toContain('2002-03');
    expect(seasonsReaching('Final Four')).not.toContain('2002-03');
    expect(seasonsReaching('Round of 64')).toHaveLength(10);
  });

  it('names an elimination game for every season except the champions', () => {
    for (const path of postseasonPaths) {
      if (path.titleWon) expect(path.eliminationGame).toBeNull();
      else expect(path.eliminationGame, path.seasonId).not.toBeNull();
    }
  });
});

describe('storage', () => {
  it('round-trips a value', () => {
    expect(writeJson('bba:test', { a: 1 })).toBe(true);
    expect(readJson('bba:test', null)).toEqual({ a: 1 });
  });

  it('returns the fallback for a missing key', () => {
    expect(readJson('bba:missing', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for corrupted JSON rather than throwing', () => {
    window.localStorage.setItem('bba:corrupt', '{not json');
    expect(readJson('bba:corrupt', [])).toEqual([]);
  });

  it('rejects a stored value that fails its validator', () => {
    window.localStorage.setItem('bba:wrongshape', JSON.stringify([1, 2, 3]));
    expect(readJson('bba:wrongshape', ['ok'], isStringArray)).toEqual(['ok']);
  });

  it('degrades gracefully when storage throws', () => {
    // jsdom's Storage is a Proxy, so assigning to `localStorage.setItem` would store a
    // key rather than replace the method — the prototype has to be spied instead.
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    __resetStorageProbe();

    expect(writeJson('bba:nope', 1)).toBe(false);
    expect(readJson('bba:nope', 'fallback')).toBe('fallback');

    spy.mockRestore();
    __resetStorageProbe();
  });
});
