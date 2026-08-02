#!/usr/bin/env node
/**
 * Image and provenance audit.
 *
 * Fails on anything that would break the page or misrepresent an image: a missing file,
 * a duplicate key, a truncated asset, a manifest entry pointing outside `public/`, or a
 * profile image with no manifest record. It also re-derives every jersey-number
 * identification from `archive.json`, so a crop can never claim a subject the archive's
 * own roster data contradicts. Warns on the known open items — low-resolution originals,
 * team-photograph crops awaiting re-sourcing, and uncleared rights.
 *
 * Dimensions are read from the file headers directly so the audit needs no image
 * library and stays fast and dependency-free.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/data/photo-manifest.json'), 'utf8'));
const archive = JSON.parse(fs.readFileSync(path.join(root, 'src/data/archive.json'), 'utf8'));

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const MIN_FILE_BYTES = 1000;
const MIN_PLAYER_ORIGINAL = { width: 800, height: 1000 };
const MIN_TEAM_ORIGINAL_WIDTH = 1600;

/** Reads intrinsic dimensions from PNG / JPEG / WebP headers. */
function readDimensions(file) {
  const buffer = fs.readFileSync(file);

  // PNG: 8-byte signature, then IHDR with width/height as big-endian uint32.
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // WebP: RIFF container; VP8/VP8L/VP8X each store size differently.
  if (buffer.length > 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const format = buffer.toString('ascii', 12, 16);
    if (format === 'VP8 ') {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (format === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (format === 'VP8X') {
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      return { width, height };
    }
  }

  // JPEG: walk the segment markers to the SOFn frame header.
  if (buffer.length > 4 && buffer.readUInt16BE(0) === 0xffd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const isFrameHeader = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrameHeader) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }

  return null;
}

const publicDir = path.join(root, 'public');
const seenKeys = new Set();
const seenPaths = new Set();
const stats = {
  files: 0,
  bytes: 0,
  portraitVariants: 0,
  identifiedCrops: 0,
  placeholders: 0,
  unverified: 0,
  supersededOriginals: 0,
  fabricated: 0,
  lowResOriginals: 0,
  rightsPending: 0,
};

for (const item of manifest.items) {
  const where = item.image_key;

  if (seenKeys.has(item.image_key)) fail(`Duplicate image key: ${item.image_key}`);
  seenKeys.add(item.image_key);

  if (!['player', 'team', 'interface'].includes(item.kind)) {
    fail(`${where}: unknown kind "${item.kind}"`);
  }

  // Two confidence values mean "never render this as a portrait of this player". The
  // absence of portrait variants is what enforces it at runtime, so the audit checks the
  // absence rather than trusting the label.
  const noPortrait = item.confidence === 'placeholder' || item.confidence === 'unverified-identification';
  if (item.kind === 'player' && noPortrait && item.portrait) {
    fail(
      `${where}: confidence "${item.confidence}" must have no portrait variants, or the app would render it as this player`,
    );
  }

  // Portrait variants are the responsive derivatives the app actually serves.
  if (item.kind === 'player' && !noPortrait) {
    const portrait = item.portrait;
    if (!portrait || !Array.isArray(portrait.variants) || portrait.variants.length === 0) {
      fail(`${where}: player has no portrait variants — run scripts/derive-portraits.py`);
    } else {
      for (const variant of portrait.variants) {
        const file = path.join(publicDir, variant.path.replace(/^\//, ''));
        if (!fs.existsSync(file)) {
          fail(`${where}: missing portrait variant ${variant.path}`);
          continue;
        }
        const actual = readDimensions(file);
        if (actual && (actual.width !== variant.width || actual.height !== variant.height)) {
          fail(
            `${where}: portrait variant ${variant.path} is ${actual.width}x${actual.height} on disk but the manifest records ${variant.width}x${variant.height}`,
          );
        }
        // Portraits pass through a ×4 generative upscaler, so the ceiling is the model's
        // own scale factor. Past that even synthesised detail is just resampling, and the
        // file would be claiming resolution nothing in the chain ever produced.
        const ceiling = portrait.reconstruction ? portrait.reconstruction.scale : 2;
        if (variant.width > portrait.native_width * ceiling) {
          fail(
            `${where}: portrait variant ${variant.width}w exceeds ${ceiling}x the ${portrait.native_width}px native crop`,
          );
        }
        stats.portraitVariants += 1;
        seenPaths.add(variant.path);
      }
      if (!portrait.derivation) fail(`${where}: portrait has no recorded derivation`);

      // Every portrait is now produced by a generative model, so every portrait must say
      // so. An image that went through Real-ESRGAN without this record would read as an
      // archival photograph in the manifest, in the dialog and in the sources view.
      const recon = portrait.reconstruction;
      if (!recon) {
        fail(`${where}: portrait has no reconstruction record — run scripts/derive-portraits.py`);
      } else {
        if (!recon.model?.trim()) fail(`${where}: reconstruction names no model`);
        if (!['reconstructed', 'fabricated'].includes(recon.class)) {
          fail(`${where}: reconstruction class must be "reconstructed" or "fabricated" (got "${recon.class}")`);
        }
        // A fabrication is not a likeness of the player. It has to be declared as one in
        // the photo_type too, because that is what the interface reads to flag it.
        if (recon.class === 'fabricated') {
          stats.fabricated += 1;
          if (item.photo_type !== 'ai-fabricated-face') {
            fail(
              `${where}: reconstruction class "fabricated" requires photo_type "ai-fabricated-face" (got "${item.photo_type}") — the interface flags on photo_type`,
            );
          }
          if (!/NOT a photograph of this player/i.test(item.photo_note ?? '')) {
            fail(`${where}: a fabricated face must say so plainly in its photo_note`);
          }
        }
        // The threshold that separates the two is the whole basis for the distinction, so
        // it is re-derived here rather than trusted from the generating script.
        const tooSmall = portrait.native_width < 90;
        if (tooSmall && recon.class !== 'fabricated') {
          fail(
            `${where}: ${portrait.native_width}px native crop is below the 90px reconstruction floor but is not marked fabricated`,
          );
        }
        if (!tooSmall && recon.class === 'fabricated') {
          fail(
            `${where}: marked fabricated but its ${portrait.native_width}px native crop is above the 90px floor`,
          );
        }
      }
    }

    // A crop of a group photograph must name the jersey number that identifies the
    // subject, and that number must be the one the archive records for that player in
    // that season. Anything else is the archive asserting an identity its own data
    // contradicts — which is exactly how the Ramon Harris entry was caught.
    if (item.confidence === 'verified-team-photograph-crop') {
      stats.identifiedCrops += 1;
      if (!item.jersey_number) {
        fail(`${where}: ${item.confidence} with no jersey_number recorded`);
      }
      if (item.identified_by !== 'jersey-number') {
        fail(`${where}: ${item.confidence} must record identified_by "jersey-number"`);
      }
      const season = archive.seasons.find((s) => s.id === item.identified_in_season);
      if (!season) {
        fail(`${where}: identified_in_season "${item.identified_in_season}" is not a season in the archive`);
      } else {
        const line = season.roster.find((entry) => entry.id === item.entity_id);
        if (!line) {
          fail(`${where}: ${item.entity_id} is not on the ${season.id} roster`);
        } else if (line.number !== item.jersey_number) {
          fail(
            `${where}: identified by jersey #${item.jersey_number} but the archive records #${line.number} for ${item.entity_id} in ${season.id}`,
          );
        }
        // The number must also be unique that season, or it identifies two people.
        const sharing = season.roster.filter((entry) => entry.number === item.jersey_number);
        if (sharing.length > 1) {
          fail(
            `${where}: #${item.jersey_number} is worn by ${sharing.length} players in ${season.id} — the crop identifies no one`,
          );
        }
      }
    }
  }

  for (const field of ['original_path', 'processed_path']) {
    const declared = item[field];
    if (typeof declared !== 'string' || !declared.startsWith('/images/')) {
      fail(`${where}: ${field} must be an absolute /images/… path (got "${declared}")`);
      continue;
    }

    const file = path.join(publicDir, declared.replace(/^\//, ''));
    // Guard against a manifest path escaping public/ via ../ segments.
    if (!path.resolve(file).startsWith(path.resolve(publicDir) + path.sep)) {
      fail(`${where}: ${field} resolves outside public/ (${declared})`);
      continue;
    }
    if (!fs.existsSync(file)) {
      fail(`${where}: missing ${field} at ${declared}`);
      continue;
    }

    const size = fs.statSync(file).size;
    stats.files += 1;
    stats.bytes += size;
    if (size < MIN_FILE_BYTES) {
      fail(`${where}: ${field} is only ${size} bytes — likely truncated (${declared})`);
      continue;
    }

    // The manifest's recorded dimensions must match the file on disk, or the
    // provenance record is describing an asset that no longer exists.
    const actual = readDimensions(file);
    const declaredDims = field === 'original_path' ? item.original_dimensions : item.processed_dimensions;
    if (actual && declaredDims) {
      if (actual.width !== declaredDims.width || actual.height !== declaredDims.height) {
        fail(
          `${where}: ${field} is ${actual.width}×${actual.height} on disk but the manifest records ${declaredDims.width}×${declaredDims.height}`,
        );
      }
    } else if (!actual) {
      warn(`${where}: could not read dimensions from ${declared}`);
    }

    // `processed_path` aliases the largest portrait variant for players, so only a
    // genuine cross-entry collision is an error.
    if (seenPaths.has(declared) && !declared.startsWith('/images/players/portrait/')) {
      fail(`${where}: ${declared} is referenced by more than one manifest entry`);
    }
    seenPaths.add(declared);
  }

  const { width, height } = item.original_dimensions ?? {};
  if (item.kind === 'player' && (width < MIN_PLAYER_ORIGINAL.width || height < MIN_PLAYER_ORIGINAL.height)) {
    stats.lowResOriginals += 1;
    warn(`${where}: low-resolution player original ${width}×${height} — re-source when possible`);
  }
  if (item.kind === 'team' && width < MIN_TEAM_ORIGINAL_WIDTH) {
    stats.lowResOriginals += 1;
    warn(`${where}: low-resolution team original ${width}×${height} — re-source when possible`);
  }

  if (item.confidence === 'placeholder') {
    stats.placeholders += 1;
    warn(`${where}: labelled placeholder — no verified image located`);
  }
  if (item.confidence === 'verified-team-photograph-crop') {
    warn(
      `${where}: crop of a team photograph (identified by jersey #${item.jersey_number}) — replace with an individual headshot when one is located`,
    );
  }
  if (item.confidence === 'unverified-identification') {
    stats.unverified += 1;
    warn(`${where}: subject cannot be verified from archive data — shown as a jersey card, not as a portrait`);
  }
  if (item.rights_review_status !== 'approved') {
    stats.rightsPending += 1;
  }

  if (item.kind === 'team' && !item.reconstruction) {
    fail(`${where}: team photograph has no reconstruction record — run scripts/derive-team-photos.py`);
  }
  if (item.reconstruction?.class === 'fabricated' && item.kind !== 'player') {
    fail(`${where}: only player portraits may be marked fabricated`);
  }

  if (!item.photo_note?.trim()) {
    fail(`${where}: no provenance note — every image must describe its origin`);
  }
}

// --- Cross-check against the archive ----------------------------------------

for (const [playerId, profile] of Object.entries(archive.profiles)) {
  if (profile.image && !seenKeys.has(profile.image)) {
    fail(`Profile ${playerId} references image key "${profile.image}" with no manifest entry`);
  }
}
for (const season of archive.seasons) {
  if (!seenKeys.has(season.teamImage)) {
    fail(`Season ${season.id} references team image "${season.teamImage}" with no manifest entry`);
  }
}

// Every manifest player entry should correspond to a real profile.
for (const item of manifest.items) {
  if (item.kind === 'player' && !archive.profiles[item.entity_id]) {
    fail(`Manifest entry ${item.image_key} points at unknown player "${item.entity_id}"`);
  }
}

// --- Orphan detection --------------------------------------------------------

const imageRoot = path.join(publicDir, 'images');
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(webp|png|jpe?g|avif)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

// An original that a re-sourced headshot superseded stays on disk on purpose, so the
// substitution can be audited against what it replaced. Those are not orphans.
const supersededIn = (dir, originalDir) =>
  fs.existsSync(path.join(publicDir, dir))
    ? fs
        .readdirSync(path.join(publicDir, dir))
        .filter((f) => f.endsWith('.jpg'))
        .map((f) => `${originalDir}/${f.replace(/\.jpg$/, '.webp')}`)
    : [];

const superseded = new Set([
  ...supersededIn('images/players/resourced', '/images/players/original'),
  ...supersededIn('images/teams/resourced', '/images/teams/original'),
]);

if (fs.existsSync(imageRoot)) {
  for (const file of walk(imageRoot)) {
    const rel = `/${path.relative(publicDir, file).split(path.sep).join('/')}`;
    if (seenPaths.has(rel)) continue;
    if (superseded.has(rel)) {
      stats.supersededOriginals += 1;
      continue;
    }
    warn(`Unreferenced image file on disk: ${rel}`);
  }
}

// --- Report ------------------------------------------------------------------

for (const warning of warnings) console.warn(`WARN  ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);

if (errors.length > 0) {
  console.error(`\nImage audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  [
    'Image audit passed.',
    `  manifest entries      ${manifest.items.length}`,
    `  files verified        ${stats.files} (${(stats.bytes / 1024 / 1024).toFixed(1)} MB)`,
    `  portrait variants     ${stats.portraitVariants}`,
    `  team-photo crops      ${stats.identifiedCrops}`,
    `  FABRICATED faces      ${stats.fabricated}`,
    `  placeholders          ${stats.placeholders}`,
    `  unverified subjects   ${stats.unverified}`,
    `  re-sourced headshots  ${stats.supersededOriginals}`,
    `  low-res originals     ${stats.lowResOriginals}`,
    `  rights review pending ${stats.rightsPending}`,
    `  review warnings       ${warnings.length}`,
  ].join('\n'),
);
