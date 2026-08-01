import type { ReactElement, SVGProps } from 'react';

/**
 * Inline icon set.
 *
 * Hand-drawn on a 24×24 grid rather than pulled from an icon package: it keeps the
 * bundle free of a dependency, guarantees the archive works offline, and lets every
 * glyph inherit `currentColor` and stroke weight from its context.
 */

export type IconName =
  | 'search'
  | 'close'
  | 'star'
  | 'star-filled'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'arrow-up'
  | 'arrow-down'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'home'
  | 'grid'
  | 'clipboard'
  | 'calendar'
  | 'trophy'
  | 'compare'
  | 'vault'
  | 'info'
  | 'print'
  | 'link'
  | 'download'
  | 'copy'
  | 'trash'
  | 'save'
  | 'sliders'
  | 'external'
  | 'alert'
  | 'check'
  | 'basketball'
  | 'flame'
  | 'shield'
  | 'zap';

const PATHS: Record<IconName, ReactElement> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  star: <path d="m12 3.5 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8z" />,
  'star-filled': (
    <path
      d="m12 3.5 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8z"
      fill="currentColor"
    />
  ),
  'chevron-left': <path d="m14.5 5-7 7 7 7" />,
  'chevron-right': <path d="m9.5 5 7 7-7 7" />,
  'chevron-down': <path d="m5 9.5 7 7 7-7" />,
  'chevron-up': <path d="m5 14.5 7-7 7 7" />,
  'arrow-up': <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  'arrow-down': <path d="M12 5v14m0 0 6-6m-6 6-6-6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" />,
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 21h7M12 17v4" />
    </>
  ),
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 3.5h6v3H9zM8.5 11h7M8.5 15h4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4m8-4v4" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5.5H4.5v1.5a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3M9.5 20h5M12 14v6" />
    </>
  ),
  compare: <path d="M8 5.5H4v13h4zM20 5.5h-4v13h4zM12 3v18" />,
  vault: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 8V6.5m0 11V16m4-4h1.5M6.5 12H8" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.6" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V3.5h10V9M7 18H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 10h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 18h-2" />
      <rect x="7" y="14.5" width="10" height="6" rx="1" />
    </>
  ),
  link: <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.5 1.5M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.5-1.5" />,
  download: <path d="M12 3.5v11m0 0 4-4m-4 4-4-4M4.5 17v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1" />
    </>
  ),
  trash: <path d="M4.5 6.5h15M9.5 6.5V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 6.5l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13" />,
  save: (
    <>
      <path d="M5.5 3.5h11l4 4v13a1 1 0 0 1-1 1h-14a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" />
      <path d="M8 3.5v5h7v-5M8 21v-6h8v6" />
    </>
  ),
  sliders: <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5" />,
  external: <path d="M14 4.5h5.5V10M19 5l-7.5 7.5M18 14v5.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H11" />,
  alert: (
    <>
      <path d="M12 4 2.8 20h18.4z" />
      <path d="M12 10v4.5M12 17.4v.4" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 9.5c5 .8 12.6.8 17.6 0M3.2 14.5c5-.8 12.6-.8 17.6 0M12 3c-3.4 2.6-3.4 15.4 0 18M12 3c3.4 2.6 3.4 15.4 0 18" />
    </>
  ),
  flame: <path d="M12 21c3.6 0 6-2.4 6-5.6 0-4.2-4-5.4-3-10.4-2.6.8-4.4 3-4.4 5.2 0 1.4-.8 2-1.6 2-1 0-1.6-.8-1.6-2C5.4 12 6 13.4 6 15.4 6 18.6 8.4 21 12 21" />,
  shield: <path d="M12 3.2 5 5.8v5.6c0 4.2 2.8 7.6 7 9.4 4.2-1.8 7-5.2 7-9.4V5.8z" />,
  zap: <path d="M13.5 3 5 13.5h6L10.5 21 19 10.5h-6z" />,
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
