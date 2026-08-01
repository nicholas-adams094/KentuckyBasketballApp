import { useMemo, useState } from 'react';
import { allPlayerSeasons, type PlayerSeasonEntry } from '@/lib/archive';
import { BOX_KEYS, impactRating, STAT_FULL_LABEL, STAT_LABEL } from '@/lib/analytics';
import { heightToInches, seasonLabel, stat } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';
import { PlayerPortrait } from '@/components/player/PlayerPortrait';
import { useNavigation } from '@/state/navigation';
import { usePreferences } from '@/state/preferences';
import { useToast } from '@/state/toast';

type SortKey = 'name' | 'number' | 'gp' | 'mpg' | 'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg' | 'tov' | 'impact';
type Layout = 'cards' | 'table';

const ROLE_FILTERS = ['All', 'Starter', 'Rotation', 'Reserve', 'Limited'] as const;

const COLUMNS: { key: SortKey; label: string; title: string; numeric: boolean }[] = [
  { key: 'number', label: '#', title: 'Jersey number', numeric: true },
  { key: 'name', label: 'Player', title: 'Player name', numeric: false },
  { key: 'gp', label: 'GP', title: STAT_FULL_LABEL.gp, numeric: true },
  { key: 'mpg', label: 'MPG', title: STAT_FULL_LABEL.mpg, numeric: true },
  ...BOX_KEYS.map((key) => ({ key: key as SortKey, label: STAT_LABEL[key], title: STAT_FULL_LABEL[key], numeric: true })),
  { key: 'impact', label: 'IMP', title: 'Derived composite impact rating (0–99)', numeric: true },
];

function sortValue(entry: PlayerSeasonEntry, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return entry.profile.name;
    case 'number':
      return Number.parseInt(entry.number, 10) || 999;
    case 'impact':
      return entry.gp > 0 ? impactRating(entry) : -1;
    default:
      return entry[key];
  }
}

