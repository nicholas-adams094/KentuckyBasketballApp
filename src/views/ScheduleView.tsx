import { useMemo } from 'react';
import { seasonGames, type GameEntry } from '@/lib/archive';
import { analyzeSeason } from '@/lib/analytics';
import {
  gameDate,
  LOCATION_LABEL,
  LOCATION_SHORT,
  PHASE_LABEL,
  record,
  seasonLabel,
  signed,
  signedInt,
  stat,
  winPct,
} from '@/lib/format';
import { LineChart } from '@/components/ui/charts';
import { Icon } from '@/components/ui/Icon';
import { isExemptTournamentPhase, isPostseasonPhase } from '@/types/archive';
import { useNavigation } from '@/state/navigation';
import { useToast } from '@/state/toast';

const FILTERS = [
  'All',
  'Wins',
  'Losses',
  'Home',
  'Away',
  'Neutral',
  'SEC',
  'Non-conference',
  'Early-season event',
  'SEC Tournament',
  'NCAA Tournament',
  'Overtime',
  'Close games',
] as const;

type Filter = (typeof FILTERS)[number];

function applyFilter(games: readonly GameEntry[], filter: Filter): readonly GameEntry[] {
  switch (filter) {
    case 'Wins':
      return games.filter((g) => g.result === 'W');
    case 'Losses':
      return games.filter((g) => g.result === 'L');
    case 'Home':
      return games.filter((g) => g.loc === 'H');
    case 'Away':
      return games.filter((g) => g.loc === 'A');
    case 'Neutral':
      return games.filter((g) => g.loc === 'N');
    // Conference play is decided by the `sec` flag, not the phase string: the named
    // early-season events are regular-season games too, and are never SEC games.
    case 'SEC':
      return games.filter((g) => g.sec && !isPostseasonPhase(g.phase));
    case 'Non-conference':
      return games.filter((g) => !g.sec && !isPostseasonPhase(g.phase));
    case 'Early-season event':
      return games.filter((g) => isExemptTournamentPhase(g.phase));
    case 'SEC Tournament':
      return games.filter((g) => g.phase === 'SEC Tournament');
    case 'NCAA Tournament':
      return games.filter((g) => g.phase === 'NCAA Tournament');
    case 'Overtime':
      return games.filter((g) => Boolean(g.overtime));
    case 'Close games':
      return games.filter((g) => Math.abs(g.margin) <= 5);
    case 'All':
    default:
      return games;
  }
}

