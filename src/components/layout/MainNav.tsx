import { useEffect, useRef } from 'react';
import { buildHash, VIEW_META, VIEWS, type ViewId } from '@/lib/router';
import { Icon, type IconName } from '@/components/ui/Icon';
import { prefersReducedMotion, scrollIntoViewX } from '@/lib/scroll';
import { useNavigation } from '@/state/navigation';

const VIEW_ICON: Record<ViewId, IconName> = {
  overview: 'home',
  roster: 'grid',
  lineup: 'clipboard',
  schedule: 'calendar',
  postseason: 'trophy',
  compare: 'compare',
  era: 'vault',
  sources: 'info',
};

export function MainNav() {
  const { season, view, goToView } = useNavigation();
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const active = track?.querySelector<HTMLElement>('[aria-current="page"]');
    scrollIntoViewX(track, active, 'nearest', prefersReducedMotion() ? 'auto' : 'smooth');
  }, [view]);

  return (
    <div className="mainnav">
      <nav className="shell" aria-label="Archive sections">
        <div className="mainnav__track" ref={trackRef}>
          {VIEWS.map((id) => (
            <a
              key={id}
              className="navlink"
              href={buildHash({ seasonId: season.id, view: id })}
              aria-current={id === view ? 'page' : undefined}
              title={VIEW_META[id].description}
              onClick={(event) => {
                event.preventDefault();
                goToView(id);
              }}
            >
              <span className="navlink__icon">
                <Icon name={VIEW_ICON[id]} size={16} />
              </span>
              {VIEW_META[id].label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