/** Roster and statistics for the selected season. */
export function RosterView() {
  const { season, openPlayer, getParam, setParam, setParams } = useNavigation();
  const { favorites, isFavorite, toggleFavorite } = usePreferences();
  const { push } = useToast();

  const [layout, setLayout] = useState<Layout>('cards');
  const search = getParam('q') ?? '';
  const role = getParam('role') ?? 'All';
  const onlyFavorites = getParam('fav') === '1';
  const sortKey = (getParam('sort') as SortKey) ?? 'ppg';
  const sortDir = getParam('dir') === 'asc' ? 1 : -1;

  const roster = useMemo(
    () => allPlayerSeasons.filter((entry) => entry.seasonId === season.id),
    [season.id],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let filtered = roster;

    if (needle) {
      filtered = filtered.filter(
        (entry) =>
          entry.profile.name.toLowerCase().includes(needle) ||
          entry.profile.hometown.toLowerCase().includes(needle) ||
          entry.profile.highSchool.toLowerCase().includes(needle) ||
          entry.number === needle ||
          entry.profile.pos.toLowerCase().includes(needle),
      );
    }
    if (role !== 'All') filtered = filtered.filter((entry) => entry.role === role);
    if (onlyFavorites) filtered = filtered.filter((entry) => favorites.has(entry.id));

    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv)) * sortDir;
      }
      // Height is the natural tiebreaker inside identical statistical lines.
      if (av === bv) return heightToInches(b.profile.height) - heightToInches(a.profile.height);
      return (av - bv) * sortDir;
    });
  }, [roster, search, role, onlyFavorites, favorites, sortKey, sortDir]);

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of roster) counts.set(entry.role, (counts.get(entry.role) ?? 0) + 1);
    return counts;
  }, [roster]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setParam('dir', sortDir === -1 ? 'asc' : 'desc');
    } else {
      // Both parameters must be written in one navigation — two sequential setParam
      // calls would each read the same pre-update route and the second would drop the
      // first. Names read best A→Z; every statistic reads best highest-first.
      setParams({ sort: key, dir: key === 'name' || key === 'number' ? 'asc' : 'desc' });
    }
  };

  const exportCsv = () => {
    const header = ['Number', 'Player', 'Class', 'Position', 'Height', 'Role', 'GP', 'MPG', ...BOX_KEYS.map((k) => STAT_LABEL[k])];
    const lines = rows.map((entry) =>
      [
        entry.number,
        entry.profile.name,
        entry.year,
        entry.profile.pos,
        entry.profile.height,
        entry.role,
        entry.gp,
        entry.mpg,
        ...BOX_KEYS.map((key) => entry[key]),
      ]
        .map((cell) => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : String(cell)))
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kentucky-${season.id}-roster.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    push(`Exported ${rows.length} roster rows as CSV.`, 'success');
  };

  return (
    <div className="view">
      <div className="section-head">
        <div className="section-head__body">
          <span className="kicker">Roster &amp; statistics</span>
          <h2>{seasonLabel(season.id)} Wildcats roster</h2>
          <p>
            {roster.length} roster entries. Search by name, hometown, high school, jersey number or
            position; sort by any statistic; open any player for the full profile and career arc.
          </p>
        </div>
        <div className="row" data-print="hide">
          <div className="segmented" role="group" aria-label="Roster layout">
            <button
              type="button"
              className="segmented__option"
              aria-pressed={layout === 'cards'}
              onClick={() => setLayout('cards')}
            >
              Cards
            </button>
            <button
              type="button"
              className="segmented__option"
              aria-pressed={layout === 'table'}
              onClick={() => setLayout('table')}
            >
              Table
            </button>
          </div>
          <button type="button" className="btn btn--sm" onClick={exportCsv}>
            <Icon name="download" size={14} />
            CSV
          </button>
        </div>
      </div>

      <div className="toolbar" data-print="hide">
        <div className="field">
          <span className="field__icon">
            <Icon name="search" size={15} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder="Find a player…"
            aria-label="Search the roster"
          />
        </div>

        <div className="chips" role="group" aria-label="Filter by role">
          {ROLE_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={role === option}
              aria-label={
                option === 'All'
                  ? 'All roles'
                  : `${option} — ${roleCounts.get(option) ?? 0} player${roleCounts.get(option) === 1 ? '' : 's'}`
              }
              onClick={() => setParam('role', option === 'All' ? null : option)}
            >
              {option}
              {option !== 'All' && roleCounts.has(option) ? (
                <span className="chip__count">{roleCounts.get(option)}</span>
              ) : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="chip"
          aria-pressed={onlyFavorites}
          onClick={() => setParam('fav', onlyFavorites ? null : '1')}
          disabled={favorites.size === 0}
          title={favorites.size === 0 ? 'Star a player to use this filter' : 'Show only favorites'}
        >
          <Icon name={onlyFavorites ? 'star-filled' : 'star'} size={12} /> Favorites
          {favorites.size > 0 ? <span className="chip__count">{favorites.size}</span> : null}
        </button>

        <span className="spacer" />

        <label className="row" style={{ gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Sort</span>
          <select
            className="select"
            value={sortKey}
            onChange={(event) => toggleSort(event.target.value as SortKey)}
            aria-label="Sort roster by"
          >
            {COLUMNS.map((column) => (
              <option key={column.key} value={column.key}>
                {column.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="roster-summary">
        Showing <strong>{rows.length}</strong> of {roster.length} entries
        {search ? (
          <>
            {' '}
            matching “{search}”
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setParam('q', null)}>
              Clear
            </button>
          </>
        ) : null}
      </p>

      {rows.length === 0 ? (
        <div className="card empty-state">
          <Icon name="search" size={28} />
          <h3>No players match these filters</h3>
          <p>Try clearing the search box or choosing a different role.</p>
        </div>
      ) : layout === 'cards' ? (
        <div className="grid grid--cards">
          {rows.map((entry) => {
            const favorite = isFavorite(entry.id);
            return (
              <article key={entry.id} className="card card--interactive player-card">
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => openPlayer(entry.id)}
                    style={{ display: 'block', width: '100%' }}
                    aria-label={`Open ${entry.profile.name} profile`}
                  >
                    <PlayerPortrait playerId={entry.id} number={entry.number} showProvenance />
                  </button>
                  <button
                    type="button"
                    className="favorite-btn"
                    aria-pressed={favorite}
                    aria-label={`${favorite ? 'Remove' : 'Add'} ${entry.profile.name} ${favorite ? 'from' : 'to'} favorites`}
                    onClick={() => toggleFavorite(entry.id)}
                  >
                    <Icon name={favorite ? 'star-filled' : 'star'} size={15} />
                  </button>
                </div>

                <div className="player-card__body">
                  <div className="player-card__name">
                    <h3>{entry.profile.name}</h3>
                    <span className="badge badge--neutral">{entry.role}</span>
                  </div>
                  <p className="player-card__meta">
                    #{entry.number} · {entry.profile.pos} · {entry.year} · {entry.profile.height}
                  </p>
                  {entry.awards.length > 0 ? (
                    <div className="chips">
                      {entry.awards.slice(0, 2).map((award) => (
                        <span key={award} className="badge badge--gold">
                          {award}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="player-card__stats">
                    {(['ppg', 'rpg', 'apg'] as const).map((key) => (
                      <div key={key} className="player-card__stat">
                        <b>{stat(entry[key])}</b>
                        <span>{STAT_LABEL[key]}</span>
                      </div>
                    ))}
                    <div className="player-card__stat">
                      <b>{entry.gp > 0 ? impactRating(entry) : '—'}</b>
                      <span>IMP</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card card--flush">
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                {seasonLabel(season.id)} Kentucky Wildcats roster statistics
              </caption>
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={column.numeric ? undefined : 'is-text'}
                      aria-sort={
                        sortKey === column.key ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'
                      }
                    >
                      <button type="button" onClick={() => toggleSort(column.key)} title={column.title}>
                        {column.label}
                        {sortKey === column.key ? (
                          <Icon name={sortDir === 1 ? 'chevron-up' : 'chevron-down'} size={12} />
                        ) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr
                    key={entry.id}
                    data-clickable="true"
                    onClick={() => openPlayer(entry.id)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openPlayer(entry.id);
                      }
                    }}
                  >
                    <td className="numeric">{entry.number}</td>
                    <td className="is-text">
                      <span className="table__player">
                        <PlayerPortrait playerId={entry.id} avatarSize="xs" />
                        <span>
                          <strong style={{ display: 'block', fontWeight: 600 }}>{entry.profile.name}</strong>
                          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                            {entry.profile.pos} · {entry.year} · {entry.role}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="numeric">{entry.gp}</td>
                    <td className="numeric">{stat(entry.mpg)}</td>
                    {BOX_KEYS.map((key) => (
                      <td key={key} className="numeric">
                        {stat(entry[key])}
                      </td>
                    ))}
                    <td className="numeric">
                      <strong>{entry.gp > 0 ? impactRating(entry) : '—'}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table__caption">
            <strong>IMP</strong> is a derived composite rating computed from this archive's box-score
            categories relative to the decade's rotation players. It is a fan metric, not an official
            statistic. Select any row to open the full profile.
          </p>
        </div>
      )}
    </div>
  );
}
