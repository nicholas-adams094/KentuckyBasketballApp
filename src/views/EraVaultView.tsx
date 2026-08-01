import { useMemo, useState } from 'react';
import {
  eraRecord,
  eraSecRecord,
  playerName,
  profileCount,
  RUPP_ARENA_IMAGE,
  seasons,
} from '@/lib/archive';
import {
  BOX_KEYS,
  decadeTotals,
  impactBoard,
  leaderboard,
  multiSeasonCareers,
  opponentRecords,
  STAT_FULL_LABEL,
  STAT_LABEL,
  type BoxKey,
} from '@/lib/analytics';
import { record, seasonLabel, stat, winPct } from '@/lib/format';
import { pathFor, secTournamentTitles } from '@/lib/tournament';
import { LineChart, Sparkline } from '@/components/ui/charts';
import { Icon } from '@/components/ui/Icon';
import { PlayerPortrait } from '@/components/player/PlayerPortrait';
import { POSITIONS } from '@/types/archive';
import { useNavigation } from '@/state/navigation';

const LEADERBOARD_KEYS: BoxKey[] = ['ppg', 'rpg', 'apg', 'spg', 'bpg'];

/**
 * The decade view: everything that spans all ten seasons.
 *
 * The all-decade five is computed from the archive's own numbers rather than typed in
 * by hand — the best player-season at each position by the derived impact rating. That
 * makes it reproducible and clearly a derived opinion, not an official honor.
 */
