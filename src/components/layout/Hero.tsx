import { RUPP_ARENA_IMAGE, teamImageUrl } from '@/lib/archive';
import { apRank, record, seasonLabel, signed, stat } from '@/lib/format';
import { analyzeSeason } from '@/lib/analytics';
import { pathFor } from '@/lib/tournament';
import { useNavigation } from '@/state/navigation';

/** Season masthead: the identity, the headline record and the at-a-glance scoreboard. */
export function Hero() {
  const { season } = useNavigation();
  const analysis = analyzeSeason(season);
  const path = pathFor(season.id);
  const heroImage = teamImageUrl(season) ?? RUPP_ARENA_IMAGE;

  const badges: { text: string; gold?: boolean }[] = [
    { text: season.conferenceFinish, gold: path?.secTitle },
    { text: `NCAA ${season.finish}`, gold: path?.titleWon },
    { text: `AP ${apRank(season.apPre)} preseason → ${apRank(season.apFinal)} final` },
    { text: `#${season.seed} seed` },
  ];

  return (
    <section className="hero">
      {heroImage ? (
        <div className="hero__image" style={{ backgroundImage: `url("${heroImage}")` }} aria-hidden="true" />
      ) : null}

      <div className="shell hero__inner">
        <div>
          <p className="hero__eyebrow">The Tubby Smith decade · Season {analysis.ranks.winPct} of 10 by win rate</p>
          <h1 className="hero__title">
            <span className="hero__title-sub">{season.signature}</span>
            {seasonLabel(season.id)}
          </h1>
          <p className="hero__summary">{season.story}</p>
          <div className="hero__badges">
            {badges.map((badge) => (
              <span key={badge.text} className={`hero__badge${badge.gold ? ' hero__badge--gold' : ''}`}>
                {badge.text}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="scoreboard">
            <div className="scoreboard__head">
              <span>Season file</span>
              <span>{season.games.length} games</span>
            </div>
            <div className="scoreboard__record">
              <span className="scoreboard__record-value">{record(season.record)}</span>
              <span className="scoreboard__finish">
                <span>NCAA finish</span>
                <b>{season.finish}</b>
              </span>
            </div>
            <div className="scoreboard__grid">
              <div className="scoreboard__cell">
                <strong>{record(season.secRecord)}</strong>
                <span>SEC</span>
              </div>
              <div className="scoreboard__cell">
                <strong>{stat(season.ppg)}</strong>
                <span>PPG</span>
              </div>
              <div className="scoreboard__cell">
                <strong>{signed(season.margin)}</strong>
                <span>Margin</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
