import { useMemo, useState } from 'react';
import { archive, gameCount, imageUrl, photoManifest, profileCount, rosterEntryCount, seasons } from '@/lib/archive';
import { eraDistributions, rotationSeasons } from '@/lib/analytics';
import { Icon } from '@/components/ui/Icon';
import { useNavigation } from '@/state/navigation';
import type { PhotoManifestItem } from '@/types/archive';

const CONFIDENCE_LABEL: Record<string, string> = {
  'verified-archival': 'Verified archival portrait',
  'verified-official-team-photo': 'Official team photograph',
  'verified-source-derived-portrait': 'Reconstruction from a team photograph',
  placeholder: 'Labelled placeholder — no verified image',
};

const FILTERS = ['All', 'Needs review', 'Reconstructions', 'Placeholders'] as const;
type Filter = (typeof FILTERS)[number];

function matches(item: PhotoManifestItem, filter: Filter): boolean {
  switch (filter) {
    case 'Needs review':
      return item.needs_resourcing || item.visual_review_status !== 'complete';
    case 'Reconstructions':
      return item.confidence === 'verified-source-derived-portrait';
    case 'Placeholders':
      return item.confidence === 'placeholder';
    case 'All':
    default:
      return true;
  }
}

/**
 * Sources, provenance and method.
 *
 * This view is not decoration. The archive presents historical claims and derived
 * metrics, so it has to state where each came from, which images are reconstructions,
 * and exactly how every computed number is produced.
 */
