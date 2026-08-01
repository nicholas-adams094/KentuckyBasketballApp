/**
 * Horizontal scrolling for the season rail and section nav.
 *
 * These deliberately set `scrollLeft` rather than calling `element.scrollIntoView()`.
 * In Chromium, `scrollIntoView` moves the document's sequential focus navigation
 * starting point onto the scrolled element — which meant that after load, pressing Tab
 * jumped straight into the nav and skipped the skip link and every header control.
 * Writing `scrollLeft` on the container keeps the active item visible without touching
 * focus, and cannot scroll the page vertically as a side effect.
 */

export type ScrollAlign = 'center' | 'nearest';

export function scrollIntoViewX(
  container: HTMLElement | null | undefined,
  element: HTMLElement | null | undefined,
  align: ScrollAlign = 'nearest',
  behavior: ScrollBehavior = 'smooth',
): void {
  if (!container || !element) return;

  const containerWidth = container.clientWidth;
  const elementLeft = element.offsetLeft;
  const elementWidth = element.offsetWidth;
  const current = container.scrollLeft;

  let target: number;
  if (align === 'center') {
    target = elementLeft - containerWidth / 2 + elementWidth / 2;
  } else {
    const visibleStart = current;
    const visibleEnd = current + containerWidth;
    if (elementLeft >= visibleStart && elementLeft + elementWidth <= visibleEnd) return;
    target = elementLeft < visibleStart ? elementLeft - 16 : elementLeft + elementWidth - containerWidth + 16;
  }

  const max = container.scrollWidth - containerWidth;
  const clamped = Math.max(0, Math.min(max, target));
  if (Math.abs(clamped - current) < 2) return;

  // `scrollTo` on a container respects prefers-reduced-motion via the caller's choice
  // of behavior and never affects the focus navigation starting point.
  container.scrollTo({ left: clamped, behavior });
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
