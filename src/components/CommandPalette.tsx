import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { imageUrl, playerPortrait, seasons } from '@/lib/archive';
import { search, SEARCH_KIND_LABEL, type SearchKind, type SearchResult } from '@/lib/search';
import { seasonHash } from '@/lib/router';
import { Icon } from '@/components/ui/Icon';
import { useNavigation } from '@/state/navigation';

/**
 * Command palette (⌘K / Ctrl-K).
 *
 * One keystroke to reach any player, season, game, opponent or section in the archive.
 * Implements the ARIA combobox pattern: the input keeps focus and owns the listbox, and
 * `aria-activedescendant` moves the virtual cursor so screen readers track the highlight.
 */

/** With an empty query, offer the ten seasons rather than a blank panel. */
function defaultResults(): SearchResult[] {
  return seasons.map((season) => ({
    id: `season:${season.id}`,
    kind: 'season' as const,
    title: `${season.id.replace('-', '–')} Wildcats`,
    subtitle: `${season.record[0]}–${season.record[1]} · ${season.finish}`,
    haystack: '',
    weight: 0,
    route: seasonHash(season.id),
    imageKey: season.teamImage,
    score: 0,
  }));
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { navigate } = useNavigation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => (query.trim() ? search(query, { limit: 24 }) : defaultResults()),
    [query],
  );

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the highlighted row inside the scroll viewport during keyboard traversal.
  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  // Escape closes from anywhere inside the palette, including the footer's Esc button
  // once it has been tabbed to. Arrow/Enter handling lives on the combobox input, which
  // is where the ARIA pattern puts it.
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onEscape, true);
    return () => document.removeEventListener('keydown', onEscape, true);
  }, [open, onClose]);

  if (!open) return null;

  const go = (result: SearchResult) => {
    navigate(result.route);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => (results.length ? (index - 1 + results.length) % results.length : 0));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(Math.max(0, results.length - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const result = results[activeIndex];
        if (result) go(result);
        break;
      }
      default:
        break;
    }
  };

  // Group headings are rendered inline; results stay in one flat listbox so arrow keys
  // move through everything in relevance order.
  let lastKind: SearchKind | null = null;

  return createPortal(
    <div
      className="palette-backdrop"
      // Decoration with a convenience dismiss; Escape and the visible Esc button are the
      // keyboard paths.
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search the archive">
        <div className="palette__input-row">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            className="palette__input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-activedescendant={results[activeIndex] ? `palette-option-${activeIndex}` : undefined}
            aria-autocomplete="list"
            placeholder="Search players, seasons, games, opponents…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="palette__results" ref={listRef} id="palette-listbox" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <h3>No matches</h3>
              <p>Try a player name, a season such as “2003”, or an opponent such as “Louisville”.</p>
            </div>
          ) : (
            results.map((result, index) => {
              const showHeading = result.kind !== lastKind;
              lastKind = result.kind;
              // Players carry a responsive ladder; a 26px avatar takes the smallest rung
              // rather than the full-size file.
              const portrait = result.playerId ? playerPortrait(result.playerId) : undefined;
              const image = portrait?.src ?? (result.imageKey ? imageUrl(result.imageKey) : undefined);

              return (
                <div key={result.id}>
                  {showHeading ? (
                    <div className="palette__group-label" aria-hidden="true">
                      {SEARCH_KIND_LABEL[result.kind]}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    id={`palette-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    data-active={index === activeIndex}
                    className="palette__item"
                    onClick={() => go(result)}
                    onMouseMove={() => setActiveIndex(index)}
                  >
                    {image ? (
                      <img
                        src={image}
                        srcSet={portrait?.srcSet}
                        sizes={portrait ? '32px' : undefined}
                        alt=""
                        className="avatar avatar--xs"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="avatar avatar--xs"
                        style={{ display: 'grid', placeItems: 'center' }}
                        aria-hidden="true"
                      >
                        <Icon name={result.kind === 'game' ? 'calendar' : result.kind === 'opponent' ? 'shield' : 'grid'} size={14} />
                      </span>
                    )}
                    <span className="palette__item-body">
                      <span className="palette__item-title">{result.title}</span>
                      <span className="palette__item-sub">{result.subtitle}</span>
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="palette__footer">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> open
          </span>
          <span>
            <span className="kbd">Esc</span> close
          </span>
          <span className="spacer" />
          <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
