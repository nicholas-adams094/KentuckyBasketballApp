/**
 * Types for the structured Tubby Smith era archive.
 *
 * These mirror `src/data/archive.json` exactly. The JSON is the source of truth for
 * historical fact; nothing in the application may invent, infer, or silently alter a
 * value that appears here. Derived numbers live in `src/lib/analytics.ts` and are
 * always labelled as derived in the UI.
 */

/** `[wins, losses]`. */
export type RecordPair = readonly [number, number];

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export const POSITIONS: readonly Position[] = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

export type GameLocation = 'H' | 'A' | 'N';
export type GameResult = 'W' | 'L';

/**
 * Competition phases present in the data.
 *
 * Note the two named early-season events. Kentucky played eight games in exempt
 * multi-team tournaments (the Maui Invitational in 2002–03 and 2006–07, the Guardians
 * Classic in 2005–06) and the archive records those under their event name rather than
 * as plain "Regular Season". They count toward the regular-season record and are always
 * non-conference; only the SEC and NCAA Tournaments are postseason.
 */
export const REGULAR_SEASON_PHASES = [
  'Regular Season',
  'Maui Invitational',
  'Guardians Classic',
] as const;

export const POSTSEASON_PHASES = ['SEC Tournament', 'NCAA Tournament'] as const;

export type RegularSeasonPhase = (typeof REGULAR_SEASON_PHASES)[number];
export type PostseasonPhase = (typeof POSTSEASON_PHASES)[number];
export type GamePhase = RegularSeasonPhase | PostseasonPhase;

export const ALL_PHASES: readonly GamePhase[] = [...REGULAR_SEASON_PHASES, ...POSTSEASON_PHASES];

/** Named early-season events — regular-season games that carry their own event label. */
export const EXEMPT_TOURNAMENT_PHASES: readonly GamePhase[] = ['Maui Invitational', 'Guardians Classic'];

export function isPostseasonPhase(phase: GamePhase): phase is PostseasonPhase {
  return (POSTSEASON_PHASES as readonly string[]).includes(phase);
}

export function isExemptTournamentPhase(phase: GamePhase): boolean {
  return (EXEMPT_TOURNAMENT_PHASES as readonly string[]).includes(phase);
}

/** A player's biography — one per person, shared across every season they appear in. */
export interface PlayerProfile {
  name: string;
  pos: string;
  height: string;
  weight: number;
  hometown: string;
  highSchool: string;
  image?: string;
  bio: string;
  legacy: string;
  photoNote?: string;
  photoType?: string;
  photoSeason?: string;
}

/** One player's statistical line for one season. */
export interface PlayerSeason {
  id: string;
  number: string;
  year: string;
  gp: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tov: number;
  role: string;
  awards: string[];
  note?: string;
}

export interface Game {
  date: string;
  loc: GameLocation;
  opponent: string;
  result: GameResult;
  uk: number;
  opp: number;
  margin: number;
  phase: GamePhase;
  note?: string;
  sec: boolean;
  overtime?: string;
}

/** `[title, description, statLine]`. */
export type Highlight = readonly [string, string, string];

/** `[recipient, honor]`. */
export type Award = readonly [string, string];

export interface Season {
  id: string;
  short: string;
  coach: string;
  record: RecordPair;
  secRecord: RecordPair;
  finish: string;
  seed: number;
  apPre: number;
  apFinal?: number | null;
  ppg: number;
  oppPpg: number;
  margin: number;
  conferenceFinish: string;
  signature: string;
  story: string;
  highlights: Highlight[];
  starters: Record<Position, string>;
  rotation: string[];
  awards: Award[];
  roster: PlayerSeason[];
  games: Game[];
  teamImage: string;
}

export interface SourceReference {
  name: string;
  url: string;
  use: string;
}

export interface PhotoCredit {
  key: string;
  title: string;
  url: string;
  note: string;
}

export interface Archive {
  profiles: Record<string, PlayerProfile>;
  seasons: Season[];
  sources: SourceReference[];
  photoCredits: PhotoCredit[];
}

// ---------------------------------------------------------------------------
// Photo provenance manifest
// ---------------------------------------------------------------------------

export type PhotoKind = 'player' | 'team' | 'interface';

/**
 * Provenance confidence for an image. The UI surfaces anything that is not
 * `verified-archival` so a reader is never shown a reconstruction presented as an
 * authentic archival headshot.
 */
export type PhotoConfidence =
  | 'verified-archival'
  | 'verified-official-team-photo'
  | 'verified-source-derived-portrait'
  | 'placeholder';

export interface PhotoManifestItem {
  id: string;
  kind: PhotoKind;
  entity_id: string;
  display_name: string;
  image_key: string;
  seasons: string[];
  original_path: string;
  processed_path: string;
  original_dimensions: { width: number; height: number };
  processed_dimensions: { width: number; height: number };
  photo_type: string;
  photo_note: string;
  source_url: string | null;
  source_reference?: string;
  confidence: PhotoConfidence | string;
  derivative_method: string;
  needs_resourcing: boolean;
  visual_review_status: string;
  rights_review_status: string;
}

export interface PhotoManifest {
  schema_version: number;
  generated_at: string;
  project: string;
  notes: string[];
  items: PhotoManifestItem[];
}
