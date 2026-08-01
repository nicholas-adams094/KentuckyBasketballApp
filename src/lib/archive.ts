/**
 * Loads the archive once and builds every index the application needs.
 *
 * Everything here is computed at module load from immutable JSON, so views can treat
 * these lookups as constant. No component mutates archive data.
 */

import archiveJson from '@/data/archive.json';
import photoManifestJson from '@/data/photo-manifest.json';
import type {
  Archive,
  Game,
  ImageReconstruction,
  PhotoManifest,
  PhotoManifestItem,
  PlayerProfile,
  PlayerSeason,
  Season,
} from '@/types/archive';

export const archive = archiveJson as unknown as Archive;
export const photoManifest = photoManifestJson as unknown as PhotoManifest;

export const seasons: readonly Season[] = archive.seasons;
export const profiles: Readonly<Record<string, PlayerProfile>> = archive.profiles;

export const seasonIds: readonly string[] = seasons.map((s) => s.id);

const seasonById = new Map(seasons.map((season) => [season.id, season]));
const seasonIndexById = new Map(seasons.map((season, index) => [season.id, index]));

export function getSeason(id: string): Season | undefined {
  return seasonById.get(id);
}

export function getSeasonIndex(id: string): number {
  return seasonIndexById.get(id) ?? -1;
}

export function getProfile(playerId: string): PlayerProfile | undefined {
  return profiles[playerId];
}

/** Display name for a player id, falling back to the id so the UI never renders blank. */
export function playerName(playerId: string): string {
  return profiles[playerId]?.name ?? playerId;
}