export function EraVaultView() {
  const { goTo, openPlayer, openOpponentPanel } = useNavigation();
  const [boardKey, setBoardKey] = useState<BoxKey>('ppg');

  const totals = useMemo(() => decadeTotals(), []);
  const rivals = useMemo(() => opponentRecords(), []);
  const careers = useMemo(() => multiSeasonCareers(), []);

  /** Best player-season at each position by derived impact, no player used twice. */
  const allDecadeFive = useMemo(() => {
    const used = new Set<string>();
    return POSITIONS.map((slot) => {
      const pick = impactBoard.find((entry) => {
        if (used.has(entry.id)) return false;
        const pos = entry.profile.pos;
        switch (slot) {
          case 'PG':
            return pos === 'PG' || pos === 'G';
          case 'SG':
            return pos === 'G' || pos === 'G/F';
          case 'SF':
            return pos === 'G/F' || pos === 'F';
          case 'PF':
            return pos === 'F' || pos === 'F/C';
          case 'C':
            return pos === 'C' || pos === 'F/C';
        }
      });
      if (pick) used.add(pick.id);
      return { slot, entry: pick };
    });
  }, []);

  const topRivals = rivals.filter((rival) => rival.games.length >= 4).slice(0, 14);

  return (
    <div className="view">
      <article className="vault-cover">
        {RUPP_ARENA_IMAGE ? (
          <div
            className="vault-cover__bg"
            style={{ backgroundImage: `url("${RUPP_ARENA_IMAGE}")` }}
            aria-hidden="true"
          />
        ) : null}
        <p className="kicker" style={{ color: 'var(--uk-gold)' }}>
          The complete decade
        </p>
        <h2>Ten seasons, one file</h2>
        <p>
          Every Kentucky season coached by Tubby Smith, from the 1998 national championship through the
          final 2007 tournament team — complete rosters, game files, postseason paths, decade
          leaderboards and rival records, all computed from the archive's own data.
        </p>
        <div className="vault-cover__stats">
          <div className="vault-cover__stat">
            <b>{record(eraRecord)}</b>
            <span>Overall record</span>
          </div>
          <div className="vault-cover__stat">
            <b>{record(eraSecRecord)}</b>
            <span>SEC regular season</span>
          </div>
          <div className="vault-cover__stat">
            <b>
              {totals.ncaaWins}–{totals.ncaaLosses}
            </b>
            <span>NCAA Tournament</span>
          </div>
          <div className="vault-cover__stat">
            <b>{totals.titles}</b>
            <span>National title</span>
          </div>
          <div className="vault-cover__stat">
            <b>{totals.secTourneyTitles}</b>
            <span>SEC Tournament titles</span>
          </div>
          <div className="vault-cover__stat">
            <b>{profileCount}</b>
            <span>Player profiles</span>
          </div>
        </div>
      </article>

      <section style={{ marginTop: 'var(--space-8)' }} aria-labelledby="decade-trend">
        <div className="subhead">
          <h3 id="decade-trend">Ten seasons at a glance</h3>
          <span>Wins, scoring and scoring defense</span>
        </div>
        <article className="card card--pad">
          <LineChart
            title="Kentucky wins, points scored and points allowed by season, 1997–98 through 2006–07"
            description={seasons
              .map(
                (item) =>
                  `${seasonLabel(item.id)}: ${item.record[0]} wins, ${stat(item.ppg)} scored, ${stat(item.oppPpg)} allowed`,
              )
              .join('. ')}
            xLabels={seasons.map((item) => item.short)}
            series={[
              { label: 'Wins', points: seasons.map((item, index) => ({ x: index, y: item.record[0] })) },
              { label: 'Points scored', points: seasons.map((item, index) => ({ x: index, y: item.ppg })) },
              { label: 'Points allowed', points: seasons.map((item, index) => ({ x: index, y: item.oppPpg })) },
            ]}
            height={250}
          />
          <div className="radar-legend">
            {['Wins', 'Points scored', 'Points allowed'].map((label, index) => (
              <span key={label} className="radar-legend__item">
                <span
                  className="radar-legend__swatch"
                  style={{ background: ['#1a5cf0', '#f3b93f', '#16a37b'][index] }}
                />
                {label}
              </span>
            ))}
          </div>
        </article>
      </section>

      <div className="grid grid--halves" style={{ marginTop: 'var(--space-6)' }}>
        <article className="card card--pad">
          <div className="subhead">
            <h3>Decade leaderboards</h3>
            <span>Rotation players · 8+ MPG</span>
          </div>
          <div className="chips" style={{ marginBottom: 'var(--space-4)' }} role="group" aria-label="Leaderboard category">
            {LEADERBOARD_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className="chip"
                aria-pressed={boardKey === key}
                onClick={() => setBoardKey(key)}
                title={STAT_FULL_LABEL[key]}
              >
                {STAT_LABEL[key]}
              </button>
            ))}
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {leaderboard(boardKey, { limit: 10 }).map((row) => (
              <button
                key={`${row.entry.id}-${row.entry.seasonId}`}
                type="button"
                className="leaderboard-row"
                onClick={() => openPlayer(row.entry.id)}
              >
                <span className="leaderboard-row__rank">{row.rank}</span>
                <PlayerPortrait playerId={row.entry.id} avatarSize="xs" />
                <span className="leaderboard-row__name">
                  <strong>{row.entry.profile.name}</strong>
                  <span>
                    {seasonLabel(row.entry.seasonId)} · {row.entry.gp} games · {stat(row.entry.mpg)} MPG
                  </span>
                </span>
                <span className="leaderboard-row__value">{stat(row.value)}</span>
              </button>
            ))}
          </div>
          <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
            Single-season leaders. An 8-minutes-per-game floor keeps small-sample lines out, the same way
            a record book qualifies its leaders.
          </p>
        </article>

        <article className="card card--pad">
          <div className="subhead">
            <h3>Rival records</h3>
            <span>Four or more meetings</span>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {topRivals.map((rival) => (
              <button
                key={rival.opponent}
                type="button"
                className="rival-row"
                onClick={() => openOpponentPanel(rival.opponent)}
              >
                <strong>{rival.opponent}</strong>
                <span className="rival-row__record">
                  {rival.wins}–{rival.losses}
                </span>
                <span className="rival-row__meta">
                  {winPct(rival.wins, rival.losses)} · {stat(rival.pointsFor / rival.games.length)}–
                  {stat(rival.pointsAgainst / rival.games.length)}
                </span>
              </button>
            ))}
          </div>
          <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
            Kentucky met {rivals.length} different programs across the decade. Select a rival for the
            full head-to-head history.
          </p>
        </article>
      </div>

      <section style={{ marginTop: 'var(--space-8)' }} aria-labelledby="all-decade">
        <div className="subhead">
          <h3 id="all-decade">All-decade five</h3>
          <span>Derived from the impact rating</span>
        </div>
        <div className="callout" style={{ marginBottom: 'var(--space-4)' }}>
          <Icon name="info" size={16} className="callout__icon" />
          <span>
            <strong>This is a computed opinion, not an official honor.</strong> Each slot is the highest
            derived-impact player-season among players listed at that position, with no player selected
            twice. Change the inputs and the five changes — that is the point.
          </span>
        </div>
        <div className="grid grid--cards">
          {allDecadeFive.map(({ slot, entry }) =>
            entry ? (
              <article key={slot} className="card card--interactive legend-card">
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => openPlayer(entry.id)}
                    style={{ display: 'block', width: '100%' }}
                    aria-label={`Open ${entry.profile.name} profile`}
                  >
                    <PlayerPortrait playerId={entry.id} number={entry.number} showProvenance />
                  </button>
                  <span className="legend-card__role">{slot}</span>
                </div>
                <div className="legend-card__body">
                  <h4>{entry.profile.name}</h4>
                  <p className="legend-card__meta">
                    {seasonLabel(entry.seasonId)} · {entry.profile.pos} · {entry.year}
                  </p>
                  <p className="legend-card__peak">
                    {stat(entry.ppg)} PPG · {stat(entry.rpg)} RPG · {stat(entry.apg)} APG · IMP{' '}
                    {entry.impact}
                  </p>
                </div>
              </article>
            ) : null,
          )}
        </div>
      </section>

      <section style={{ marginTop: 'var(--space-8)' }} aria-labelledby="season-stars">
        <div className="subhead">
          <h3 id="season-stars">Season by season</h3>
          <span>Documented starting five and the decade's arc</span>
        </div>
        <div className="grid grid--wide">
          {seasons.map((item) => {
            const path = pathFor(item.id);
            return (
              <article key={item.id} className="card five-card">
                <div className="five-card__head">
                  <div>
                    <strong>{seasonLabel(item.id)}</strong>
                    <span>
                      {record(item.record)} · {item.finish}
                    </span>
                  </div>
                  <button type="button" className="btn btn--sm" onClick={() => goTo(item.id, 'overview')}>
                    Open
                  </button>
                </div>

                <div className="five-strip">
                  {POSITIONS.map((slot) => {
                    const playerId = item.starters[slot];
                    return (
                      <button
                        key={slot}
                        type="button"
                        className="five-strip__player"
                        onClick={() => openPlayer(playerId)}
                        title={playerName(playerId)}
                      >
                        <PlayerPortrait playerId={playerId} avatarSize="sm" />
                        <span>{slot}</span>
                        <b>{playerName(playerId).split(' ').slice(-1)[0]}</b>
                      </button>
                    );
                  })}
                </div>

                <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
                  {path?.secTitle ? <span className="badge badge--gold">SEC Tournament champions</span> : null}
                  {path?.titleWon ? <span className="badge badge--gold">National champions</span> : null}
                  <span className="badge badge--neutral">#{item.seed} seed</span>
                  <span className="badge badge--neutral">{stat(item.ppg)} PPG</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 'var(--space-8)' }} aria-labelledby="careers">
        <div className="subhead">
          <h3 id="careers">Multi-season careers</h3>
          <span>{careers.length} players · scoring trend by season</span>
        </div>
        <div className="card card--flush">
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                Players with more than one season in the Tubby Smith era, with career averages
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="is-text">
                    Player
                  </th>
                  <th scope="col" className="is-text">
                    Span
                  </th>
                  <th scope="col">Seasons</th>
                  <th scope="col">GP</th>
                  <th scope="col">MPG</th>
                  {BOX_KEYS.map((key) => (
                    <th key={key} scope="col">
                      {STAT_LABEL[key]}
                    </th>
                  ))}
                  <th scope="col" className="is-text">
                    Scoring trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {careers.map((career) => {
                  const played = career.seasons.filter((entry) => entry.gp > 0);
                  return (
                    <tr
                      key={career.playerId}
                      data-clickable="true"
                      onClick={() => openPlayer(career.playerId)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openPlayer(career.playerId);
                        }
                      }}
                    >
                      <td className="is-text">
                        <span className="table__player">
                          <PlayerPortrait playerId={career.playerId} avatarSize="xs" />
                          <strong style={{ fontWeight: 600 }}>{career.name}</strong>
                        </span>
                      </td>
                      <td className="is-text" style={{ color: 'var(--text-muted)' }}>
                        {career.span.replace(/-/g, '–')}
                      </td>
                      <td className="numeric">{career.seasons.length}</td>
                      <td className="numeric">{career.gamesPlayed}</td>
                      <td className="numeric">{stat(career.averages.mpg)}</td>
                      {BOX_KEYS.map((key) => (
                        <td key={key} className="numeric">
                          {stat(career.averages[key])}
                        </td>
                      ))}
                      <td className="is-text">
                        {played.length > 1 ? (
                          <Sparkline
                            values={played.map((entry) => entry.ppg)}
                            title={`${career.name} points per game by season`}
                          />
                        ) : (
                          <span style={{ color: 'var(--text-subtle)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="table__caption">
            Career averages are minutes-weighted across every season in this archive, so a heavy-minute
            senior year counts more than a short freshman appearance.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 'var(--space-8)' }} aria-labelledby="decade-notes">
        <div className="subhead">
          <h3 id="decade-notes">Decade totals</h3>
          <span>Computed from every game record</span>
        </div>
        <div className="grid grid--metrics">
          <article className="metric">
            <p className="metric__label">Games played</p>
            <p className="metric__value">{totals.games}</p>
            <p className="metric__note">
              {totals.pointsFor.toLocaleString('en-US')} points scored ·{' '}
              {totals.pointsAgainst.toLocaleString('en-US')} allowed
            </p>
          </article>
          <article className="metric">
            <p className="metric__label">NCAA appearances</p>
            <p className="metric__value">{totals.ncaaAppearances}</p>
            <p className="metric__note">
              {totals.sweet16s} Sweet 16s · {totals.eliteEights} Elite Eights · {totals.finalFours} Final
              Four
            </p>
          </article>
          <article className="metric">
            <p className="metric__label">SEC Tournament titles</p>
            <p className="metric__value">{totals.secTourneyTitles}</p>
            <p className="metric__note">
              {secTournamentTitles.map((id) => seasonLabel(id)).join(', ')}
            </p>
          </article>
          <article className="metric">
            <p className="metric__label">Average margin</p>
            <p className="metric__value">
              +{((totals.pointsFor - totals.pointsAgainst) / totals.games).toFixed(1)}
            </p>
            <p className="metric__note">Across all {totals.games} games of the era</p>
          </article>
        </div>
      </section>
    </div>
  );
}
