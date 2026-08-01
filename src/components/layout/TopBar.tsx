import { eraRecord, eraSecRecord, profileCount } from '@/lib/archive';
import { record } from '@/lib/format';
import { seasonHash } from '@/lib/router';
import { Icon } from '@/components/ui/Icon';
import { usePreferences } from '@/state/preferences';
import { useNavigation } from '@/state/navigation';
import type { ThemeChoice } from '@/state/preferences';

const THEME_CYCLE: ThemeChoice[] = ['system', 'light', 'dark'];
const THEME_ICON = { system: 'monitor', light: 'sun', dark: 'moon' } as const;
const THEME_LABEL = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' } as const;

export interface TopBarProps {
  onOpenSearch: () => void;
}

export function TopBar({ onOpenSearch }: TopBarProps) {
  const { theme, setTheme, favorites } = usePreferences();
  const { season, navigate } = useNavigation();

  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];

  return (
    <header className="topbar">
      <div className="shell topbar__inner">
        <a
          className="brand"
          href={seasonHash(season.id)}
          onClick={(event) => {
            event.preventDefault();
            navigate(seasonHash(season.id));
          }}
        >
          <span className="brand__mark" aria-hidden="true">
            BB
          </span>
          <span className="brand__text">
            <span className="brand__title">Big Blue Archive</span>
            <span className="brand__sub">Tubby Smith era · 1997–2007</span>
          </span>
        </a>

        <div className="topbar__stats" aria-hidden="true">
          <span className="topbar__stat">
            <b>{record(eraRecord)}</b> overall
          </span>
          <span className="topbar__stat">
            <b>{record(eraSecRecord)}</b> SEC
          </span>
          <span className="topbar__stat">
            <b>{profileCount}</b> players
          </span>
          {favorites.size > 0 ? (
            <span className="topbar__stat">
              <b>{favorites.size}</b> favorite{favorites.size === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        <div className="topbar__actions">
          <button type="button" className="topbar__search" onClick={onOpenSearch}>
            <Icon name="search" size={15} />
            <span className="topbar__search-label">Search the archive</span>
            <span className="spacer" />
            <span className="kbd" aria-hidden="true">
              ⌘K
            </span>
          </button>

          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme(nextTheme)}
            aria-label={`${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[nextTheme].toLowerCase()}`}
            title={THEME_LABEL[theme]}
          >
            <Icon name={THEME_ICON[theme]} size={16} />
          </button>

          <button
            type="button"
            className="icon-button"
            onClick={() => window.print()}
            aria-label="Print this view"
            title="Print this view"
          >
            <Icon name="print" size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
