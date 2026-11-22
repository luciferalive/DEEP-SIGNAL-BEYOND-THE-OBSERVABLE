# DEEP SIGNAL: BEYOND THE OBSERVABLE

A browser-based scientific exploration and cosmic-mystery simulation set in 2189. You command **Meridian Station**, a deep-space observatory at Sun–Earth L2. Observe real astronomical objects, analyse your data, run missions for Earth Mission Control and decide what counts as a discovery.

**Current version: 0.1.0** (foundation release)

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

## Version 0.1.0 – completed and tested

| Area | Status |
| --- | --- |
| 14 navigation sections (desktop rail, mobile drawer) | Implemented; every section renders in a headless browser with no console errors |
| Game clock (paused, 1 min/s, 10 min/s, 1 h/s, 6 h/s, 1 day/s), fixed 10-minute tick, deterministic seeded PRNG | Implemented, unit-tested |
| Astronomy database: 59 real objects (Solar System, stars, exoplanets, black holes, galaxies, nebulae) with search, filters, bookmarks, tracking, sky map and Solar System schematic | Implemented |
| Observatory: 2 instruments (optical, radio), range limits, exposure planner, cost, quality estimate, servicing | Implemented, unit-tested |
| Research laboratory: raw datasets → analysis → discoveries; research points | Implemented, unit-tested |
| Technology tree: 7 working technologies with real effects and stated limitations | Implemented, unit-tested |
| Crew management: 5 crew, skills, health, morale, fatigue, assignments | Implemented, unit-tested |
| Station: power budget, life support, resources, system wear and servicing | Implemented, unit-tested |
| Spacecraft: one docked ship (refuel, repair) | Implemented (no flights yet) |
| Mission Control: 6 missions with automatic objective checking, reports, rewards, self-directed surveys | Implemented, unit-tested |
| Communications: inbox, delayed Earth responses, supply convoys, funding offers, discovery sending and verification | Implemented, unit-tested |
| Cosmic events: 6 station/space-weather events with decisions and default actions | Implemented, unit-tested |
| Anomaly investigation: false-positive anomalies resolved by re-observation | Implemented (all v0.1 anomalies are instrumental artefacts) |
| Discovery archive with search and type filter | Implemented |
| Financial management: balance, upkeep, grants, ledger, chart | Implemented |
| Saving: autosave, 3 manual slots (IndexedDB), JSON export/import, version migration, validation | Implemented, unit-tested; reload + continue and import verified in browser |
| Settings: autopause, autosave interval, interface size, speed | Implemented |

Tests: `npm test` runs 24 engine tests (data integrity, determinism, full mission loop, save/load/import/export/migration, etc.). Browser checks were run with headless Chromium: all 14 sections, new game, mission accept, observation, 1-day/s time advance, analysis, save/overwrite-confirm/export/reload/continue/import, and a 390 px mobile viewport (no horizontal scroll).

## Not implemented yet (planned – nothing below is claimed as working)

- Live verification of object data against archives; many more objects and a real catalogue import
- Additional instruments (v0.3), spacecraft flights, probes, landers (v0.4+)
- Technology branches beyond the 7 working technologies (roadmap is shown in-game)
- Astronomical cosmic events: supernovae, gamma-ray bursts, gravitational waves (v0.7)
- Speculative / fictional anomalies (e.g. wormhole candidates), clearly labelled as fiction (v0.8)
- Multiple stations, factions, sound, localisation, formal accessibility audit
- Mobile layout has been checked at 390 px only; no real-device testing

## Known limitations

- Observation quality, costs and balance values are tuned by hand and have not been playtested at length.
- Sky map is a schematic equirectangular projection, not a planetarium.
- Loaded and new games start paused by design.

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

### 0.1.0
- First playable foundation: engine, data, 14 sections, saves, tests.
