import { useEffect, useMemo, useState } from 'react';
import { allPlayerSeasons, playerName, playerSurname } from '@/lib/archive';
import { BOX_KEYS, evaluateLineup, optimizeLineup, STAT_LABEL } from '@/lib/analytics';
import { seasonLabel, stat } from '@/lib/format';
import { POSITIONS, type Position } from '@/types/archive';
import { Icon } from '@/components/ui/Icon';
import { PlayerPortrait } from '@/components/player/PlayerPortrait';
import { useNavigation } from '@/state/navigation';
import { usePreferences } from '@/state/preferences';
import { useToast } from '@/state/toast';

const SLOT_LABEL: Record<Position, string> = {
  PG: 'Point guard',
  SG: 'Shooting guard',
  SF: 'Small forward',
  PF: 'Power forward',
  C: 'Center',
};

const PRESETS = [
  { id: 'documented', label: 'Documented starters', icon: 'clipboard' },
  { id: 'balanced', label: 'Best overall', icon: 'basketball' },
  { id: 'offense', label: 'Best offense', icon: 'flame' },
  { id: 'defense', label: 'Best defense', icon: 'shield' },
  { id: 'passing', label: 'Best passing', icon: 'zap' },
] as const;

/** Serialise a lineup into the URL so a five-man unit is shareable. */
function encodeLineup(lineup: Partial<Record<Position, string>>): string {
  return POSITIONS.map((slot) => lineup[slot] ?? '').join('|');
}

function decodeLineup(value: string | null): Partial<Record<Position, string>> | null {
  if (!value) return null;
  const parts = value.split('|');
  if (parts.length !== POSITIONS.length) return null;
  const out: Partial<Record<Position, string>> = {};
  POSITIONS.forEach((slot, index) => {
    if (parts[index]) out[slot] = parts[index];
  });
  return out;
}

