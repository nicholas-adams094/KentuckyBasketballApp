import { useMemo } from 'react';
import { playedSeasons, type PlayerSeasonEntry } from '@/lib/archive';
import {
  BOX_KEYS,
  eraDistributions,
  impactRating,
  INVERTED_STATS,
  per40,
  RATE_KEYS,
  STAT_LABEL,
  teamShare,
} from '@/lib/analytics';
import { percent, seasonLabel, stat } from '@/lib/format';
import { RadarChart, SERIES_COLORS } from '@/components/ui/charts';
import { Icon } from '@/components/ui/Icon';
import { PlayerPortrait } from '@/components/player/PlayerPortrait';
import { useNavigation } from '@/state/navigation';

const MAX_SLOTS = 4;

function entryKey(entry: PlayerSeasonEntry): string {
  return `${entry.id}@${entry.seasonId}`;
}

function findEntry(key: string): PlayerSeasonEntry | undefined {
  const [id, seasonId] = key.split('@');
  return playedSeasons.find((entry) => entry.id === id && entry.seasonId === seasonId);
}

/** Side-by-side comparison of up to four player-seasons from anywhere in the decade. */
export function CompareView() {
  const { season, getParam, setParam, openPlayer } = useNavigation();

  // Sensible defaults: the two most productive lines from the current season.
  const defaults = useMemo(() => {
    const fromSeason = playedSeasons
      .filter((entry) => entry.seasonId === season.id)
      .sort((a, b) => impactRating(b) - impactRating(a));
    return fromSeason.slice(0, 2).map(entryKey);
  }, [season.id]);

  const selectedKeys = useMemo(() => {
    const raw = getParam('players');
    const keys = raw ? raw.split(',').filter(Boolean) : defaults;
    return keys.slice(0, MAX_SLOTS);
  }, [getParam, defaults]);

  const selected = useMemo(
    () => selectedKeys.map(findEntry).filter((entry): entry is PlayerSeasonEntry => Boolean(entry)),
    [selectedKeys],
  );

  const options = useMemo(
    () =>
      [...playedSeasons].sort(
        (a, b) => a.profile.name.localeCompare(b.profile.name) || a.seasonId.localeCompare(b.seasonId),
      ),
    [],
  );

  const setSlot = (index: number, key: string) => {
    const next = [...selectedKeys];
    if (key) next[index] = key;
    else next.splice(index, 1);
    setParam('players', next.filter(Boolean).join(','));
  };

  const addSlot = () => {
    const used = new Set(selectedKeys);
    const candidate = options.find((entry) => !used.has(entryKey(entry)));
    if (candidate) setParam('players', [...selectedKeys, entryKey(candidate)].join(','));
  };

  // Radar axes are normalised against the decade's rotation maximum so shapes are
  // comparable across players and seasons.
  const radarSeries = selected.map((entry, index) => ({
    label: `${entry.profile.name} ${seasonLabel(entry.seasonId)}`,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    values: RATE_KEYS.map((key) => {
      const max = eraDistributions[key].max || 1;
      return Math.min(1, entry[key] / max);
    }),
  }));

  return (
    <div className="view">
      <div className="section-head">
        <div className="section-head__body">
          <span className="kicker">Head to head</span>
          <h2>Compare player-seasons</h2>
          <p>
            Put up to four seasons side by side from anywhere in the decade — the same player in
            different years, or players who never shared a roster. Bars are scaled to the highest value
            among the selected lines; the radar is scaled to the decade's rotation maximum in each
            category.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--sm"
          onClick={addSlot}
          disabled={selected.length >= MAX_SLOTS}
          data-print="hide"
        >
          <Icon name="compare" size={14} />
          Add a player
        </button>
      </div>

      <div className="compare-grid" style={{ marginBottom: 'var(--space-6)' }}>
        {selected.map((entry, index) => (
          <article key={entryKey(entry)} className="card compare-slot">
            <div className="compare-slot__head">
              <PlayerPortrait playerId={entry.id} avatarSize="md" />
              <div className="compare-slot__name">
                <strong>{entry.profile.name}</strong>
                <span>
                  {seasonLabel(entry.seasonId)} · {entry.year} · #{entry.number}
                </span>
                <span
                  className="badge badge--accent"
                  style={{ marginTop: 'var(--space-1)', display: 'inline-flex' }}
                >
                  IMP {impactRating(entry)}
                </span>
              </div>
            </div>

            <select
              className="select"
              value={entryKey(entry)}
              onChange={(event) => setSlot(index, event.target.value)}
              aria-label={`Comparison slot ${index + 1}`}
              data-print="hide"
            >
              {options.map((option) => (
                <option key={entryKey(option)} value={entryKey(option)}>
                  {option.profile.name} · {seasonLabel(option.seasonId)}
                </option>
              ))}
            </select>

            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--text-xs)',
                margin: 0,
              }}
            >
              <dt style={{ color: 'var(--text-subtle)' }}>Games</dt>
              <dd style={{ margin: 0 }}>{entry.gp}</dd>
              <dt style={{ color: 'var(--text-subtle)' }}>Minutes</dt>
              <dd style={{ margin: 0 }}>{stat(entry.mpg)} per game</dd>
              <dt style={{ color: 'var(--text-subtle)' }}>Per 40</dt>
              <dd style={{ margin: 0 }}>
                {stat(per40(entry.ppg, entry.mpg))} pts · {stat(per40(entry.rpg, entry.mpg))} reb
              </dd>
              <dt style={{ color: 'var(--text-subtle)' }}>Team scoring</dt>
              <dd style={{ margin: 0 }}>{percent(teamShare(entry, 'ppg'))}</dd>
            </dl>

            <div className="row" style={{ marginTop: 'auto' }} data-print="hide">
              <button type="button" className="btn btn--sm" onClick={() => openPlayer(entry.id)}>
                Full profile
              </button>
              {selected.length > 1 ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setSlot(index, '')}
                  aria-label={`Remove ${entry.profile.name} from the comparison`}
                >
                  <Icon name="close" size={14} />
                </button>
              ) : null}
            </div>
          </article>
        ))}

        {selected.length === 0 ? (
          <div className="card empty-state">
            <Icon name="compare" size={28} />
            <h3>Nothing selected</h3>
            <p>Add a player to begin comparing.</p>
          </div>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="grid grid--halves">
          <article className="card card--pad">
            <div className="subhead">
              <h3>Category comparison</h3>
              <span>Per game</span>
            </div>
            <div className="compare-bars">
              {BOX_KEYS.map((key) => {
                const max = Math.max(...selected.map((entry) => entry[key]), 0.1);
                return (
                  <div key={key} className="compare-bar-row">
                    <span className="compare-bar-row__label" title={STAT_LABEL[key]}>
                      {STAT_LABEL[key]}
                    </span>
                    <div className="compare-bar-row__bars">
                      {selected.map((entry, index) => (
                        <div key={entryKey(entry)} className="compare-bar">
                          <div className="compare-bar__track">
                            <div
                              className="compare-bar__fill"
                              style={{
                                width: `${Math.max(2, (entry[key] / max) * 100)}%`,
                                background: SERIES_COLORS[index % SERIES_COLORS.length],
                              }}
                            />
                          </div>
                          <span className="compare-bar__value">{stat(entry[key])}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
              Turnovers are shown as recorded — a longer bar means more turnovers, not better play.
            </p>
          </article>

          <article className="card card--pad">
            <div className="subhead">
              <h3>Production shape</h3>
              <span>Scaled to the decade</span>
            </div>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <RadarChart
                axes={RATE_KEYS.map((key) => STAT_LABEL[key])}
                series={radarSeries}
                title="Player-season production shape"
                description={selected
                  .map(
                    (entry) =>
                      `${entry.profile.name} ${seasonLabel(entry.seasonId)}: ${RATE_KEYS.map((key) => `${stat(entry[key])} ${STAT_LABEL[key]}`).join(', ')}`,
                  )
                  .join('. ')}
                size={340}
              />
            </div>
            <div className="radar-legend">
              {selected.map((entry, index) => (
                <span key={entryKey(entry)} className="radar-legend__item">
                  <span
                    className="radar-legend__swatch"
                    style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
                  />
                  {entry.profile.name} {seasonLabel(entry.seasonId)}
                </span>
              ))}
            </div>
            <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
              Each axis is scaled to the highest value any rotation player recorded in that category
              across the ten seasons. Turnovers are excluded from the radar because
              {' '}
              {[...INVERTED_STATS].map((key) => STAT_LABEL[key]).join(', ')} is a lower-is-better stat and
              would invert the shape.
            </p>
          </article>
        </div>
      ) : null}
    </div>
  );
}
