import { useMemo, useState } from 'react';
import { getProfile, playerImageUrl, playerPhoto } from '@/lib/archive';
import { jerseyFallback } from '@/lib/jersey';
import { Icon } from '@/components/ui/Icon';

/**
 * Portrait rendering with an honest fallback.
 *
 * If an image is missing or fails to load, the archive draws a generated jersey card
 * rather than an empty box or a stand-in face. Nothing here ever presents an invented
 * likeness as a photograph.
 */

export type PortraitSize = 'xs' | 'sm' | 'md' | 'lg';

export interface PlayerPortraitProps {
  playerId: string;
  number?: string;
  /** Rendered as a fixed-size avatar rather than a 3:4 frame. */
  avatarSize?: PortraitSize;
  className?: string;
  /** Show the provenance chip for reconstructions and placeholders. */
  showProvenance?: boolean;
  loading?: 'lazy' | 'eager';
}

export function PlayerPortrait({
  playerId,
  number = '',
  avatarSize,
  className,
  showProvenance = false,
  loading = 'lazy',
}: PlayerPortraitProps) {
  const profile = getProfile(playerId);
  const photo = playerPhoto(playerId);
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => {
    if (failed) return jerseyFallback(profile?.name ?? playerId, number);
    return playerImageUrl(playerId) ?? jerseyFallback(profile?.name ?? playerId, number);
  }, [failed, playerId, profile?.name, number]);

  const alt = profile
    ? `${profile.name}, Kentucky ${profile.pos}${photo?.confidence === 'placeholder' ? ' (no verified photograph available)' : ''}`
    : playerId;

  const isReconstruction = photo?.confidence === 'verified-source-derived-portrait';
  const isPlaceholder = photo?.confidence === 'placeholder';

  if (avatarSize) {
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        onError={() => setFailed(true)}
        className={`avatar avatar--${avatarSize} ${className ?? ''}`}
      />
    );
  }

  return (
    <div className={`portrait ${className ?? ''}`}>
      <img src={src} alt={alt} loading={loading} onError={() => setFailed(true)} />
      {number ? (
        <span className="portrait__number" aria-hidden="true">
          {number}
        </span>
      ) : null}
      {showProvenance && (isReconstruction || isPlaceholder) ? (
        <span
          className="provenance-flag portrait__flag"
          title={photo?.photo_note ?? 'Provenance note'}
        >
          <Icon name="alert" size={11} />
          {isPlaceholder ? 'Placeholder' : 'Reconstruction'}
        </span>
      ) : null}
    </div>
  );
}
