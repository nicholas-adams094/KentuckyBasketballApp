#!/usr/bin/env node
/**
 * Image and provenance audit.
 *
 * Fails on anything that would break the page or misrepresent an image: a missing file,
 * a duplicate key, a truncated asset, a manifest entry pointing outside `public/`, or a
 * profile image with no manifest record. Warns on the known open items — low-resolution
 * originals, reconstructions awaiting re-sourcing, and uncleared rights.
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
  reconstructions: 0,
  placeholders: 0,
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

    if (seenPaths.has(declared)) {
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
  if (item.confidence === 'verified-source-derived-portrait') {
    stats.reconstructions += 1;
    warn(`${where}: reconstruction from a team photograph — replace with a verified headshot when found`);
  }
  if (item.rights_review_status !== 'approved') {
    stats.rightsPending += 1;
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

if (fs.existsSync(imageRoot)) {
  for (const file of walk(imageRoot)) {
    const rel = `/${path.relative(publicDir, file).split(path.sep).join('/')}`;
    if (!seenPaths.has(rel)) warn(`Unreferenced image file on disk: ${rel}`);
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
    `  reconstructions       ${stats.reconstructions}`,
    `  placeholders          ${stats.placeholders}`,
    `  low-res originals     ${stats.lowResOriginals}`,
    `  rights review pending ${stats.rightsPending}`,
    `  review warnings       ${warnings.length}`,
  ].join('\n'),
);
