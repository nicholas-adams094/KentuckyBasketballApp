import { useEffect, useRef } from 'react';
import { seasons } from '@/lib/archive';
import { record, seasonLabel } from '@/lib/format';
import { seasonHash } from '@/lib/router';
import { prefersReducedMotion, scrollIntoViewX } from '@/lib/scroll';
import { useNavigation } from '@/state/navigation';

/**
 * The ten-season selector.
 *
 * Rendered as links so a season is shareable, middle-clickable and reachable by
 * keyboard in document order. Roving focus is not needed: every tab is a real link.
 */
export function SeasonRail() {
  const { season, goToSeason } = useNavigation();
  const trackRef = useRef<HTMLDivElement>(null);

  // Keep the active season in view when it changes from elsewhere (search, deep link).
  useEffect(() => {
    const track = trackRef.current;
    const active = track?.querySelector<HTMLElement>('[aria-current="true"]');
    scrollIntoViewX(track, active, 'center', prefersReducedMotion() ? 'auto' : 'smooth');
  }, [season.id]);

  return (
    <nav className="season-rail" aria-label="Choose a season">
      <div className="shell" style={{ paddingInline: 0 }}>
        <div className="season-rail__track" ref={trackRef}>
          {seasons.map((item) => (
            <a
              key={item.id}
              className="season-tab"
              href={seasonHash(item.id)}
              aria-current={item.id === season.id}
              onClick={(event) => {
                event.preventDefault();
                goToSeason(item.id);
              }}
            >
              <span className="season-tab__year">{seasonLabel(item.id)}</span>
              <span className="season-tab__meta">
                {record(item.record)} · {item.finish}
              </span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
