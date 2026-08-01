import { useId, useMemo } from 'react';
import { opponentRecords } from '@/lib/analytics';
import {
  gameDate,
  LOCATION_SHORT,
  PHASE_LABEL,
  record,
  seasonLabel,
  signedInt,
  stat,
  winPct,
} from '@/lib/format';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { isExemptTournamentPhase, isPostseasonPhase } from '@/types/archive';
import { useNavigation } from '@/state/navigation';

/** Kentucky's complete head-to-head record against one program across the decade. */
export function OpponentDialog() {
  const { openOpponent, closeOpponentPanel, goTo } = useNavigation();
  const titleId = useId();

  const rival = useMemo(
    () => (openOpponent ? opponentRecords().find((item) => item.opponent === openOpponent) : undefined),
    [openOpponent],
  );

  if (!openOpponent) return null;

  if (!rival) {
    return (
      <Dialog open onClose={closeOpponentPanel} labelledBy={titleId}>
        <div className="card--pad" style={{ padding: 'var(--space-8)' }}>
          <h2 id={titleId} style={{ fontFamily: 'var(--font-display)' }}>
            {openOpponent}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-3)' }}>
            Kentucky has no recorded games against this opponent in the Tubby Smith archive.
          </p>
        </div>
      </Dialog>
    );
  }

  const games = [...rival.games].sort((a, b) => a.date.localeCompare(b.date));
  const homeWins = games.filter((g) => g.loc === 'H' && g.result === 'W').length;
  const homeGames = games.filter((g) => g.loc === 'H').length;
  const awayWins = games.filter((g) => g.loc === 'A' && g.result === 'W').length;
  const awayGames = games.filter((g) => g.loc === 'A').length;
  const postseason = games.filter((g) => isPostseasonPhase(g.phase));

  return (
    <Dialog open onClose={closeOpponentPanel} labelledBy={titleId} closeLabel={`Close ${rival.opponent} record`}>
      <div style={{ padding: 'var(--space-6)' }}>
        <span className="kicker">Head to head · 1997–2007</span>
        <h2 id={titleId} style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)' }}>
          Kentucky vs {rival.opponent}
        </h2>

        <div className="grid grid--metrics" style={{ marginTop: 'var(--space-5)' }}>
          <article className="metric">
            <p className="metric__label">Series record</p>
            <p className="metric__value">{record([rival.wins, rival.losses])}</p>
            <p className="metric__note">
              {winPct(rival.wins, rival.losses)} across {games.length} meetings
            </p>
          </article>
          <article className="metric">
            <p className="metric__label">Scoring</p>
            <p className="metric__value">
              {stat(rival.pointsFor / games.length)}–{stat(rival.pointsAgainst / games.length)}
            </p>
            <p className="metric__note">Average score per meeting</p>
          </article>
          <article className="metric">
            <p className="metric__label">Home / away</p>
            <p className="metric__value">
              {homeWins}/{homeGames} · {awayWins}/{awayGames}
            </p>
            <p className="metric__note">Wins by venue</p>
          </article>
          <article className="metric">
            <p className="metric__label">Postseason</p>
            <p className="metric__value">{postseason.length}</p>
            <p className="metric__note">
              {postseason.length === 0
                ? 'No tournament meetings'
                : postseason.map((g) => g.note || g.phase).join(', ')}
            </p>
          </article>
        </div>

        <div className="card card--flush" style={{ marginTop: 'var(--space-5)' }}>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                Every Kentucky game against {rival.opponent} in the Tubby Smith era
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="is-text">
                    Season
                  </th>
                  <th scope="col" className="is-text">
                    Date
                  </th>
                  <th scope="col" className="is-text">
                    Site
                  </th>
                  <th scope="col">Result</th>
                  <th scope="col">Score</th>
                  <th scope="col">Margin</th>
                  <th scope="col" className="is-text">
                    Stage
                  </th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr key={`${game.seasonId}-${game.date}`}>
                    <td className="is-text">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        style={{ padding: 0, fontWeight: 600 }}
                        onClick={() => {
                          closeOpponentPanel();
                          goTo(game.seasonId, 'schedule');
                        }}
                      >
                        {seasonLabel(game.seasonId)}
                      </button>
                    </td>
                    <td className="is-text" style={{ color: 'var(--text-muted)' }}>
                      {gameDate(game.date)}
                    </td>
                    <td className="is-text" style={{ color: 'var(--text-muted)' }}>
                      {LOCATION_SHORT[game.loc]} {game.loc === 'N' ? '(neutral)' : ''}
                    </td>
                    <td>
                      <span className={`badge badge--${game.result === 'W' ? 'win' : 'loss'}`}>
                        {game.result === 'W' ? 'Win' : 'Loss'}
                      </span>
                    </td>
                    <td className="numeric" style={{ fontWeight: 650 }}>
                      {game.uk}–{game.opp}
                    </td>
                    <td className="numeric">{signedInt(game.margin)}</td>
                    <td className="is-text" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {game.note ||
                        (isExemptTournamentPhase(game.phase)
                          ? PHASE_LABEL[game.phase]
                          : game.sec
                            ? 'SEC regular season'
                            : 'Non-conference')}
                      {game.overtime ? ` · ${game.overtime}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="row" style={{ marginTop: 'var(--space-5)' }} data-print="hide">
          <button type="button" className="btn" onClick={closeOpponentPanel}>
            <Icon name="chevron-left" size={14} />
            Back to the archive
          </button>
        </div>
      </div>
    </Dialog>
  );
}
