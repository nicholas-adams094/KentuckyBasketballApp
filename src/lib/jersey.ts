/**
 * Generated jersey card, used when no photograph is available for a player.
 *
 * Deliberately abstract: initials and a number on a Kentucky jersey. The archive never
 * renders an invented face, so where a verified image does not exist this is what a
 * reader sees, alongside a visible "Placeholder" flag.
 */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function jerseyFallback(name: string, number: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#dae8ff"/><stop offset="1" stop-color="#8fbcff"/>
    </linearGradient>
  </defs>
  <rect width="300" height="400" fill="url(#g)"/>
  <path d="M96 238h108l19 132H77z" fill="#fff"/>
  <path d="M96 238l54 42 54-42" fill="none" stroke="#0033a0" stroke-width="10"/>
  <circle cx="150" cy="128" r="52" fill="#183a68" opacity="0.92"/>
  <text x="150" y="143" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="800" fill="#fff">${initials(name)}</text>
  <text x="150" y="336" text-anchor="middle" font-family="Arial,sans-serif" font-size="64" font-weight="900" fill="#0033a0">${number || 'KY'}</text>
  <text x="150" y="382" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="800" letter-spacing="4" fill="#0033a0">KENTUCKY</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
