import { useId, useMemo } from 'react';
import { careerOf, getProfile, playerPhoto } from '@/lib/archive';
import {
  BOX_KEYS,
  careerSummary,
  eraPercentile,
  impactRating,
  per40,
  STAT_LABEL,
  teamShare,
} from '@/lib/analytics';
import { heightLabel, percent, seasonLabel, stat } from '@/lib/format';
import { LineChart, Meter } from '@/components/ui/charts';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { PlayerPortrait } from '@/components/player/PlayerPortrait';
import { useNavigation } from '@/state/navigation';
import { usePreferences } from '@/state/preferences';
import { useToast } from '@/state/toast';

/**
 * Full player profile.
 *
 * Shows the biography, the complete season-by-season line, derived context (per-40,
 * team share, era percentile) and the image provenance for that player. Everything
 * derived is explicitly labelled.
 */
export function PlayerDialog() {
  const { openPlayerId, closePlayer, season } = useNavigation();
  const { isFavorite, toggleFavorite } = usePreferences();
  const { push } = useToast();
  const titleId = useId();

  const profile = openPlayerId ? getProfile(openPlayerId) : undefined;
  const career = useMemo(() => (openPlayerId ? careerOf(openPlayerId) : []), [openPlayerId]);
  const summary = useMemo(() => (openPlayerId ? careerSummary(openPlayerId) : null), [openPlayerId]);
  const photo = openPlayerId ? playerPhoto(openPlayerId) : undefined;

  if (!openPlayerId || !profile) return null;

  // Prefer the line from the season the reader is currently in; otherwise the best one.
  const focusEntry =
    career.find((entry) => entry.seasonId === season.id && entry.gp > 0) ?? summary?.peak ?? career[0];

  const favorite = isFavorite(openPlayerId);
  const playedSeasons = career.filter((entry) => entry.gp > 0);

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/player/${openPlayerId}`;
    try {
      await navigator.clipboard.writeText(url);
      push('Profile link copied to clipboard.', 'success');
    } catch {
      push(url, 'info');
    }
  };

  return (
    <Dialog
      open
      onClose={closePlayer}
      labelledBy={titleId}
      className="player-dialog"
      closeLabel={`Close ${profile.name} profile`}
    >
      <div className="player-dialog__hero">
        <PlayerPortrait
          playerId={openPlayerId}
          number={focusEntry?.number ?? ''}
          className="player-dialog__portrait"
          loading="eager"
          showProvenance
        />

        <div>
          <p className="kicker" style={{ color: 'var(--uk-sky)' }}>
            {summary ? `${summary.span} · ${summary.gamesPlayed} games` : 'Archive profile'}
          </p>
          <h2 id={titleId} className="player-dialog__name">
            {profile.name}
          </h2>

          <div className="player-dialog__meta">
            <span className="player-dialog__meta-item">{profile.pos}</span>
            <span className="player-dialog__meta-item">{heightLabel(profile.height)}</span>
            <span className="player-dialog__meta-item">{profile.weight} lb</span>
            {focusEntry ? <span className="player-dialog__meta-item">#{focusEntry.number}</span> : null}
            <span className="player-dialog__meta-item">{profile.hometown}</span>
            <span className="player-dialog__meta-item">{profile.highSchool}</span>
          </div>

          <div className="row wrap" style={{ marginTop: 'var(--space-5)' }}>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                toggleFavorite(openPlayerId);
                push(favorite ? `Removed ${profile.name} from favorites.` : `Added ${profile.name} to favorites.`, 'success');
              }}
              aria-pressed={favorite}
            >
              <Icon name={favorite ? 'star-filled' : 'star'} size={14} />
              {favorite ? 'Favorited' : 'Add to favorites'}
            </button>
            <button type="button" className="btn btn--sm" onClick={copyLink}>
              <Icon name="link" size={14} />
              Copy link
            </button>
          </div>
        </div>
      </div>

      <div className="player-dialog__body">
        <div className="stack">
          <section className="player-dialog__section player-dialog__prose">
            <h4>Scouting profile</h4>
            <p>{profile.bio}</p>
            <p>
              <strong style={{ color: 'var(--text)' }}>Legacy. </strong>
              {profile.legacy}
            </p>
          </section>

          <section className="player-dialog__section">
            <h4>Season by season</h4>
            <div className="scroll-x">
              <table className="career-table">
                <caption className="visually-hidden">
                  {profile.name} statistics by season at Kentucky
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Season</th>
                    <th scope="col">Cl</th>
                    <th scope="col">Role</th>
                    <th scope="col">GP</th>
                    <th scope="col">MPG</th>
                    {BOX_KEYS.map((key) => (
                      <th key={key} scope="col">
                        {STAT_LABEL[key]}
                      </th>
                    ))}
                    <th scope="col" title="Derived composite rating, 0–99">
                      IMP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {career.map((entry) => (
                    <tr key={entry.seasonId} className={entry === summary?.peak ? 'is-peak' : undefined}>
                      <th scope="row">{seasonLabel(entry.seasonId)}</th>
                      <td>{entry.year}</td>
                      <td style={{ textAlign: 'left' }}>{entry.role}</td>
                      <td>{entry.gp}</td>
                      <td>{stat(entry.mpg)}</td>
                      {BOX_KEYS.map((key) => (
                        <td key={key}>{stat(entry[key])}</td>
                      ))}
                      <td>{entry.gp > 0 ? impactRating(entry) : '—'}</td>
                    </tr>
                  ))}
                  {summary && playedSeasons.length > 1 ? (
                    <tr style={{ fontWeight: 650, borderTop: '2px solid var(--border-strong)' }}>
                      <th scope="row">Career</th>
                      <td>—</td>
                      <td style={{ textAlign: 'left' }}>—</td>
                      <td>{summary.gamesPlayed}</td>
                      <td>{stat(summary.averages.mpg)}</td>
                      {BOX_KEYS.map((key) => (
                        <td key={key}>{stat(summary.averages[key])}</td>
                      ))}
                      <td>{summary.peakImpact}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
              Career averages are minutes-weighted. <strong>IMP</strong> is a derived composite rating
              built from this archive's box-score categories relative to the decade's rotation players —
              it is a fan metric, not an official statistic.
            </p>
          </section>

          {playedSeasons.length > 1 ? (
            <section className="player-dialog__section">
              <h4>Career arc</h4>
              <LineChart
                title={`${profile.name} scoring, rebounding and assists by season`}
                description={playedSeasons
                  .map((entry) => `${seasonLabel(entry.seasonId)}: ${stat(entry.ppg)} points, ${stat(entry.rpg)} rebounds, ${stat(entry.apg)} assists per game`)
                  .join('. ')}
                xLabels={playedSeasons.map((entry) => seasonLabel(entry.seasonId))}
                series={[
                  { label: 'PPG', points: playedSeasons.map((entry, index) => ({ x: index, y: entry.ppg })) },
                  { label: 'RPG', points: playedSeasons.map((entry, index) => ({ x: index, y: entry.rpg })) },
                  { label: 'APG', points: playedSeasons.map((entry, index) => ({ x: index, y: entry.apg })) },
                ]}
                height={200}
              />
              <div className="radar-legend">
                {['PPG', 'RPG', 'APG'].map((label, index) => (
                  <span key={label} className="radar-legend__item">
                    <span
                      className="radar-legend__swatch"
                      style={{ background: ['#1a5cf0', '#f3b93f', '#16a37b'][index] }}
                    />
                    {label}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="stack">
          {focusEntry && focusEntry.gp > 0 ? (
            <section className="card card--pad">
              <div className="subhead">
                <h3>{seasonLabel(focusEntry.seasonId)} in context</h3>
                <span>Derived</span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                Where this season ranks among all rotation player-seasons of the decade.
              </p>
              {BOX_KEYS.map((key) => (
                <Meter
                  key={key}
                  label={STAT_LABEL[key]}
                  fraction={eraPercentile(focusEntry, key)}
                  display={`${Math.round(eraPercentile(focusEntry, key) * 100)}%`}
                />
              ))}
            </section>
          ) : null}

          {focusEntry && focusEntry.gp > 0 && focusEntry.mpg >= 4 ? (
            <section className="card card--pad">
              <div className="subhead">
                <h3>Per 40 minutes</h3>
                <span>Derived</span>
              </div>
              <div className="lineup-metrics">
                {(
                  [
                    ['ppg', 'Points'],
                    ['rpg', 'Rebounds'],
                    ['apg', 'Assists'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="lineup-metric">
                    <b>{stat(per40(focusEntry[key], focusEntry.mpg))}</b>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Carried{' '}
                <strong style={{ color: 'var(--text)' }}>{percent(teamShare(focusEntry, 'ppg'))}</strong>{' '}
                of the team's scoring and{' '}
                <strong style={{ color: 'var(--text)' }}>{percent(teamShare(focusEntry, 'apg'))}</strong>{' '}
                of its assists that season.
              </p>
            </section>
          ) : null}

          {summary && summary.awards.length > 0 ? (
            <section className="card card--pad">
              <div className="subhead">
                <h3>Honors</h3>
                <span>{summary.awards.length}</span>
              </div>
              <div className="chips">
                {summary.awards.map((award) => (
                  <span key={award} className="badge badge--gold">
                    {award}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {photo ? (
            <section className="card card--pad">
              <div className="subhead">
                <h3>Image provenance</h3>
                <span>{photo.confidence.replace(/-/g, ' ')}</span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
                {photo.photo_note}
              </p>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: 'var(--space-1) var(--space-3)',
                  marginTop: 'var(--space-3)',
                  fontSize: 'var(--text-2xs)',
                }}
              >
                <dt style={{ color: 'var(--text-subtle)' }}>Method</dt>
                <dd>{photo.derivative_method.replace(/-/g, ' ')}</dd>
                <dt style={{ color: 'var(--text-subtle)' }}>Source</dt>
                <dd>{photo.original_dimensions.width}×{photo.original_dimensions.height} extracted original</dd>
                <dt style={{ color: 'var(--text-subtle)' }}>Rights review</dt>
                <dd>{photo.rights_review_status.replace(/-/g, ' ')}</dd>
              </dl>
              {photo.confidence === 'verified-archival' && photo.photo_season_note ? (
                <div className="callout callout--gold" style={{ marginTop: 'var(--space-3)' }}>
                  <Icon name="alert" size={15} className="callout__icon" />
                  <span>{photo.photo_note}</span>
                </div>
              ) : null}
              {photo.confidence !== 'verified-archival' ? (
                <div className="callout callout--gold" style={{ marginTop: 'var(--space-3)' }}>
                  <Icon name="alert" size={15} className="callout__icon" />
                  <span>
                    {photo.confidence === 'placeholder'
                      ? 'No verified Kentucky-uniform photograph of this player has been located. The card shown is a labelled placeholder, not a likeness.'
                      : photo.confidence === 'unverified-identification'
                        ? `${photo.photo_note} A jersey card is drawn in its place.`
                        : `This portrait is cropped from the ${photo.identified_in_season} team photograph, not an individual archival headshot. The subject is the player wearing jersey #${photo.jersey_number} — the number this archive records for ${profile.name} that season.`}
                  </span>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
