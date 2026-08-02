import { TUBBY_SMITH_IMAGE, teamImageUrl } from '@/lib/archive';
import { analyzeSeason, seasonLeader, STAT_FULL_LABEL, type BoxKey } from '@/lib/analytics';
import {
  apRank,
  gameDateShort,
  ordinal,
  record,
  seasonLabel,
  signed,
  signedInt,
  stat,
  winPct,
  winPctNumber,
} from '@/lib/format';
import { MarginBars, Meter } from '@/components/ui/charts';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PlayerPortrait } from '@/components/player/PlayerPortrait';
import { useNavigation } from '@/state/navigation';

const LEADER_SLOTS: { key: BoxKey; label: string }[] = [
  { key: 'ppg', label: 'Points' },
  { key: 'rpg', label: 'Rebounds' },
  { key: 'apg', label: 'Assists' },
  { key: 'spg', label: 'Steals' },
  { key: 'bpg', label: 'Blocks' },
];

const MOMENT_ICONS: IconName[] = ['trophy', 'flame', 'zap', 'shield'];

/** Season command centre: identity, metrics, leaders, form and honors. */
export function OverviewView() {
  const { season, openPlayer, goToView } = useNavigation();
  const analysis = analyzeSeason(season);
  const [wins, losses] = season.record;
  const teamImage = teamImageUrl(season);

  const dna: { label: string; fraction: number; display: string }[] = [
    { label: 'Win rate', fraction: winPctNumber(wins, losses), display: winPct(wins, losses) },
    {
      label: 'SEC win rate',
      fraction: winPctNumber(season.secRecord[0], season.secRecord[1]),
      display: winPct(season.secRecord[0], season.secRecord[1]),
    },
    // Scale offense/defense against the decade's own range so the bars compare seasons
    // to each other rather than to an arbitrary constant.
    { label: 'Scoring', fraction: (season.ppg - 65) / 20, display: stat(season.ppg) },
    { label: 'Scoring defense', fraction: (78 - season.oppPpg) / 18, display: stat(season.oppPpg) },
    { label: 'Point margin', fraction: season.margin / 16, display: signed(season.margin) },
  ];

  return (
    <div className="view">
      <div className="section-head">
        <div className="section-head__body">
          <span className="kicker">Season command center</span>
          <h2>{seasonLabel(season.id)} at a glance</h2>
          <p>
            Records, team identity, statistical leaders, defining results and honors for the selected
            season. Every figure below comes from the archive's stored data; ranks compare this season
            against the other nine of the Tubby Smith decade.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => window.print()} data-print="hide">
          <Icon name="print" size={15} />
          Print season file
        </button>
      </div>

      <div className="grid grid--metrics">
        <article className="metric">
          <p className="metric__label">Overall record</p>
          <p className="metric__value">{record(season.record)}</p>
          <p className="metric__note">{winPct(wins, losses)} winning percentage</p>
          <span className="metric__rank">{ordinal(analysis.ranks.winPct)} best of the decade</span>
        </article>

        <article className="metric">
          <p className="metric__label">SEC record</p>
          <p className="metric__value">{record(season.secRecord)}</p>
          <p className="metric__note">{season.conferenceFinish}</p>
          <span className="metric__rank">
            {winPct(season.secRecord[0], season.secRecord[1])} in league play
          </span>
        </article>

        <article className="metric">
          <p className="metric__label">Poll movement</p>
          <p className="metric__value">
            {apRank(season.apPre)} → {apRank(season.apFinal)}
          </p>
          <p className="metric__note">Preseason to final AP ranking</p>
          <span className="metric__rank">NCAA #{season.seed} seed</span>
        </article>

        <article className="metric">
          <p className="metric__label">Scoring margin</p>
          <p className="metric__value">{signed(season.margin)}</p>
          <p className="metric__note">
            {stat(season.ppg)} scored · {stat(season.oppPpg)} allowed
          </p>
          <span className="metric__rank">
            {ordinal(analysis.ranks.margin)} best margin · {ordinal(analysis.ranks.defense)} defense
          </span>
        </article>
      </div>

      <div className="grid grid--feature" style={{ marginTop: 'var(--space-4)' }}>
        <article className="card story-card">
          <span className="kicker">The season story</span>
          <h3>{season.signature}</h3>
          <p>{season.story}</p>
        </article>

        <article className="card coach-card">
          <div
            className="coach-card__photo"
            style={TUBBY_SMITH_IMAGE ? { backgroundImage: `url("${TUBBY_SMITH_IMAGE}")` } : undefined}
            role="img"
            aria-label="Tubby Smith, Kentucky head coach"
          />
          <div className="coach-card__body">
            <span className="badge badge--accent" style={{ alignSelf: 'flex-start' }}>
              Head coach
            </span>
            <h3>{season.coach}</h3>
            <p>
              Smith led all ten teams in this archive — the 1998 national champions, five SEC Tournament
              title teams and ten straight NCAA Tournament appearances.
            </p>
          </div>
        </article>
      </div>

      <article className="card team-photo-card" style={{ marginTop: 'var(--space-4)' }}>
        <div className="team-photo-card__copy">
          <div>
            <span className="kicker" style={{ color: 'var(--uk-sky)' }}>
              Official season portrait
            </span>
            <h3>{seasonLabel(season.id)} Kentucky Wildcats</h3>
            <p>
              {teamImage
                ? 'The full team photograph from the Kentucky media guide. Individual profiles use verified Kentucky-uniform headshots where they exist; where they do not, the archive says so.'
                : 'No team photograph is currently published for this season. The frame is left empty rather than filled with a stand-in, and the archive says so.'}
            </p>
          </div>
          <span className="badge badge--neutral" style={{ alignSelf: 'flex-start' }}>
            {season.roster.length} roster entries
          </span>
        </div>
        {/* The frame is rendered either way. An empty box states plainly that nothing is
            published; substituting another image would be the one thing this archive
            must never do. */}
        <div className={`team-photo-card__frame${teamImage ? '' : ' team-photo-card__frame--empty'}`}>
          {teamImage ? (
            <img
              src={teamImage}
              alt={`${seasonLabel(season.id)} Kentucky Wildcats official team photograph`}
              loading="lazy"
            />
          ) : (
            <span role="note">No team photograph published</span>
          )}
        </div>
      </article>

      <section style={{ marginTop: 'var(--space-6)' }} aria-labelledby="leaders-heading">
        <div className="subhead">
          <h3 id="leaders-heading">Statistical leaders</h3>
          <span>Per game · minimum one appearance</span>
        </div>
        <div className="leader-grid">
          {LEADER_SLOTS.map(({ key, label }) => {
            const leader = seasonLeader(season.id, key);
            if (!leader) return null;
            return (
              <button
                key={key}
                type="button"
                className="card card--interactive leader-card"
                onClick={() => openPlayer(leader.id)}
                title={`${leader.profile.name} — ${STAT_FULL_LABEL[key]}`}
              >
                <PlayerPortrait playerId={leader.id} avatarSize="sm" />
                <span className="leader-card__meta">
                  <span className="leader-card__label">{label}</span>
                  <span className="leader-card__name">{leader.profile.name}</span>
                  <span className="leader-card__value">{stat(leader[key])}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid--halves" style={{ marginTop: 'var(--space-6)' }}>
        <div className="stack">
          <article className="card card--pad">
            <div className="subhead">
              <h3>Season DNA</h3>
              <span>Derived · normalized</span>
            </div>
            {dna.map((row) => (
              <Meter key={row.label} label={row.label} fraction={row.fraction} display={row.display} />
            ))}
            <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
              Bars are scaled to the range spanned by the ten Tubby Smith seasons, so they compare this
              team to the rest of the decade rather than to an absolute ceiling.
            </p>
          </article>

          <article className="card card--pad">
            <div className="subhead">
              <h3>Game-by-game form</h3>
              <span>{season.games.length} decisions</span>
            </div>
            <div className="form-strip">
              {season.games.map((game, index) => (
                <button
                  key={`${game.date}-${game.opponent}-${index}`}
                  type="button"
                  className={`form-dot form-dot--${game.result.toLowerCase()}`}
                  onClick={() => goToView('schedule')}
                  title={`${index + 1}. ${game.loc === 'A' ? 'at' : 'vs'} ${game.opponent} · ${game.uk}–${game.opp} · ${gameDateShort(game.date)}`}
                >
                  <span className="visually-hidden">
                    Game {index + 1}, {game.result === 'W' ? 'win' : 'loss'} against {game.opponent},{' '}
                    {game.uk} to {game.opp}
                  </span>
                  <span aria-hidden="true">{game.result}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 'var(--space-4)' }}>
              <MarginBars
                title={`${seasonLabel(season.id)} point margin by game`}
                description={`Point differential for each of the ${season.games.length} games. Bars above the axis are wins, below are losses.`}
                values={season.games.map((game, index) => ({
                  margin: game.margin,
                  result: game.result,
                  label: `${index + 1}. ${game.loc === 'A' ? 'at' : 'vs'} ${game.opponent} ${signedInt(game.margin)}`,
                }))}
                onSelect={() => goToView('schedule')}
              />
            </div>

            <div className="row wrap" style={{ marginTop: 'var(--space-4)', gap: 'var(--space-4)' }}>
              {analysis.longestWinStreak ? (
                <span className="badge badge--win">
                  Longest win streak: {analysis.longestWinStreak.length}
                </span>
              ) : null}
              {analysis.biggestWin ? (
                <span className="badge badge--neutral">
                  Biggest win: {signedInt(analysis.biggestWin.margin)} vs {analysis.biggestWin.opponent}
                </span>
              ) : null}
              {analysis.overtimeGames.length > 0 ? (
                <span className="badge badge--neutral">
                  {analysis.overtimeGames.length} overtime game
                  {analysis.overtimeGames.length === 1 ? '' : 's'}
                </span>
              ) : null}
              <span className="badge badge--neutral">
                {analysis.closeGames.wins}–{analysis.closeGames.losses} in games decided by five or fewer
              </span>
            </div>
          </article>
        </div>

        <div className="stack">
          <article className="card card--pad">
            <div className="subhead">
              <h3>Signature moments</h3>
              <span>Selected markers</span>
            </div>
            <div className="moment-list">
              {season.highlights.map((highlight, index) => (
                <div className="moment" key={highlight[0]}>
                  <span className="moment__icon">
                    <Icon name={MOMENT_ICONS[index % MOMENT_ICONS.length]} size={16} />
                  </span>
                  <div>
                    <strong>{highlight[0]}</strong>
                    <span>{highlight[1]}</span>
                  </div>
                  <b>{highlight[2]}</b>
                </div>
              ))}
            </div>
          </article>

          <article className="card card--pad">
            <div className="subhead">
              <h3>Awards & honors</h3>
              <span>{season.awards.length} listed</span>
            </div>
            <div className="award-list">
              {season.awards.map((award) => (
                <div className="award" key={`${award[0]}-${award[1]}`}>
                  <span className="award__medal">
                    <Icon name="trophy" size={15} />
                  </span>
                  <div>
                    <strong>{award[0]}</strong>
                    <span>{award[1]}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="card card--pad">
            <div className="subhead">
              <h3>Season splits</h3>
              <span>Derived from game results</span>
            </div>
            <table className="career-table">
              <caption className="visually-hidden">
                {seasonLabel(season.id)} record by venue and competition type
              </caption>
              <thead>
                <tr>
                  <th scope="col">Split</th>
                  <th scope="col">Record</th>
                  <th scope="col">PPG</th>
                  <th scope="col">Opp</th>
                </tr>
              </thead>
              <tbody>
                {analysis.splits.map((split) => (
                  <tr key={split.label}>
                    <th scope="row" style={{ fontWeight: 550 }}>
                      {split.label}
                    </th>
                    <td>
                      {split.wins}–{split.losses}
                    </td>
                    <td>{stat(split.pointsFor / split.games)}</td>
                    <td>{stat(split.pointsAgainst / split.games)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      </div>
    </div>
  );
}
