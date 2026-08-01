/** Presentation-only formatting helpers. Nothing here changes a stored value. */

import type { GameLocation, GamePhase, RecordPair } from '@/types/archive';

const ONE_DP = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** One decimal place, the convention used throughout basketball box scores. */
export function stat(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return ONE_DP.format(value);
}

/** Signed one-decimal value, for margins and differentials. */
export function signed(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : '−'}${ONE_DP.format(Math.abs(value))}`;
}

/** Signed integer, for point differentials in a single game. */
export function signedInt(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value)}`;
}

export function record(pair: RecordPair | readonly [number, number]): string {
  return `${pair[0]}–${pair[1]}`;
}

/** Winning percentage as a `.xxx` string, the standard sports convention. */
export function winPct(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return '.000';
  return (wins / total).toFixed(3).replace(/^0/, '');
}

export function winPctNumber(wins: number, losses: number): number {
  const total = wins + losses;
  return total === 0 ? 0 : wins / total;
}

export function percent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

/** `1997-98` → `1997–98` (en dash), used in all prose and headings. */
export function seasonLabel(seasonId: string): string {
  return seasonId.replace('-', '–');
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const DATE_SHORT_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** ISO date → `Nov 20, 1997`. Parsed as UTC so the day never shifts by timezone. */
export function gameDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : DATE_FMT.format(date);
}

export function gameDateShort(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : DATE_SHORT_FMT.format(date);
}

export const LOCATION_LABEL: Record<GameLocation, string> = {
  H: 'Home',
  A: 'Away',
  N: 'Neutral',
};

export const LOCATION_SHORT: Record<GameLocation, string> = {
  H: 'vs',
  A: 'at',
  N: 'vs',
};

export const PHASE_LABEL: Record<GamePhase, string> = {
  'Regular Season': 'Regular season',
  'Maui Invitational': 'Maui Invitational',
  'Guardians Classic': 'Guardians Classic',
  'SEC Tournament': 'SEC Tournament',
  'NCAA Tournament': 'NCAA Tournament',
};

export function apRank(rank: number | null | undefined): string {
  return rank ? `#${rank}` : 'UR';
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Height string `6-5` → inches, for sorting and lineup size checks. */
export function heightToInches(height: string): number {
  const match = /^(\d+)-(\d+)$/.exec(height.trim());
  if (!match) return 0;
  return Number(match[1]) * 12 + Number(match[2]);
}

export function heightLabel(height: string): string {
  const match = /^(\d+)-(\d+)$/.exec(height.trim());
  return match ? `${match[1]}′ ${match[2]}″` : height;
}
