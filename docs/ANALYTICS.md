# Derived analytics

Everything in this document is **computed by this application** from the archive's stored
data. None of it is an official statistic, and the interface labels it as derived
everywhere it appears.

## What the data actually contains

The archive stores, per player-season: games played, and per-game rates for minutes,
points, rebounds, assists, steals, blocks and turnovers. Per game, it stores date,
venue, opponent, both scores, competition phase, conference flag and an overtime marker.

It does **not** contain: shooting splits, field-goal attempts, free throws, possessions,
pace, on/off data, lineup-level data, or play-by-play.

That constraint shapes everything below. There is no possession-based efficiency rating
here because this dataset cannot support one, and nothing in the interface implies
otherwise.

---

## Per 40 minutes

```
per40(value, mpg) = (value / mpg) × 40
```

Standard normalisation for comparing players with very different playing time.

**Guard:** returns nothing below 4 minutes per game. Extrapolating a 2-point average
over 1.5 minutes to 53 points per 40 is arithmetically valid and completely meaningless,
so the archive declines to show it.

## Team share

```
seasonTotal(player, stat) = stat × gamesPlayed
teamShare(player, stat)   = seasonTotal(player, stat) / Σ seasonTotal(teammate, stat)
```

Answers "how much of this team ran through this player?". Season totals are
*reconstructed* from per-game rates because the archive stores rates, not totals — so
these are close to, but not identical to, official season totals.

Team shares for a category sum to exactly 1 across a roster; the unit tests assert this.

## Era baseline

The comparison set for every era-relative figure is **rotation player-seasons**: every
player-season in the decade with at least 8 minutes per game. That floor keeps a
two-minute garbage-time appearance from distorting the baseline, which is the same
reason record books qualify their leaders.

For each of the six box-score categories the archive computes mean, standard deviation,
minimum and maximum across that set. The Sources view prints the table.

### Era z-score

```
z(player, stat) = (stat − mean) / stdDev        … and negated for turnovers
```

Turnovers are inverted so that **positive always means better**, in every context.

### Era percentile

The share of rotation player-seasons a line beats in that category. Again inverted for
turnovers.

---

## Impact rating (IMP)

A single 1–99 number, shown in the roster table, player profile, comparison view and
Era Vault. It is a blunt, transparent, deliberately simple instrument.

```
weights      ppg 1.00, rpg 0.75, apg 0.75, spg 0.55, bpg 0.45, tov 0.35
weighted     Σ (z(stat) × weight) / Σ weight
minuteWeight min(1, mpg / 20)
IMP          clamp(round(50 + weighted × 18 × (0.55 + 0.45 × minuteWeight)), 1, 99)
```

- Scaled so the decade's rotation average lands near **50**.
- The minute weighting is a confidence discount: a strong rate line over 6 minutes is
  not the same claim as the same line over 32 minutes.
- Zero for a player who did not play.

**What it is not:** a value metric, a win-share estimate, or anything that accounts for
shooting efficiency, role, opponent quality or era pace. It is a weighted sum of six
counting-stat rates relative to the same decade. Read it as a rough production summary,
nothing more.

---

## Lineup rating

Shown in the Lineup Lab, 5–99.

```
impactAvg   mean IMP of the selected players
fit         mean positional fit across the five (see below)
raw         impactAvg × 0.72
            + fit × 22
            + min(Σ apg, 16) × 0.9         creation, capped
            − max(0, Σ tov − 9) × 1.6      ball security above a normal team load
            − duplicates × 22              a duplicated player is not a legal five
score       clamp(round(raw), 5, 99)
```

**Positional fit** scores how naturally a player fills a slot, from their listed
position: 1.0 for a primary match, 0.75 for a plausible one, 0.35 otherwise.

| Slot | Primary | Plausible |
| --- | --- | --- |
| PG | PG, G | — |
| SG | G | SG, G/F, PG |
| SF | G/F | F, G, SF |
| PF | F | F/C, PF, C |
| C | C | F/C |

**Presets.** The optimizer fills the most constrained slots first (centre, then point
guard) so a wing-heavy roster still yields a real five, and weights each candidate by
`objectiveValue × (0.45 + 0.55 × positionFit)`. Objectives:

| Preset | Maximises |
| --- | --- |
| Documented starters | the archive's recorded starting five, verbatim |
| Best overall | IMP |
| Best offense | `ppg + 0.8 × apg` |
| Best defense | `2.4 × spg + 2.2 × bpg + 0.5 × rpg` |
| Best passing | `2.2 × apg − 0.7 × tov` |

Every preset is asserted by test to return five distinct players for every season.

---

## Season analytics

- **Splits** — record, points for and points against by venue (home/away/neutral) and by
  competition type (SEC regular season, non-conference, early-season event, SEC
  Tournament, NCAA Tournament). Venue splits cover every game exactly once; the
  competition splits also cover every game once, with the early-season-event line shown
  additionally as a subset of non-conference.
- **Streaks** — every win/loss run in schedule order, and the longest of each.
- **Record trace** — running wins, losses and differential after each game; the season's
  momentum curve.
- **Close games / blowouts** — decided by ≤5 and ≥20 points respectively.
- **Era ranks** — 1-based rank among the ten seasons for win rate, scoring margin,
  offense and defense.

## Postseason normalisation

The archive's `game.note` records tournament rounds, but the wording is inconsistent
between seasons — 1997–98 says "NCAA First Round" and "NCAA Sweet Sixteen"; 2002–03 says
"Round of 64" and "Sweet 16". Both are faithful to their source media guides, so **the
data is left untouched** and `src/lib/tournament.ts` maps every variant onto a canonical
round.

Matching is deliberately ordered most-specific-first. "Semifinal" and "Quarterfinal"
both end in "final", and a naive championship pattern matches both — that bug would have
reported seven SEC Tournament titles instead of five and shown 2004–05, who lost the
final, as champions. The unit tests pin the correct answers.

Derived from the normalised rounds:

- **SEC Tournament titles** — seasons whose championship game was a win:
  1997–98, 1998–99, 2000–01, 2002–03, 2003–04. Five.
- **Rounds reached** — playing in a round counts as reaching it, whether the game was won
  or lost.
- **Elimination game** — the last game played, or none for the 1998 champions.

## All-decade five

The Era Vault's all-decade team is **computed, not curated**: the highest-IMP
player-season among players listed at each position, with no player selected twice.
It is labelled on the page as a computed opinion. Change the inputs and the five changes
— which is the honest way to present a subjective ranking.

## Decade leaderboards

Single-season leaders in each category across the ten seasons, with the 8-minute
rotation floor applied. Season-scoped leaders (used in Season HQ) drop the floor, since
within one roster the leader is unambiguous.

---

## Verification

`tests/unit/analytics.test.ts` covers all of the above: range bounds, the turnover
inversion, team shares summing to 1, split coverage, streak detection, leaderboard
ordering, lineup legality and preset completeness for every season, and the decade
totals. `npm run test:unit` runs it.
