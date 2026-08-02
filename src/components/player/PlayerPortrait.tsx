import { useMemo, useState } from 'react';
import { getProfile, playerPhoto, playerPortrait } from '@/lib/archive';
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
  /** Show the provenance chip for team-photo crops and for anything not shown as a portrait. */
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
  const portrait = playerPortrait(playerId);
  const [failed, setFailed] = useState(false);

  const fallback = useMemo(
    () => jerseyFallback(profile?.name ?? playerId, number),
    [profile?.name, playerId, number],
  );

  const isPlaceholder = photo?.confidence === 'placeholder';
  const isTeamCrop = photo?.confidence === 'verified-team-photograph-crop';
  const isUnverified = photo?.confidence === 'unverified-identification';
  const isFabricated = photo?.photo_type === 'ai-fabricated-face';
  const isReconstructed = photo?.portrait?.reconstruction?.class === 'reconstructed';
  const useFallback = failed || !portrait;

  const alt = profile
    ? `${profile.name}, Kentucky ${profile.pos}${
        isPlaceholder ? ' — no verified photograph available' : ''
      }${isUnverified ? ' — no photograph could be verified as this player' : ''}${
        isTeamCrop ? `, cropped from the ${photo?.identified_in_season} team photograph` : ''
      }${
        // The alt text carries this too: a screen-reader user is otherwise given no way to
        // know the face being described was generated rather than photographed.
        isFabricated
          ? ' — AI-generated face, not a photograph of this player'
          : isReconstructed && !useFallback
            ? ' — AI-reconstructed from a low-resolution photograph'
            : ''
      }`
    : playerId;

  // Avatars render between 26px and 84px wide, cards up to ~250px, so a single
  // `sizes` hint covers every context the component is used in.
  const sizes = avatarSize ? '96px' : '(max-width: 640px) 45vw, 260px';

  const imgProps = useFallback
    ? { src: fallback }
    : { src: portrait.src, srcSet: portrait.srcSet, sizes,
        width: portrait.width, height: portrait.height };

  if (avatarSize) {
    return (
      <img
        {...imgProps}
        alt={alt}
        loading={loading}
        onError={() => setFailed(true)}
        className={`avatar avatar--${avatarSize} ${className ?? ''}`}
      />
    );
  }

  // A fabricated face outranks every other flag: whatever else is true of the image, the
  // first thing a reader needs to know is that it is not this player's face.
  const flag = isFabricated
    ? 'AI-generated face — not a photograph'
    : isPlaceholder
      ? 'No photograph'
      : isUnverified
        ? 'Unverified — not shown'
        : isTeamCrop
          ? `Team photo · #${photo?.jersey_number}`
          : photo?.photo_season_note
            ? photo.photo_season_note
            : photo?.photo_uniform_note
              ? photo.photo_uniform_note
              : null;

  // Every other flag is provenance detail a reader can opt into. This one is a correction
  // to what the picture appears to assert, so it shows wherever the image shows.
  const showFlag = flag !== null && (showProvenance || isFabricated);

  return (
    <div className={`portrait ${showFlag ? 'portrait--flagged' : ''} ${className ?? ''}`}>
      <img {...imgProps} alt={alt} loading={loading} onError={() => setFailed(true)} />
      {number ? (
        <span className="portrait__number" aria-hidden="true">
          {number}
        </span>
      ) : null}
      {showFlag ? (
        <span
          className="provenance-flag portrait__flag"
          title={photo?.photo_note ?? 'Provenance note'}
        >
          <Icon name="alert" size={11} />
          {flag}
        </span>
      ) : null}
    </div>
  );
}