/** The complete season schedule with filters, search, a record trace and CSV export. */
export function ScheduleView() {
  const { season, getParam, setParam, openOpponentPanel } = useNavigation();
  const { push } = useToast();

  const filter = (getParam('filter') as Filter) ?? 'All';
  const search = getParam('q') ?? '';
  const highlightGame = Number(getParam('game') ?? 0);

  const games = useMemo(() => seasonGames(season.id), [season.id]);
  const analysis = useMemo(() => analyzeSeason(season), [season]);

  const rows = useMemo(() => {
    let filtered = applyFilter(games, filter);
    const needle = search.trim().toLowerCase();
    if (needle) filtered = filtered.filter((game) => game.opponent.toLowerCase().includes(needle));
    return filtered;
  }, [games, filter, search]);

  const filterCounts = useMemo(
    () => Object.fromEntries(FILTERS.map((option) => [option, applyFilter(games, option).length])),
    [games],
  );

  const wins = rows.filter((g) => g.result === 'W').length;
  const losses = rows.length - wins;
  const pointsFor = rows.reduce((a, g) => a + g.uk, 0);
  const pointsAgainst = rows.reduce((a, g) => a + g.opp, 0);

  const exportCsv = () => {
    const header = ['Game', 'Date', 'Site', 'Opponent', 'Result', 'UK', 'Opp', 'Margin', 'Phase', 'Note', 'Overtime'];
    const lines = rows.map((game) =>
      [
        game.gameNumber,
        game.date,
        LOCATION_LABEL[game.loc],
        game.opponent,
        game.result,
        game.uk,
        game.opp,
        game.margin,
        game.phase,
        game.note ?? '',
        game.overtime ?? '',
      ]
        .map((cell) => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : String(cell)))
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kentucky-${season.id}-schedule.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    push(`Exported ${rows.length} games as CSV.`, 'success');
  };

  const maxMargin = Math.max(1, ...games.map((g) => Math.abs(g.margin)));

  return (
    <div className="view">
      <div className="section-head">
        <div className="section-head__body">
          <span className="kicker">Every game, one table</span>
          <h2>{seasonLabel(season.id)} schedule &amp; results</h2>
          <p>
            All {games.length} games with venue, score, margin and competition stage. SEC regular-season
            games, SEC Tournament games and NCAA Tournament games are kept distinct throughout.
          </p>
        </div>
        <button type="button" className="btn btn--sm" onClick={exportCsv} data-print="hide">
          <Icon name="download" size={14} />
          Export CSV
        </button>
      </div>

      <div className="toolbar" data-print="hide">
        <div className="chips" role="group" aria-label="Filter games">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={filter === option}
              disabled={filterCounts[option] === 0}
              // Without an explicit label the count runs straight onto the text and the
              // accessible name comes out as "SEC16".
              aria-label={`${option} — ${filterCounts[option]} game${filterCounts[option] === 1 ? '' : 's'}`}
              onClick={() => setParam('filter', option === 'All' ? null : option)}
            >
              {option}
              {option !== 'All' ? <span className="chip__count">{filterCounts[option]}</span> : null}
            </button>
          ))}
        </div>

        <span className="spacer" />

        <div className="field">
          <span className="field__icon">
            <Icon name="search" size={15} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder="Find an opponent…"
            aria-label="Search opponents"
          />
        </div>
      </div>

      <div className="schedule-summary">
        <article className="metric">
          <p className="metric__label">Filtered record</p>
          <p className="metric__value">{record([wins, losses])}</p>
          <p className="metric__note">
            {rows.length} game{rows.length === 1 ? '' : 's'} · {winPct(wins, losses)}
          </p>
        </article>
        <article className="metric">
          <p className="metric__label">Points per game</p>
          <p className="metric__value">{rows.length ? stat(pointsFor / rows.length) : '—'}</p>
          <p className="metric__note">{pointsFor} total points scored</p>
        </article>
        <article className="metric">
          <p className="metric__label">Opponent points</p>
          <p className="metric__value">{rows.length ? stat(pointsAgainst / rows.length) : '—'}</p>
          <p className="metric__note">{pointsAgainst} total points allowed</p>
        </article>
        <article className="metric">
          <p className="metric__label">Average margin</p>
          <p className="metric__value">
            {rows.length ? signed((pointsFor - pointsAgainst) / rows.length) : '—'}
          </p>
          <p className="metric__note">Across the filtered set</p>
        </article>
      </div>

      <article className="card card--pad" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="subhead">
          <h3>Record trace</h3>
          <span>Games above .500 after each game</span>
        </div>
        <LineChart
          title={`${seasonLabel(season.id)} cumulative record trace`}
          description={`Running win-loss differential across all ${games.length} games, finishing at ${
            analysis.trace[analysis.trace.length - 1]?.diff ?? 0
          }.`}
          xLabels={['Game 1', `Game ${Math.round(games.length / 2)}`, `Game ${games.length}`]}
          series={[{ label: 'Games above .500', points: analysis.trace.map((t) => ({ x: t.game, y: t.diff })) }]}
          height={190}
          zeroLine
        />
      </article>

      {rows.length === 0 ? (
        <div className="card empty-state">
          <Icon name="calendar" size={28} />
          <h3>No games match these filters</h3>
          <p>Try a different filter or clear the opponent search.</p>
        </div>
      ) : (
        <div className="card card--flush">
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                {seasonLabel(season.id)} Kentucky Wildcats game results
              </caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col" className="is-text">
                    Date
                  </th>
                  <th scope="col" className="is-text">
                    Opponent
                  </th>
                  <th scope="col">Result</th>
                  <th scope="col">Score</th>
                  <th scope="col" className="is-text">
                    Margin
                  </th>
                  <th scope="col" className="is-text">
                    Stage
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((game) => (
                  <tr
                    key={`${game.gameNumber}-${game.date}`}
                    className={highlightGame === game.gameNumber ? 'game-row--highlight' : undefined}
                  >
                    <td className="numeric" style={{ color: 'var(--text-subtle)' }}>
                      {game.gameNumber}
                    </td>
                    <td className="is-text" style={{ color: 'var(--text-muted)' }}>
                      {gameDate(game.date)}
                    </td>
                    <td className="is-text">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        style={{ padding: 0, fontWeight: 600 }}
                        onClick={() => openOpponentPanel(game.opponent)}
                        title={`Kentucky's full record against ${game.opponent}`}
                      >
                        <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>
                          {LOCATION_SHORT[game.loc]}
                        </span>
                        {game.opponent}
                      </button>
                      {game.overtime ? (
                        <span className="badge badge--neutral" style={{ marginLeft: 'var(--space-2)' }}>
                          {game.overtime}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge badge--${game.result === 'W' ? 'win' : 'loss'}`}>
                        {game.result === 'W' ? 'Win' : 'Loss'}
                      </span>
                    </td>
                    <td className="numeric" style={{ fontWeight: 650 }}>
                      {game.uk}–{game.opp}
                    </td>
                    <td>
                      <span className="margin-cell">
                        <span className="margin-bar">
                          <span className="margin-bar__center" />
                          <span
                            className={`margin-bar__fill margin-bar__fill--${game.result === 'W' ? 'w' : 'l'}`}
                            style={{ width: `${(Math.abs(game.margin) / maxMargin) * 50}%` }}
                          />
                        </span>
                        <span className="numeric" style={{ minWidth: '3ch' }}>
                          {signedInt(game.margin)}
                        </span>
                      </span>
                    </td>
                    <td className="is-text" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                      {game.note ||
                        (isExemptTournamentPhase(game.phase)
                          ? PHASE_LABEL[game.phase]
                          : game.sec
                            ? 'SEC regular season'
                            : 'Non-conference')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table__caption">
            Site is shown as “vs” for home and neutral games and “at” for road games. Select an opponent
            to see Kentucky's complete record against that program across the decade.
          </p>
        </div>
      )}
    </div>
  );
}
