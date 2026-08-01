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
import { photoManifest, playerPortrait, profiles, seasons } from '@/lib/archive';

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


describe('portraits', () => {
  const players = photoManifest.items.filter((item) => item.kind === 'player');
  const crops = players.filter((item) => item.confidence === 'verified-team-photograph-crop');
  const notShown = players.filter(
    (item) => item.confidence === 'placeholder' || item.confidence === 'unverified-identification',
  );

  it('gives every player a portrait except the one that must not have one', () => {
    const missing = players.filter((item) => !item.portrait?.variants?.length).map((i) => i.image_key);
    expect(missing).toEqual(['uk_eric_allen']);
    expect(notShown.map((i) => i.image_key)).toEqual(missing);
  });

  it('prefers a re-sourced official headshot over a team-photograph crop', () => {
    // Six players whose only inherited image was a strip of a team photograph now have
    // the individual headshot the university itself published. Regression guard: none of
    // them may quietly fall back to the group crop.
    const resourced = players.filter((item) => item.photo_type === 'official-uk-headshot');
    expect(resourced.map((i) => i.image_key).sort()).toEqual([
      'uk_josh_carrier', 'uk_jp_blevins', 'uk_jules_camara',
      'uk_lukasz_obrzut', 'uk_michael_porter', 'uk_ramon_harris',
    ].sort());
    for (const item of resourced) {
      expect(item.confidence, item.image_key).toBe('verified-archival');
      expect(item.identified_by, item.image_key).toBe('official-university-publication');
      expect(item.original_path, item.image_key).toMatch(/^\/images\/players\/resourced\//);
      expect(item.source_url, item.image_key).toMatch(/^https:\/\/web\.archive\.org\//);
      expect(item.portrait?.derivation, item.image_key).toBe('official-uk-headshot');
      expect(item.jersey_number, item.image_key).toBeUndefined();
    }
  });

  it('says so when a re-sourced portrait post-dates the era the archive covers', () => {
    // Porter and Harris are shown with 2008-09 headshots. That is the correct player in a
    // Kentucky uniform, but it is not contemporary with the seasons it sits beside, and
    // the archive must not let a reader assume otherwise.
    const outOfEra = players.filter((i) => i.photo_season_note);
    expect(outOfEra.map((i) => i.image_key).sort()).toEqual(['uk_michael_porter', 'uk_ramon_harris']);
    for (const item of outOfEra) {
      expect(item.photo_note, item.image_key).toMatch(/after the Tubby Smith era/);
    }
  });

  it('never upscales a portrait beyond the upscaler’s own scale factor', () => {
    // Portraits go through a x4 generative model, so x4 is the ceiling: past it even
    // synthesised detail is only resampling, and the file claims resolution nothing in
    // the chain produced.
    for (const item of players) {
      const ceiling = item.portrait?.reconstruction?.scale ?? 2;
      for (const variant of item.portrait?.variants ?? []) {
        expect(variant.width, item.image_key).toBeLessThanOrEqual(
          item.portrait!.native_width * ceiling,
        );
      }
    }
  });

  it('records the generative upscale on every portrait it serves', () => {
    // An image that went through Real-ESRGAN with no record of it would read, in the
    // manifest and in the dialog, as an untouched archival photograph.
    for (const item of players) {
      if (!item.portrait?.variants?.length) continue;
      const recon = item.portrait.reconstruction;
      expect(recon, item.image_key).toBeDefined();
      expect(recon!.generative, item.image_key).toBe(true);
      expect(recon!.model, item.image_key).toMatch(/Real-ESRGAN/);
      expect(['reconstructed', 'fabricated'], item.image_key).toContain(recon!.class);
    }
  });

  it('marks a portrait fabricated exactly when its crop was too small to reconstruct', () => {
    // Below ~90px the model stops reconstructing a face and invents one. The boundary is
    // re-derived here rather than trusted, because it is the entire basis on which the
    // interface decides whether to call an image a photograph.
    for (const item of players) {
      if (!item.portrait?.variants?.length) continue;
      const fabricated = item.portrait.reconstruction?.class === 'fabricated';
      expect(fabricated, item.image_key).toBe(item.portrait.native_width < 90);
      if (fabricated) {
        expect(item.photo_type, item.image_key).toBe('ai-fabricated-face');
        expect(item.photo_note, item.image_key).toMatch(/NOT a photograph of this player/);
      }
    }
  });

  it('reconstructs the team photographs too, and says so', () => {
    for (const item of photoManifest.items.filter((i) => i.kind === 'team')) {
      expect(item.reconstruction?.generative, item.image_key).toBe(true);
      expect(item.reconstruction?.class, item.image_key).toBe('reconstructed');
      expect(item.photo_note, item.image_key).toMatch(/computed, not photographed/);
    }
  });

  it('keeps every variant on the 3:4 portrait frame', () => {
    for (const item of players) {
      for (const variant of item.portrait?.variants ?? []) {
        expect(Math.abs(variant.width / variant.height - 3 / 4), item.image_key).toBeLessThan(0.01);
      }
    }
  });

  it('crops each portrait from inside its own original', () => {
    for (const item of players) {
      const crop = item.portrait?.source_crop;
      if (!crop) continue;
      expect(crop.x, item.image_key).toBeGreaterThanOrEqual(0);
      expect(crop.y, item.image_key).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.w, item.image_key).toBeLessThanOrEqual(item.original_dimensions.width);
      expect(crop.y + crop.h, item.image_key).toBeLessThanOrEqual(item.original_dimensions.height);
      expect(crop.w, item.image_key).toBe(item.portrait!.native_width);
    }
  });

  it('identifies every team-photo crop by a jersey number the archive agrees with', () => {
    // A crop of a photograph containing several people is only defensible if the subject
    // can be identified, so each one is resolved by the number on the jersey. This is the
    // check that caught uk_ramon_harris: a #5 jersey filed under a player the archive
    // records as #22. Regression guard — an identification the roster contradicts must
    // never be shown as that player again.
    expect(crops.length).toBe(4);
    for (const item of crops) {
      expect(item.identified_by, item.image_key).toBe('jersey-number');
      const season = seasons.find((s) => s.id === item.identified_in_season);
      expect(season, item.image_key).toBeDefined();
      const line = season!.roster.find((entry) => entry.id === item.entity_id);
      expect(line, item.image_key).toBeDefined();
      expect(line!.number, item.image_key).toBe(item.jersey_number);
      // …and the number has to be unique that season, or it identifies nobody.
      expect(season!.roster.filter((e) => e.number === item.jersey_number).length, item.image_key).toBe(1);
    }
  });

  it('describes a crop as a crop, never as an archival headshot', () => {
    for (const item of crops) {
      expect(item.confidence, item.image_key).not.toBe('verified-archival');
      expect(item.photo_note, item.image_key).toMatch(/not an individual archival headshot/);
    }
  });

  it('renders a jersey card for anything whose subject is not verified', () => {
    // No portrait variants is what forces the fallback, so this asserts the mechanism
    // rather than the label.
    for (const item of notShown) {
      const playerId = Object.keys(profiles).find((id) => profiles[id]!.image === item.image_key);
      expect(playerId, item.image_key).toBeDefined();
      expect(playerPortrait(playerId!), item.image_key).toBeUndefined();
      expect(item.photo_note.length, item.image_key).toBeGreaterThan(40);
    }
  });

  it('builds a srcset whose largest entry is the src', () => {
    const portrait = playerPortrait('tayshaun-prince');
    expect(portrait).toBeDefined();
    const widths = portrait!.srcSet
      .split(', ')
      .map((entry) => Number(entry.split(' ')[1]!.replace('w', '')));
    expect(Math.max(...widths)).toBe(portrait!.width);
    expect(portrait!.srcSet).toContain(portrait!.src);
  });

  it('gives the palette a player id for every player result, so avatars stay small', () => {
    for (const doc of searchIndex.filter((d) => d.kind === 'player')) {
      expect(doc.playerId, doc.id).toBeDefined();
      expect(profiles[doc.playerId!], doc.id).toBeDefined();
    }
  });
});