/** Build a five, score it against the decade, save it and share it. */
export function LineupLabView() {
  const { season, getParam, setParam, openPlayer } = useNavigation();
  const { savedLineups, saveLineup, deleteLineup, persistenceAvailable } = usePreferences();
  const { push } = useToast();

  const roster = useMemo(
    () => allPlayerSeasons.filter((entry) => entry.seasonId === season.id && entry.gp > 0),
    [season.id],
  );

  const rosterIds = useMemo(() => new Set(roster.map((entry) => entry.id)), [roster]);

  const [lineup, setLineup] = useState<Partial<Record<Position, string>>>(() => ({ ...season.starters }));

  // Restore from the URL when possible, otherwise reset to the documented starters.
  // Dropping ids that are not on this roster keeps a stale shared link from producing
  // an impossible five.
  useEffect(() => {
    const fromUrl = decodeLineup(getParam('five'));
    if (fromUrl) {
      const cleaned: Partial<Record<Position, string>> = {};
      for (const slot of POSITIONS) {
        const id = fromUrl[slot];
        if (id && rosterIds.has(id)) cleaned[slot] = id;
      }
      if (Object.keys(cleaned).length > 0) {
        setLineup(cleaned);
        return;
      }
    }
    setLineup({ ...season.starters });
    // `getParam` is intentionally excluded: this should run on a season change or an
    // externally-supplied link, not on every unrelated query-string edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id, rosterIds]);

  const evaluation = useMemo(() => evaluateLineup(lineup, season.id), [lineup, season.id]);
  const documented = useMemo(() => evaluateLineup(season.starters, season.id), [season]);

  const applyLineup = (next: Partial<Record<Position, string>>) => {
    setLineup(next);
    setParam('five', encodeLineup(next));
  };

  const setSlot = (slot: Position, playerId: string) => applyLineup({ ...lineup, [slot]: playerId });

  const copyShareLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/season/${season.id}/lineup?five=${encodeURIComponent(encodeLineup(lineup))}`;
    try {
      await navigator.clipboard.writeText(url);
      push('Shareable lineup link copied.', 'success');
    } catch {
      push(url, 'info');
    }
  };

  const seasonSaved = savedLineups.filter((item) => item.seasonId === season.id);

  return (
    <div className="view">
      <div className="section-head">
        <div className="section-head__body">
          <span className="kicker">Interactive rotation builder</span>
          <h2>{seasonLabel(season.id)} Lineup Lab</h2>
          <p>
            Start from the documented depth chart, then build any five from this roster. The rating is a
            derived fan metric built from era-relative production, positional fit and ball security — this
            archive has no possession data, so it is not an efficiency rating.
          </p>
        </div>
      </div>

      <div className="lineup-layout">
        <article className="card court-card">
          <div className="court-toolbar" data-print="hide">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  applyLineup(optimizeLineup(season.id, preset.id));
                  push(`Loaded the ${preset.label.toLowerCase()} five.`);
                }}
              >
                <Icon name={preset.icon} size={14} />
                {preset.label}
              </button>
            ))}
            <span className="spacer" />
            <button type="button" className="btn btn--sm" onClick={copyShareLink}>
              <Icon name="link" size={14} />
              Share
            </button>
          </div>

          <div className="court">
            {POSITIONS.map((slot) => {
              const selectedId = lineup[slot];
              const player = roster.find((entry) => entry.id === selectedId);
              return (
                <div key={slot} className="court__slot" data-slot={slot}>
                  <div className="slot-card">
                    <div className="slot-card__head">
                      <span className="slot-card__pos">{slot}</span>
                      <span className="slot-card__role">{SLOT_LABEL[slot]}</span>
                    </div>
                    <select
                      className="select"
                      value={selectedId ?? ''}
                      onChange={(event) => setSlot(slot, event.target.value)}
                      aria-label={`${SLOT_LABEL[slot]} selection`}
                    >
                      <option value="">— empty —</option>
                      {roster.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          #{entry.number} {entry.profile.name} · {entry.profile.pos}
                        </option>
                      ))}
                    </select>
                    <div className="slot-card__stats">
                      <span>{player ? `${stat(player.ppg)} PPG` : '—'}</span>
                      <b>{player ? `${stat(player.apg)} AST` : '—'}</b>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {evaluation.duplicates > 0 ? (
            <div className="callout callout--gold" style={{ marginTop: 'var(--space-4)' }}>
              <Icon name="alert" size={16} className="callout__icon" />
              <span>
                <strong>A player is selected in more than one slot.</strong> Pick five different players
                for a valid unit.
              </span>
            </div>
          ) : null}

          <div className="grid grid--cards" style={{ marginTop: 'var(--space-5)' }}>
            {evaluation.players.map((player) => (
              <button
                key={player.id}
                type="button"
                className="card card--interactive leader-card"
                onClick={() => openPlayer(player.id)}
              >
                <PlayerPortrait playerId={player.id} avatarSize="sm" />
                <span className="leader-card__meta">
                  <span className="leader-card__label">
                    #{player.number} · {player.profile.pos}
                  </span>
                  <span className="leader-card__name">{player.profile.name}</span>
                  <span className="leader-card__value">{stat(player.mpg)} MPG</span>
                </span>
              </button>
            ))}
          </div>
        </article>

        <aside className="stack">
          <article className="card card--pad">
            <div className="subhead">
              <h3>Lineup readout</h3>
              <span>Derived fan metric</span>
            </div>
            <div className="lineup-readout">
              <div className="score-ring" style={{ '--score': evaluation.score } as React.CSSProperties}>
                <b>{evaluation.score}</b>
              </div>
              <div className="lineup-readout__copy">
                <strong>{evaluation.verdict}</strong>
                <span>
                  Documented starters score {documented.score}. Positional fit{' '}
                  {Math.round(evaluation.fit * 100)}%.
                </span>
              </div>
            </div>

            <div className="lineup-metrics">
              {BOX_KEYS.map((key) => (
                <div key={key} className="lineup-metric">
                  <b>{stat(evaluation.totals[key])}</b>
                  <span>{STAT_LABEL[key]}</span>
                </div>
              ))}
            </div>

            <div className="chips" style={{ marginTop: 'var(--space-4)' }}>
              {evaluation.tags.map((tag) => (
                <span key={tag} className="badge badge--accent">
                  {tag}
                </span>
              ))}
            </div>

            <div className="row" style={{ marginTop: 'var(--space-4) ' }} data-print="hide">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={evaluation.players.length < 5 || evaluation.duplicates > 0}
                onClick={() => {
                  saveLineup({
                    seasonId: season.id,
                    name: `${seasonLabel(season.id)} custom five`,
                    lineup,
                    score: evaluation.score,
                  });
                  push(
                    persistenceAvailable
                      ? 'Lineup saved in this browser.'
                      : 'Lineup saved for this session only — browser storage is unavailable.',
                    persistenceAvailable ? 'success' : 'warning',
                  );
                }}
              >
                <Icon name="save" size={14} />
                Save lineup
              </button>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => applyLineup({ ...season.starters })}
              >
                Reset
              </button>
            </div>
          </article>

          <article className="card card--pad">
            <div className="subhead">
              <h3>Documented depth chart</h3>
              <span>From the archive</span>
            </div>
            {/* Six columns of surnames exceed a phone's width; the table scrolls inside
                its own container rather than widening the page. */}
            <div className="scroll-x">
              <table className="depth-table">
                <caption className="visually-hidden">
                  {seasonLabel(season.id)} documented starters and rotation by position
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    {POSITIONS.map((slot) => (
                      <th key={slot} scope="col">
                        {slot}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Starters</th>
                    {POSITIONS.map((slot) => (
                      <td key={slot} className="is-starter">
                        {playerSurname(season.starters[slot])}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Rotation</th>
                    {POSITIONS.map((slot, index) => (
                      <td key={slot}>
                        {season.rotation[index] ? playerSurname(season.rotation[index]) : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
              The rotation row lists the season's documented rotation players in archive order; it is not
              a strict per-position backup chart.
            </p>
          </article>

          <article className="card card--pad">
            <div className="subhead">
              <h3>My saved lineups</h3>
              <span>{seasonSaved.length} for this season</span>
            </div>
            {seasonSaved.length === 0 ? (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
                No saved lineups yet for {seasonLabel(season.id)}. Build a five and select “Save lineup”.
              </p>
            ) : (
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {seasonSaved.map((item) => (
                  <div key={item.id} className="saved-lineup">
                    <div className="saved-lineup__body">
                      <strong>
                        {item.name} · {item.score}
                      </strong>
                      <span>
                        {POSITIONS.map((slot) => item.lineup[slot])
                          .filter(Boolean)
                          .map((id) => playerSurname(id as string))
                          .join(' · ')}
                      </span>
                    </div>
                    <div className="row" style={{ gap: 'var(--space-1)' }}>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => applyLineup(item.lineup)}
                        aria-label={`Load ${item.name}`}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          deleteLineup(item.id);
                          push('Lineup deleted.');
                        }}
                        aria-label={`Delete ${item.name}`}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!persistenceAvailable ? (
              <div className="callout" style={{ marginTop: 'var(--space-3)' }}>
                <Icon name="info" size={15} className="callout__icon" />
                <span>Browser storage is unavailable, so saved lineups will not survive a reload.</span>
              </div>
            ) : null}
          </article>

          <article className="card card--pad">
            <div className="subhead">
              <h3>How the rating works</h3>
              <span>Method</span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
              Each player's era-relative production is scored against every rotation player-season of the
              decade, then averaged across the five. Positional fit adds up to 22 points, creation adds a
              capped bonus for assists, and turnovers above a normal team load subtract. A duplicated
              player costs 22 points because the unit is not legal. The archive stores only per-game rate
              statistics, so no possession, shooting-split or on/off information is involved.
            </p>
          </article>
        </aside>
      </div>

      <p className="visually-hidden" aria-live="polite">
        Lineup rating {evaluation.score} out of 99. {evaluation.verdict}. Selected:{' '}
        {evaluation.players.map((player) => playerName(player.id)).join(', ')}.
      </p>
    </div>
  );
}
