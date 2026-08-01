#!/usr/bin/env node
/**
 * Historical data integrity gate.
 *
 * Runs before any build or deploy. Errors fail the process; warnings are reported but
 * do not block, because some of them (low-resolution originals, unreviewed rights) are
 * known open items tracked in docs/, not defects in the data itself.
 *
 * The invariants here encode the archive's editorial rules: every roster line maps to a
 * profile, every documented starter is on the roster, records reconcile with the game
 * log, and the three competition phases stay distinct.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

const archive = read('src/data/archive.json');
const manifest = read('src/data/photo-manifest.json');

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const EXPECTED = {
  seasons: 10,
  profiles: 58,
  rosterEntries: 145,
  games: 346,
  firstSeason: '1997-98',
  lastSeason: '2006-07',
};

const NUMERIC_FIELDS = ['gp', 'mpg', 'ppg', 'rpg', 'apg', 'spg', 'bpg', 'tov'];

// Kentucky played eight games in exempt early-season events, which the archive records
// under the event name rather than as plain "Regular Season". They count toward the
// regular-season record and are always non-conference. Keep this list in sync with
// REGULAR_SEASON_PHASES / POSTSEASON_PHASES in src/types/archive.ts.
const REGULAR_SEASON_PHASES = new Set(['Regular Season', 'Maui Invitational', 'Guardians Classic']);
const POSTSEASON_PHASES = new Set(['SEC Tournament', 'NCAA Tournament']);
const PHASES = new Set([...REGULAR_SEASON_PHASES, ...POSTSEASON_PHASES]);
const EXEMPT_TOURNAMENT_PHASES = new Set(['Maui Invitational', 'Guardians Classic']);

const LOCATIONS = new Set(['H', 'A', 'N']);
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

const profileIds = new Set(Object.keys(archive.profiles));
const manifestKeys = new Set(manifest.items.map((item) => item.image_key));

// --- Shape ------------------------------------------------------------------

if (!Array.isArray(archive.seasons)) fail('archive.seasons is not an array');
if (archive.seasons.length !== EXPECTED.seasons) {
  fail(`Expected ${EXPECTED.seasons} seasons; found ${archive.seasons.length}`);
}
if (profileIds.size !== EXPECTED.profiles) {
  warn(`Expected ${EXPECTED.profiles} profiles; found ${profileIds.size}`);
}
if (archive.seasons[0]?.id !== EXPECTED.firstSeason) {
  fail(`First season should be ${EXPECTED.firstSeason}; found ${archive.seasons[0]?.id}`);
}
if (archive.seasons.at(-1)?.id !== EXPECTED.lastSeason) {
  fail(`Last season should be ${EXPECTED.lastSeason}; found ${archive.seasons.at(-1)?.id}`);
}

// Seasons must be in chronological order — the season rail and all "previous/next"
// affordances depend on array order rather than re-sorting.
for (let i = 1; i < archive.seasons.length; i += 1) {
  if (archive.seasons[i].id <= archive.seasons[i - 1].id) {
    fail(`Seasons are out of chronological order at index ${i}: ${archive.seasons[i].id}`);
  }
}

// --- Per-season -------------------------------------------------------------

const seenSeasonIds = new Set();
const rosterUsage = new Map();
let totalGames = 0;
let totalRosterEntries = 0;
let secRegularWins = 0;
let secRegularLosses = 0;

for (const season of archive.seasons) {
  const where = season.id;

  if (seenSeasonIds.has(season.id)) fail(`Duplicate season id: ${season.id}`);
  seenSeasonIds.add(season.id);

  if (!/^\d{4}-\d{2}$/.test(season.id)) fail(`${where}: malformed season id`);
  if (season.coach !== 'Tubby Smith') warn(`${where}: coach is "${season.coach}"`);

  const [wins, losses] = season.record;
  const expectedGames = wins + losses;

  if (season.games.length !== expectedGames) {
    fail(`${where}: ${season.games.length} game records but the record totals ${expectedGames}`);
  }

  const gameWins = season.games.filter((g) => g.result === 'W').length;
  const gameLosses = season.games.filter((g) => g.result === 'L').length;
  if (gameWins !== wins || gameLosses !== losses) {
    fail(`${where}: game log is ${gameWins}-${gameLosses} but the stated record is ${wins}-${losses}`);
  }

  // --- Games ---
  let previousDate = '';
  for (const [index, game] of season.games.entries()) {
    const at = `${where} game ${index + 1} (${game.opponent})`;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(game.date)) fail(`${at}: malformed date "${game.date}"`);
    if (game.date < previousDate) fail(`${at}: date ${game.date} is earlier than the previous game`);
    previousDate = game.date;

    if (!LOCATIONS.has(game.loc)) fail(`${at}: invalid location "${game.loc}"`);
    if (game.result !== 'W' && game.result !== 'L') fail(`${at}: invalid result "${game.result}"`);
    if (!PHASES.has(game.phase)) fail(`${at}: invalid phase "${game.phase}"`);

    if (!Number.isInteger(game.uk) || !Number.isInteger(game.opp)) {
      fail(`${at}: non-integer score ${game.uk}-${game.opp}`);
    }
    if (game.margin !== game.uk - game.opp) {
      fail(`${at}: margin ${game.margin} does not equal ${game.uk} − ${game.opp}`);
    }
    // The stored result must agree with the score. A tie is impossible in basketball.
    if (game.uk === game.opp) fail(`${at}: tied score ${game.uk}-${game.opp}`);
    const impliedResult = game.uk > game.opp ? 'W' : 'L';
    if (game.result !== impliedResult) {
      fail(`${at}: result "${game.result}" contradicts the score ${game.uk}-${game.opp}`);
    }

    // Phase and conference flags must stay coherent: postseason games and exempt
    // early-season events are never part of the SEC regular-season record.
    if (POSTSEASON_PHASES.has(game.phase) && game.sec === true) {
      fail(`${at}: postseason phase "${game.phase}" must not be flagged as an SEC regular-season game`);
    }
    if (EXEMPT_TOURNAMENT_PHASES.has(game.phase)) {
      if (game.sec === true) fail(`${at}: "${game.phase}" is a non-conference event but is SEC-flagged`);
      if (game.loc !== 'N') {
        warn(`${at}: "${game.phase}" games are normally at a neutral site; this one is "${game.loc}"`);
      }
    }
    if (REGULAR_SEASON_PHASES.has(game.phase) && game.sec) {
      if (game.result === 'W') secRegularWins += 1;
      else secRegularLosses += 1;
    }
  }

  // SEC regular-season record must reconcile with the flagged games.
  const [secW, secL] = season.secRecord;
  const isSecRegular = (g) => g.sec && REGULAR_SEASON_PHASES.has(g.phase);
  const flaggedW = season.games.filter((g) => isSecRegular(g) && g.result === 'W').length;
  const flaggedL = season.games.filter((g) => isSecRegular(g) && g.result === 'L').length;
  if (flaggedW !== secW || flaggedL !== secL) {
    fail(`${where}: SEC record ${secW}-${secL} does not match the ${flaggedW}-${flaggedL} flagged SEC regular-season games`);
  }

  // --- Roster ---
  const rosterIds = new Set();
  for (const player of season.roster) {
    totalRosterEntries += 1;
    const at = `${where}/${player.id}`;

    if (!profileIds.has(player.id)) fail(`${at}: no matching profile`);
    if (rosterIds.has(player.id)) fail(`${at}: duplicate roster entry`);
    rosterIds.add(player.id);
    rosterUsage.set(player.id, (rosterUsage.get(player.id) ?? 0) + 1);

    for (const field of NUMERIC_FIELDS) {
      const value = player[field];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        fail(`${at}: invalid numeric field ${field} (${value})`);
      } else if (value < 0) {
        fail(`${at}: negative ${field} (${value})`);
      }
    }

    if (player.gp > season.games.length) {
      fail(`${at}: ${player.gp} games played exceeds the ${season.games.length} team games`);
    }
    if (player.mpg > 40) warn(`${at}: ${player.mpg} minutes per game exceeds regulation length`);
    if (player.gp === 0 && player.ppg > 0) {
      fail(`${at}: has statistics but zero games played`);
    }
    if (!Array.isArray(player.awards)) fail(`${at}: awards is not an array`);
  }

  // --- Documented starters and rotation ---
  for (const position of POSITIONS) {
    const starterId = season.starters?.[position];
    if (!starterId) {
      fail(`${where}: no documented starter at ${position}`);
      continue;
    }
    if (!rosterIds.has(starterId)) fail(`${where}: starter ${position}=${starterId} is not on the roster`);
  }
  const starterIds = Object.values(season.starters ?? {});
  if (new Set(starterIds).size !== starterIds.length) {
    fail(`${where}: the same player is listed at more than one starting position`);
  }

  for (const rotationId of season.rotation ?? []) {
    if (!rosterIds.has(rotationId)) fail(`${where}: rotation player ${rotationId} is not on the roster`);
    if (starterIds.includes(rotationId)) {
      warn(`${where}: ${rotationId} appears in both the starting five and the rotation list`);
    }
  }

  // --- Narrative fields ---
  if (!season.story?.trim()) fail(`${where}: empty season story`);
  if (!season.signature?.trim()) fail(`${where}: empty signature line`);
  if (!Array.isArray(season.highlights) || season.highlights.length === 0) {
    fail(`${where}: no highlights`);
  }
  for (const highlight of season.highlights ?? []) {
    if (!Array.isArray(highlight) || highlight.length !== 3) {
      fail(`${where}: malformed highlight ${JSON.stringify(highlight)}`);
    }
  }
  for (const award of season.awards ?? []) {
    if (!Array.isArray(award) || award.length !== 2) {
      fail(`${where}: malformed award ${JSON.stringify(award)}`);
    }
  }

  // --- Team image ---
  if (!manifestKeys.has(season.teamImage)) {
    fail(`${where}: team image key "${season.teamImage}" is not in the photo manifest`);
  }

  totalGames += season.games.length;
}

// --- Profiles ---------------------------------------------------------------

for (const [playerId, profile] of Object.entries(archive.profiles)) {
  if (!profile.name?.trim()) fail(`${playerId}: profile has no name`);
  if (!profile.bio?.trim()) fail(`${playerId}: profile has no biography`);
  if (!profile.image) fail(`${playerId}: profile has no image key`);
  else if (!manifestKeys.has(profile.image)) {
    fail(`${playerId}: image key "${profile.image}" is not in the photo manifest`);
  }
  if (profile.height && !/^\d+-\d+$/.test(profile.height)) {
    warn(`${playerId}: unexpected height format "${profile.height}"`);
  }
  if (!rosterUsage.has(playerId)) {
    warn(`${playerId}: profile is never used on any season roster`);
  }
}

// --- Sources ----------------------------------------------------------------

if (!Array.isArray(archive.sources) || archive.sources.length === 0) {
  fail('archive.sources is empty — the archive must cite its sources');
}
for (const source of archive.sources ?? []) {
  if (!source.name?.trim()) fail('A source entry has no name');
  if (!/^https?:\/\//.test(source.url ?? '')) fail(`Source "${source.name}" has no valid URL`);
}
for (const credit of archive.photoCredits ?? []) {
  if (!/^https?:\/\//.test(credit.url ?? '')) fail(`Photo credit "${credit.key}" has no valid URL`);
}

// --- Aggregates -------------------------------------------------------------

if (totalRosterEntries !== EXPECTED.rosterEntries) {
  warn(`Expected ${EXPECTED.rosterEntries} roster entries; found ${totalRosterEntries}`);
}
if (totalGames !== EXPECTED.games) {
  warn(`Expected ${EXPECTED.games} games; found ${totalGames}`);
}

const eraWins = archive.seasons.reduce((sum, s) => sum + s.record[0], 0);
const eraLosses = archive.seasons.reduce((sum, s) => sum + s.record[1], 0);
if (eraWins + eraLosses !== totalGames) {
  fail(`Aggregate record ${eraWins}-${eraLosses} does not sum to the ${totalGames} game records`);
}

const statedSecW = archive.seasons.reduce((sum, s) => sum + s.secRecord[0], 0);
const statedSecL = archive.seasons.reduce((sum, s) => sum + s.secRecord[1], 0);
if (statedSecW !== secRegularWins || statedSecL !== secRegularLosses) {
  fail(
    `Aggregate SEC record ${statedSecW}-${statedSecL} does not match the ${secRegularWins}-${secRegularLosses} flagged SEC regular-season games`,
  );
}

// --- Report -----------------------------------------------------------------

for (const warning of warnings) console.warn(`WARN  ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);

if (errors.length > 0) {
  console.error(`\nData validation FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  [
    'Data validation passed.',
    `  seasons          ${archive.seasons.length}`,
    `  profiles         ${profileIds.size}`,
    `  roster entries   ${totalRosterEntries}`,
    `  games            ${totalGames}`,
    `  era record       ${eraWins}-${eraLosses}`,
    `  SEC regular      ${secRegularWins}-${secRegularLosses}`,
    `  sources cited    ${archive.sources.length}`,
    warnings.length ? `  warnings         ${warnings.length}` : '  warnings         0',
  ].join('\n'),
);