export function SourcesView() {
  const { openPlayer } = useNavigation();
  const [filter, setFilter] = useState<Filter>('All');

  const items = useMemo(
    () => photoManifest.items.filter((item) => matches(item, filter)),
    [filter],
  );

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((option) => [option, photoManifest.items.filter((item) => matches(item, option)).length])),
    [],
  );

  const reconstructions = photoManifest.items.filter(
    (item) => item.confidence === 'verified-source-derived-portrait',
  );
  const placeholders = photoManifest.items.filter((item) => item.confidence === 'placeholder');

  return (
    <div className="view">
      <div className="section-head">
        <div className="section-head__body">
          <span className="kicker">Sources, provenance and method</span>
          <h2>How this archive is built</h2>
          <p>
            Every historical figure here comes from a published source; every computed figure is derived
            from that data and labelled as derived. This page lists both, along with the provenance and
            review status of all {photoManifest.items.length} images.
          </p>
        </div>
      </div>

      <div className="grid grid--metrics" style={{ marginBottom: 'var(--space-6)' }}>
        <article className="metric">
          <p className="metric__label">Structured data</p>
          <p className="metric__value">{seasons.length}</p>
          <p className="metric__note">
            seasons · {profileCount} players · {rosterEntryCount} roster entries · {gameCount} games
          </p>
        </article>
        <article className="metric">
          <p className="metric__label">Cited sources</p>
          <p className="metric__value">{archive.sources.length}</p>
          <p className="metric__note">Media guides, record books and archival collections</p>
        </article>
        <article className="metric">
          <p className="metric__label">Images</p>
          <p className="metric__value">{photoManifest.items.length}</p>
          <p className="metric__note">
            {reconstructions.length} reconstructions · {placeholders.length} placeholder
          </p>
        </article>
        <article className="metric">
          <p className="metric__label">Rating baseline</p>
          <p className="metric__value">{rotationSeasons.length}</p>
          <p className="metric__note">
            rotation player-seasons form the comparison set for every derived rating
          </p>
        </article>
      </div>

      <div className="callout callout--gold" style={{ marginBottom: 'var(--space-6)' }}>
        <Icon name="alert" size={18} className="callout__icon" />
        <span>
          <strong>Image rights have not been cleared for public redistribution.</strong> Every image in
          this archive is marked <em>required-before-publication</em> for rights review. The manifest
          tracks source and status, but it is not a legal clearance determination. Treat this build as a
          private, non-commercial editorial archive until that review is complete.
        </span>
      </div>

      <div className="grid grid--halves">
        <article className="card card--pad">
          <div className="subhead">
            <h3>Historical sources</h3>
            <span>{archive.sources.length} cited</span>
          </div>
          {archive.sources.map((source) => (
            <div className="source-item" key={source.url + source.name}>
              <h4>{source.name}</h4>
              <p>{source.use}</p>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.url} <Icon name="external" size={11} style={{ display: 'inline' }} />
              </a>
            </div>
          ))}
        </article>

        <div className="stack">
          <article className="card card--pad">
            <div className="subhead">
              <h3>Derived metrics — how they work</h3>
              <span>Method</span>
            </div>
            <dl style={{ display: 'grid', gap: 'var(--space-4)', margin: 0, fontSize: 'var(--text-sm)' }}>
              <div>
                <dt style={{ fontWeight: 650 }}>Impact rating (IMP)</dt>
                <dd style={{ margin: 'var(--space-1) 0 0', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
                  A weighted sum of era z-scores across points, rebounds, assists, steals, blocks and
                  turnovers, scaled so the decade's rotation average sits near 50 and then discounted for
                  small minute loads. Turnovers are inverted so higher always means better. Range 1–99.
                </dd>
              </div>
              <div>
                <dt style={{ fontWeight: 650 }}>Era percentile</dt>
                <dd style={{ margin: 'var(--space-1) 0 0', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
                  The share of the {rotationSeasons.length} rotation player-seasons (8+ minutes per game)
                  that a line beats in a given category.
                </dd>
              </div>
              <div>
                <dt style={{ fontWeight: 650 }}>Per 40 minutes</dt>
                <dd style={{ margin: 'var(--space-1) 0 0', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
                  A per-game rate divided by minutes per game and multiplied by 40. Suppressed below four
                  minutes per game, where the extrapolation stops being meaningful.
                </dd>
              </div>
              <div>
                <dt style={{ fontWeight: 650 }}>Team share</dt>
                <dd style={{ margin: 'var(--space-1) 0 0', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
                  Season totals reconstructed from per-game rates times games played, expressed as a share
                  of the team's reconstructed total.
                </dd>
              </div>
              <div>
                <dt style={{ fontWeight: 650 }}>Lineup rating</dt>
                <dd style={{ margin: 'var(--space-1) 0 0', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
                  Average impact of the five, plus positional fit, plus capped creation, minus excess
                  turnovers and minus a heavy penalty for a duplicated player.
                </dd>
              </div>
            </dl>
            <div className="callout" style={{ marginTop: 'var(--space-4)' }}>
              <Icon name="info" size={15} className="callout__icon" />
              <span>
                This dataset holds per-game rate statistics only — no shooting splits, possessions or
                play-by-play. Nothing here is or claims to be a possession-based efficiency rating.
              </span>
            </div>
          </article>

          <article className="card card--pad">
            <div className="subhead">
              <h3>Category baselines</h3>
              <span>Decade rotation players</span>
            </div>
            <table className="career-table">
              <caption className="visually-hidden">
                Mean, standard deviation and maximum for each category across rotation player-seasons
              </caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Mean</th>
                  <th scope="col">Std dev</th>
                  <th scope="col">Max</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(eraDistributions).map(([key, dist]) => (
                  <tr key={key}>
                    <th scope="row" style={{ textTransform: 'uppercase' }}>
                      {key}
                    </th>
                    <td>{dist.mean.toFixed(2)}</td>
                    <td>{dist.stdDev.toFixed(2)}</td>
                    <td>{dist.max.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      </div>

      <section style={{ marginTop: 'var(--space-8) ' }} aria-labelledby="photo-credits">
        <div className="subhead">
          <h3 id="photo-credits">Photo credits</h3>
          <span>{archive.photoCredits.length} entries</span>
        </div>
        <div className="card card--pad">
          {archive.photoCredits.map((credit) => (
            <div className="source-item" key={credit.key}>
              <h4>{credit.title}</h4>
              <p>{credit.note}</p>
              <a href={credit.url} target="_blank" rel="noreferrer noopener">
                {credit.url} <Icon name="external" size={11} style={{ display: 'inline' }} />
              </a>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 'var(--space-8)' }} aria-labelledby="image-manifest">
        <div className="subhead">
          <h3 id="image-manifest">Image provenance manifest</h3>
          <span>{items.length} shown</span>
        </div>

        <div className="chips" style={{ marginBottom: 'var(--space-4)' }} role="group" aria-label="Filter images">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={filter === option}
              aria-label={`${option} — ${counts[option]} image${counts[option] === 1 ? '' : 's'}`}
              onClick={() => setFilter(option)}
            >
              {option}
              <span className="chip__count">{counts[option]}</span>
            </button>
          ))}
        </div>

        <div className="provenance-grid">
          {items.map((item) => {
            const src = imageUrl(item.image_key);
            const isPlayer = item.kind === 'player';
            return (
              <article key={item.id} className="card card--interactive provenance-tile">
                {src ? (
                  <button
                    type="button"
                    onClick={() => (isPlayer ? openPlayer(item.entity_id) : undefined)}
                    disabled={!isPlayer}
                    style={{ display: 'block', width: '100%', cursor: isPlayer ? 'pointer' : 'default' }}
                    aria-label={isPlayer ? `Open ${item.display_name} profile` : item.display_name}
                  >
                    <img
                      src={src}
                      alt={item.display_name}
                      loading="lazy"
                      style={{ width: '100%', aspectRatio: item.kind === 'team' ? '16 / 10' : '3 / 4', objectFit: 'cover' }}
                    />
                  </button>
                ) : null}
                <div className="provenance-tile__body">
                  <strong>{item.display_name}</strong>
                  <span>{CONFIDENCE_LABEL[item.confidence] ?? item.confidence.replace(/-/g, ' ')}</span>
                  <span>
                    {item.original_dimensions.width}×{item.original_dimensions.height} original ·{' '}
                    {item.derivative_method.replace(/-/g, ' ')}
                  </span>
                  {item.confidence !== 'verified-archival' && item.kind === 'player' ? (
                    <span className="provenance-flag" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                      <Icon name="alert" size={10} />
                      {item.confidence === 'placeholder' ? 'Placeholder' : 'Reconstruction'}
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <div className="callout" style={{ marginTop: 'var(--space-5)' }}>
          <Icon name="info" size={16} className="callout__icon" />
          <span>
            {photoManifest.notes.join(' ')} Reconstructions are shown with a visible flag everywhere they
            appear in the archive, and are never described as archival headshots.
          </span>
        </div>
      </section>

      <section style={{ marginTop: 'var(--space-8)' }} aria-labelledby="editorial">
        <div className="subhead">
          <h3 id="editorial">Editorial standards</h3>
          <span>What this archive will and will not do</span>
        </div>
        <div className="card card--pad">
          <ul style={{ display: 'grid', gap: 'var(--space-3)', margin: 0, paddingLeft: 'var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
            <li>
              No historical statistic, game result, roster entry, award or record is invented, inferred or
              silently altered. Corrections are logged with old value, new value, source and date.
            </li>
            <li>
              Derived metrics are always labelled as derived and never presented as official statistics.
            </li>
            <li>
              Player imagery is Kentucky-uniform only. No professional, high-school or unrelated
              photographs are substituted.
            </li>
            <li>
              A reconstruction is never described as an authentic archival headshot, and where no verified
              image exists the archive shows a labelled placeholder rather than a stand-in face.
            </li>
            <li>
              Extracted originals are preserved unmodified; every derivative is written separately and
              recorded in the manifest.
            </li>
            <li>
              All-decade selections, rankings and lineup ratings are clearly marked as computed fan
              opinion, with the method stated.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
