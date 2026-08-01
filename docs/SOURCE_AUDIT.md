# Source audit

Audit of the material this archive was built from, and of what was found wrong with it.

## Structured archive

Verified by `npm run validate:data`, derived from the game log rather than taken on trust:

- 10 seasons, 1997–98 through 2006–07
- 58 unique player profiles
- 145 season-roster entries
- 346 game records
- **263–83** aggregate record
- **120–40** SEC regular-season record
- **23–9** NCAA Tournament record
- **5** SEC Tournament championships (1997–98, 1998–99, 2000–01, 2002–03, 2003–04)
- 16 cited sources, 12 photo credits

## Defects found in the exported package

Three things in the export were wrong about its own data. All three are fixed in the
rebuild; the JSON itself was never altered.

1. **The phase taxonomy was incomplete.** `GamePhase` declared three values, but the data
   contains five: eight games are recorded under `Maui Invitational` (2002–03, 2006–07)
   and `Guardians Classic` (2005–06). Any code filtering conference play on
   `phase === 'Regular Season'` silently drops them. Conference play is now decided by the
   `sec` flag, and the type models all five phases.

2. **Postseason facts were derived from prose.** SEC Tournament titles were read out of
   the `conferenceFinish` sentence, whose wording varies by season — 2002–03 says "SEC
   regular-season & tournament champions", which a "SEC Tournament champions" match
   misses. Titles are now derived from the championship-game result.

3. **Tournament round labels are inconsistent between seasons** and cannot be compared
   directly: 1997–98 through 2001–02 use `NCAA First Round` / `NCAA Sweet Sixteen`,
   2002–03 onward use `Round of 64` / `Sweet 16`. `src/lib/tournament.ts` normalises them
   at read time.

A fourth defect was introduced and caught during the rebuild: a naive
`/championship|final\b/` pattern in the round classifier matched "**semi**final", which
would have reported seven SEC titles instead of five and shown 2004–05 — who lost the
championship game — as champions. Unit tests now pin the correct answers.

## Legacy files

`reference/legacy-stable.stripped.html` is the last stable monolithic build with its
base64 data URIs removed: 4.3 MB → 242 kB of markup, CSS and application code. That is
the behavioural reference. The full base64 original is not committed; the image files it
contained are in `public/images/` as real files.

`reference/archive.raw.json` and `reference/photo-manifest.csv` are unmodified exported
snapshots. `reference/CHECKSUMS.sha256` records the export's checksums.

**Nothing under `reference/` is ever edited.**

## Problems with the monolithic architecture

Documented because they motivated the rebuild:

- Data, CSS, JavaScript and base64 images lived in one 4.3 MB file.
- A minor text substitution could break JavaScript parsing or duplicate a declaration,
  and the app had experienced blank-screen bootstrap failures as a result.
- Replacing one image rewrote a very large object literal.
- There was no source-level separation between originals and derivatives.
- A single global mutable `state` object drove all rendering, with no URL state, so
  nothing was linkable and browser back did nothing.

The rebuild addresses each: modular TypeScript with a per-view error boundary, file-based
images, an immutable `original/` tree recorded in the manifest, and the URL as the single
source of navigation truth.

## Current image state

- 48 player images labelled archival Kentucky portraits; 2 interface images.
- 10 official team photographs.
- **9 portraits reconstructed from verified team-photo crops**: Jules Camara, Antwain
  Barbour, Josh Carrier, Matt Heissenbuttel, Lukasz Obrzut, Michael Porter, Mark Coury,
  J.P. Blevins, Rashaad Carruth. Flagged wherever they appear.
- **Eric Allen has no verified image** and uses a labelled placeholder.
- 68 of 70 originals are below the resolution target — most player originals are 420×560;
  the 1999–00 team photograph is 528×305.
- The processed derivatives were upscaled, which increased display dimensions without
  creating genuine source detail.

`npm run audit:images` now also verifies the manifest's recorded dimensions against the
actual files, so a provenance record cannot silently drift from its asset.

## Implication

Image improvement must begin with source discovery, not another upscale. See
[PHOTO_PIPELINE.md](PHOTO_PIPELINE.md) §8 for the replacement procedure.