/** Surname only — used in dense tables, depth charts and the court diagram. */
export function playerSurname(playerId: string): string {
  const name = playerName(playerId);
  const parts = name.split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

// ---------------------------------------------------------------------------
// Player-season index
// ---------------------------------------------------------------------------

/** A roster line enriched with the season it belongs to. */
export interface PlayerSeasonEntry extends PlayerSeason {
  seasonId: string;
  seasonIndex: number;
  profile: PlayerProfile;
}

function buildPlayerSeasons(): PlayerSeasonEntry[] {
  const out: PlayerSeasonEntry[] = [];
  seasons.forEach((season, seasonIndex) => {
    for (const line of season.roster) {
      const profile = profiles[line.id];
      if (!profile) continue; // validate-data.mjs fails the build if this ever happens
      out.push({ ...line, seasonId: season.id, seasonIndex, profile });
    }
  });
  return out;
}

/** Every roster line in the archive, in season order. */
export const allPlayerSeasons: readonly PlayerSeasonEntry[] = buildPlayerSeasons();

/** Roster lines with at least one game played — the basis for every leaderboard. */
export const playedSeasons: readonly PlayerSeasonEntry[] = allPlayerSeasons.filter((p) => p.gp > 0);

const seasonsByPlayer = new Map<string, PlayerSeasonEntry[]>();
for (const entry of allPlayerSeasons) {
  const list = seasonsByPlayer.get(entry.id);
  if (list) list.push(entry);
  else seasonsByPlayer.set(entry.id, [entry]);
}

/** Every season a player appears in, oldest first. */
export function careerOf(playerId: string): readonly PlayerSeasonEntry[] {
  return seasonsByPlayer.get(playerId) ?? [];
}

/** Player ids that actually appear on a roster, ordered by first appearance. */
export const rosteredPlayerIds: readonly string[] = [...seasonsByPlayer.keys()];

/** The single roster line for a player in a given season, if any. */
export function playerSeason(playerId: string, seasonId: string): PlayerSeasonEntry | undefined {
  return seasonsByPlayer.get(playerId)?.find((entry) => entry.seasonId === seasonId);
}

/**
 * The statistically strongest season for a player, scored by a simple sum of the
 * five box-score rate categories. Used to pick a representative line for a player
 * in decade-wide contexts (Era Vault, compare defaults, search results).
 */
export function bestSeasonOf(playerId: string): PlayerSeasonEntry | undefined {
  const career = careerOf(playerId).filter((entry) => entry.gp > 0);
  if (career.length === 0) return careerOf(playerId)[0];
  return [...career].sort(
    (a, b) => b.ppg + b.rpg + b.apg + b.spg + b.bpg - (a.ppg + a.rpg + a.apg + a.spg + a.bpg),
  )[0];
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export interface GameEntry extends Game {
  seasonId: string;
  seasonIndex: number;
  /** 1-based order within the season, matching the printed schedule. */
  gameNumber: number;
}

function buildGames(): GameEntry[] {
  const out: GameEntry[] = [];
  seasons.forEach((season, seasonIndex) => {
    season.games.forEach((game, gameIndex) => {
      out.push({ ...game, seasonId: season.id, seasonIndex, gameNumber: gameIndex + 1 });
    });
  });
  return out;
}

export const allGames: readonly GameEntry[] = buildGames();

export function seasonGames(seasonId: string): readonly GameEntry[] {
  return allGames.filter((game) => game.seasonId === seasonId);
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

const manifestByKey = new Map(photoManifest.items.map((item) => [item.image_key, item]));

/**
 * Vite rewrites `base` at build time; asset paths in the manifest are absolute
 * (`/images/...`) so they are normalised here to stay relative to the deployed base.
 * This is what lets the built archive run from a subdirectory or `file://`.
 */
const BASE = import.meta.env.BASE_URL ?? '/';

function resolveAssetPath(path: string): string {
  const trimmed = path.replace(/^\//, '');
  return `${BASE.endsWith('/') ? BASE : `${BASE}/`}${trimmed}`;
}

export function photoItem(imageKey: string | undefined): PhotoManifestItem | undefined {
  return imageKey ? manifestByKey.get(imageKey) : undefined;
}

/** Display-ready (processed) image URL for a manifest key. */
export function imageUrl(imageKey: string | undefined): string | undefined {
  const item = photoItem(imageKey);
  return item ? resolveAssetPath(item.processed_path) : undefined;
}

/** The immutable extracted original, for the provenance panel. */
export function originalImageUrl(imageKey: string | undefined): string | undefined {
  const item = photoItem(imageKey);
  return item ? resolveAssetPath(item.original_path) : undefined;
}

export function playerPhoto(playerId: string): PhotoManifestItem | undefined {
  return photoItem(profiles[playerId]?.image);
}

export function playerImageUrl(playerId: string): string | undefined {
  return imageUrl(profiles[playerId]?.image);
}

/** A responsive image source: the largest variant plus a `srcset` of all of them. */
export interface ResponsiveImage {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

/**
 * Responsive portrait sources for a player.
 *
 * Variants are only generated up to 2x a portrait's native crop, so this returns
 * whatever widths genuinely exist rather than a fixed ladder — the browser then picks
 * the smallest adequate file. Returns undefined for the one player with no photograph,
 * whose card is drawn rather than loaded.
 */
export function playerPortrait(playerId: string): ResponsiveImage | undefined {
  const variants = playerPhoto(playerId)?.portrait?.variants;
  if (!variants || variants.length === 0) return undefined;

  const largest = variants.reduce((a, b) => (b.width > a.width ? b : a));
  return {
    src: resolveAssetPath(largest.path),
    srcSet: variants.map((v) => `${resolveAssetPath(v.path)} ${v.width}w`).join(', '),
    width: largest.width,
    height: largest.height,
  };
}

export function teamImageUrl(season: Season): string | undefined {
  return imageUrl(season.teamImage);
}

export const RUPP_ARENA_IMAGE = imageUrl('rupp_arena');
export const TUBBY_SMITH_IMAGE = imageUrl('tubby_smith');

// ---------------------------------------------------------------------------
// Headline totals — computed, never hardcoded
// ---------------------------------------------------------------------------

function sumPairs(pick: (season: Season) => readonly [number, number]): [number, number] {
  return seasons.reduce<[number, number]>(
    (acc, season) => {
      const [w, l] = pick(season);
      return [acc[0] + w, acc[1] + l];
    },
    [0, 0],
  );
}

export const eraRecord: readonly [number, number] = sumPairs((s) => s.record);
export const eraSecRecord: readonly [number, number] = sumPairs((s) => s.secRecord);

export const eraNcaaRecord: readonly [number, number] = allGames
  .filter((g) => g.phase === 'NCAA Tournament')
  .reduce<[number, number]>((acc, g) => (g.result === 'W' ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]), [0, 0]);

export const eraSecTournamentRecord: readonly [number, number] = allGames
  .filter((g) => g.phase === 'SEC Tournament')
  .reduce<[number, number]>((acc, g) => (g.result === 'W' ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]), [0, 0]);

export const profileCount = Object.keys(profiles).length;
export const rosterEntryCount = allPlayerSeasons.length;
export const gameCount = allGames.length;

/**
 * The generative-upscale record for an image, wherever the entry keeps it.
 *
 * Portraits carry it on `portrait` because it describes the derived crop; team
 * photographs have no portrait block and carry it at item level. Callers that need to ask
 * "was this image generated, and how" should not have to know which.
 */
export function reconstructionOf(item: PhotoManifestItem): ImageReconstruction | undefined {
  return item.portrait?.reconstruction ?? item.reconstruction;
}
