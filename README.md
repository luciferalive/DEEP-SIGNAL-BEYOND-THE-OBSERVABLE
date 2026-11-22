# DEEP SIGNAL: BEYOND THE OBSERVABLE

A browser-based scientific exploration and cosmic-mystery simulation set in 2189. You command **Meridian Station**, a deep-space observatory at Sun–Earth L2. Observe real astronomical objects, analyse your data, run missions for Earth Mission Control and decide what counts as a discovery.

**Current version: 0.2.0** (V2 milestone 1 of the roadmap)

## Run it

```bash
python3 -m http.server 8000     # any static server works
# open http://localhost:8000
npm test                        # engine tests (Node 18+, no dependencies)
```

The game must be served over HTTP (not opened as a `file://` page) because it loads JSON data and ES modules.

## Principles

- **Real and fictional data are kept separate.** The Universe Explorer contains only real objects (`category: known`). Earth agencies, crew, the station and the 2189 setting are fiction and labelled as simulated.
- **No invented measurements.** Missing values show `DATA UNKNOWN`; uncertainties are shown where known.
- **Honesty about data provenance:** values were compiled from published catalogues from memory and have **not** been re-verified against live archives (`last_verified` is `null` for every object). Live verification is planned.
- **Saves are never overwritten without confirmation** (autosave is the only silent overwrite, and only of the autosave slot).

## Status by version

The roadmap is V1 → V2 (The Living Universe) → V3 → V4 → V5, all in one continuous universe and one save lineage. See `DEVELOPMENT_ROADMAP.md` for the full spec checklist.

### V1 (0.1.0) – kept intact

All V1 systems still work: 14 original sections, game clock, 59 real catalogue objects, observatory (optical and radio), research laboratory and technology tree (7 technologies), crew, station life support and power, one spacecraft (refuel/repair), 6 missions, Earth communications, 6 decision events, anomaly re-observation, discovery archive, finance, saves.

### V2 milestone 1 (0.2.0) – implemented and tested

| Spec item | What exists now |
| --- | --- |
| V2.2 Cosmic events (partial) | Every event is a structured record (id, type, category, severity, time, description, affected systems, consequences, resolution, status). Time-limited science alerts: solar flare, stellar variability, coronal mass ejection, pulsar timing, supernova candidate, gamma-ray burst and gravitational-wave alerts (the last two can only be logged: no such instruments exist yet). Flares and CMEs really lower solar output. All are labelled simulated. |
| V2.8 Station infrastructure | Ten modules, levels 1–4, condition, power draw, upgrade cost/time, servicing. Effects reach real systems: solar output and battery, storage caps, instrument accuracy, analysis speed, repair speed, convoy transit, health recovery, morale, crew efficiency, mission rewards. |
| V2.9 Finance (partial) | Monthly reports from running totals with spending categories, financial warnings from the real balance, player-set emergency reserve. |
| V2.17 Publications | Five types, four stages, peer review that can return weak work, rewards in RP, reputation and credits. |
| V2.18 Civilization history | Permanent timeline with search, kind filter and major milestones; rebuilt from older saves once. |
| V2.19 Saves (partial) | Format v2, validated, V1→V2 migration, automatic backup before any older save is upgraded, recovery to the newest readable save. |

Tested with `npm test` (35 tests, including migration of a genuine save made by the V1 engine, `tests/fixtures/v1-save.json`) and with headless Chromium: all 17 sections render with no console errors; a V1 save imported on the title screen loads and plays; station upgrade, publication start and event response work from the UI; 390 px layout has no horizontal scroll. Performance: 365 simulated days run in well under a second and a save is about 185 KB.

### V2 – NOT implemented yet (nothing below is claimed)

- V2.1: the 1x/2x/5x/10x/25x/100x speed ladder (the game still uses V1 speeds: 1 min/s … 1 day/s) and a general event scheduler
- V2.3 spacecraft types and operations (launch, transit, orbit, survey…) and V2.4 multi-stage mission lifecycle with planning, risk and failure states
- V2.5 infrared, X-ray, gamma, neutrino and gravitational-wave instruments; observation noise/completeness records
- V2.6 research categories beyond the 7 technologies; V2.15 visual tech tree with 10 branches
- V2.7 crew specialisations, training and experience progression, shifts
- V2.9 budget allocation; V2.10 Earth relationship tracking beyond reputation
- V2.11 pulsars, neutron stars, asteroids, comets and clusters in the Universe Explorer
- V2.12 archive sorting, comparison and reports; V2.13 multi-stage anomaly investigation with several outcomes; V2.14 communication link states and transmission history; V2.16 scientific data economy beyond raw datasets
- V2.19 backups on every autosave
- All of V3, V4 and V5

## Known limitations

- Values for the astronomy database were compiled from memory of published catalogues and are not re-verified against live archives (`last_verified` is null).
- Gameplay numbers are hand-tuned and not playtested at length.
- Transient-event responses are a simplified 4-hour block, not full observations.
- Mobile layout was checked at 390 px in an emulator only; no real-device or cross-browser testing (Chromium only).

## Project layout

```
index.html          entry point
css/                tokens, layout, components
data/               JSON: real astronomy + game content
js/                 DOM-free engine modules (tested in Node)
js/views/           one module per navigation section
js/ui-manager.js    router, actions, saves, modals
tests/run.mjs       engine tests
```

## Changelog

See `CHANGELOG.md`.
