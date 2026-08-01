import { useMemo } from 'react';
import { seasons } from '@/lib/archive';
import { gameDate, LOCATION_SHORT, record, seasonLabel, signedInt } from '@/lib/format';
import {
  NCAA_ROUND_SHORT,
  NCAA_ROUNDS,
  pathFor,
  postseasonPaths,
  type NcaaRound,
} from '@/lib/tournament';
import { Icon } from '@/components/ui/Icon';
import { useNavigation } from '@/state/navigation';

/** SEC and NCAA Tournament paths for the season, plus the decade-wide postseason map. */
export function PostseasonView() {
  const { season, goTo, openOpponentPanel } = useNavigation();
  const path = pathFor(season.id);

  const decadeNcaa = useMemo(() => {
    const games = postseasonPaths.flatMap((p) => p.ncaa);
    return {
      wins: games.filter((b) => b.game.result === 'W').length,
      losses: games.filter((b) => b.game.result === 'L').length,
    };
  }, []);

  const decadeSec = useMemo(() => {
    const games = postseasonPaths.flatMap((p) => p.sec);
    return {
      wins: games.filter((b) => b.game.result === 'W').length,
      losses: games.filter((b) => b.game.result === 'L').length,
      titles: postseasonPaths.filter((p) => p.secTitle).length,
    };
  }, []);

  if (!path) return null;

  return (
    <div className="view">
      <div className="section-head">
        <div className="section-head__body">
          <span className="kicker">March, game by game</span>
          <h2>{seasonLabel(season.id)} postseason</h2>
          <p>
            Kentucky entered the NCAA Tournament as a #{season.seed} seed and finished as{' '}
            {season.finish}. Round labels are normalised across seasons — the archive's own notes use
            different wording from year to year, and the underlying game records are left untouched.
          </p>
        </div>
      </div>

      <div className="grid grid--metrics" style={{ marginBottom: 'var(--space-6)' }}>
        <article className="metric">
          <p className="metric__label">SEC Tournament</p>
          <p className="metric__value">
            {path.sec.filter((b) => b.game.result === 'W').length}–
            {path.sec.filter((b) => b.game.result === 'L').length}
          </p>
          <p className="metric__note">
            {path.secTitle ? 'Champions' : path.secRunnerUp ? 'Runner-up' : `Eliminated in the ${path.sec[path.sec.length - 1]?.round ?? '—'}`}
          </p>
        </article>
        <article className="metric">
          <p className="metric__label">NCAA Tournament</p>
          <p className="metric__value">
            {path.ncaa.filter((b) => b.game.result === 'W').length}–
            {path.ncaa.filter((b) => b.game.result === 'L').length}
          </p>
          <p className="metric__note">#{season.seed} seed · {season.finish}</p>
        </article>
        <article className="metric">
          <p className="metric__label">Decade NCAA record</p>
          <p className="metric__value">{record([decadeNcaa.wins, decadeNcaa.losses])}</p>
          <p className="metric__note">Across all ten Tubby Smith tournaments</p>
        </article>
        <article className="metric">
          <p className="metric__label">Decade SEC Tournament</p>
          <p className="metric__value">{record([decadeSec.wins, decadeSec.losses])}</p>
          <p className="metric__note">{decadeSec.titles} championships</p>
        </article>
      </div>

      {path.sec.length > 0 ? (
        <section aria-labelledby="sec-bracket" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="subhead">
            <h3 id="sec-bracket">SEC Tournament path</h3>
            <span>{path.secTitle ? 'Championship won' : 'Eliminated'}</span>
          </div>
          <div className="bracket">
            {path.sec.map((node) => (
              <BracketCard
                key={`${node.round}-${node.game.date}`}
                round={node.round}
                game={node.game}
                onOpponent={openOpponentPanel}
              />
            ))}
          </div>
        </section>
      ) : null}

      {path.ncaa.length > 0 ? (
        <section aria-labelledby="ncaa-bracket" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="subhead">
            <h3 id="ncaa-bracket">NCAA Tournament path</h3>
            <span>
              {path.titleWon
                ? 'National champions'
                : `Eliminated in the ${path.deepestNcaaRound ?? 'tournament'}`}
            </span>
          </div>
          <div className="bracket">
            {path.ncaa.map((node) => (
              <BracketCard
                key={`${node.round}-${node.game.date}`}
                round={node.round}
                game={node.game}
                onOpponent={openOpponentPanel}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="card empty-state">
          <Icon name="trophy" size={28} />
          <h3>No NCAA Tournament games recorded</h3>
          <p>This season's archive contains no NCAA Tournament game records.</p>
        </div>
      )}

      <section aria-labelledby="decade-paths">
        <div className="subhead">
          <h3 id="decade-paths">Every March of the decade</h3>
          <span>Deepest round reached</span>
        </div>
        <div className="card card--pad">
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            {seasons.map((item) => {
              const itemPath = pathFor(item.id);
              if (!itemPath) return null;
              const reachedIndex = itemPath.deepestNcaaRound
                ? NCAA_ROUNDS.indexOf(itemPath.deepestNcaaRound)
                : -1;

              return (
                <div
                  key={item.id}
                  className="row wrap"
                  style={{
                    gap: 'var(--space-3)',
                    paddingBottom: 'var(--space-3)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn--sm"
                    style={{ minWidth: 108, justifyContent: 'flex-start' }}
                    onClick={() => goTo(item.id, 'postseason')}
                    aria-current={item.id === season.id ? 'true' : undefined}
                  >
                    <strong>{seasonLabel(item.id)}</strong>
                    <span style={{ color: 'var(--text-subtle)' }}>#{item.seed}</span>
                  </button>

                  <div className="path-strip">
                    {NCAA_ROUNDS.map((round, index) => {
                      const node = itemPath.ncaa.find((b) => b.round === round);
                      const state = node
                        ? node.game.result === 'W'
                          ? 'w'
                          : 'l'
                        : index <= reachedIndex
                          ? 'w'
                          : 'out';
                      return (
                        <span key={round} className="path-strip">
                          {index > 0 ? (
                            <span className="path-arrow" aria-hidden="true">
                              ›
                            </span>
                          ) : null}
                          <span
                            className={`path-node path-node--${state}`}
                            title={
                              node
                                ? `${round}: ${node.game.result === 'W' ? 'beat' : 'lost to'} ${node.game.opponent} ${node.game.uk}–${node.game.opp}`
                                : `${round}: did not reach`
                            }
                          >
                            {NCAA_ROUND_SHORT[round]}
                          </span>
                        </span>
                      );
                    })}
                  </div>

                  <span className="spacer" />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {item.finish}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

interface BracketCardProps {
  round: NcaaRound | string;
  game: { opponent: string; result: 'W' | 'L'; uk: number; opp: number; date: string; loc: 'H' | 'A' | 'N'; overtime?: string };
  onOpponent: (opponent: string) => void;
}

function BracketCard({ round, game, onOpponent }: BracketCardProps) {
  return (
    <article className={`bracket-game bracket-game--${game.result.toLowerCase()}`}>
      <p className="bracket-game__round">{round}</p>
      <p className="bracket-game__score">
        <span className={game.result === 'W' ? undefined : 'numeric'} style={{ color: 'var(--text-strong)' }}>
          {game.uk}
        </span>
        <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>–</span>
        <span style={{ color: 'var(--text-muted)' }}>{game.opp}</span>
        <span className={`badge badge--${game.result === 'W' ? 'win' : 'loss'}`} style={{ marginLeft: 'auto' }}>
          {game.result === 'W' ? 'Win' : 'Loss'}
        </span>
      </p>
      <button
        type="button"
        className="bracket-game__opponent"
        style={{ textAlign: 'left' }}
        onClick={() => onOpponent(game.opponent)}
      >
        <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>{LOCATION_SHORT[game.loc]} </span>
        {game.opponent}
      </button>
      <p className="bracket-game__meta">
        {gameDate(game.date)} · {signedInt(game.uk - game.opp)}
        {game.overtime ? ` · ${game.overtime}` : ''}
      </p>
    </article>
  );
}
