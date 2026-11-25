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

### Status by version (honest)

- **V2 The Living Universe** – implemented: speed ladder and scheduler, spacecraft classes and fleet, 8-stage expeditions with risk and recovery, communications link states, crew specialisations/training/hiring/shifts, 43 technologies with data requirements and a visual tree, six purchasable instruments, pulsars/clusters/asteroids/comets, staged anomaly investigation, Earth contracts and emergency missions, budget allocation, archive sorting/comparison, saves v1→v5 with automatic backups.
  Not done in V2: data-economy uses beyond dataset quality fields, research-category requirement tiers, rotating per-autosave backups (only pre-migration backups).
- **V3 Beyond Human Limits** (save v5) – implemented in compact form: planetary exploration stages, facilities (relay, factory, mines, outposts), resource stock and connection rules, settlements, spacecraft design and construction, interstellar precursor probes, civilization index, policies and map.
  Not done in V3: multiple independent stations, a separate deep-space-network simulation beyond relay range, resource logistics routes (production is credited to a single stock), crewed settlement life-support detail.
- **V4 The Unknown** (save v6) – implemented: persistent mystery engine with 7 data-driven FICTIONAL arcs (Silent Star, Forgotten Transmission, Impossible Planet, Dark Structure, Observer, Distant Signal, Empty System), 7-stage investigations with real instruments/techs/expeditions, noisy conflicting evidence with a hidden truth, player hypotheses with confidence, calibrated conclusions and later disputes, follow-ups and experiments, anomaly network cross-references, five scientific decisions with consequences, rare cosmic events, unknown civilizations with light-delay messaging, fictional catalogue objects in the Universe Explorer, archive integration, extraordinary anomaly causes (3%).
  Not done in V4: more than 7 arcs (the data format is expandable), branching story text beyond the evidence lines, crew assignment to specific steps, a map placement of fictional objects.
- **V5** – not started (nothing is claimed).

Tested with `npm test` (engine tests including migration of genuine saves made by the V1, V2, V3 and V4 engines in `tests/fixtures/`, plus a test that renders every view) and with headless Chromium: every section renders with no console errors.

### V5 (1.0.0) - implemented and tested
Galactic map and surveys, colonies, networks, cosmic intelligence, achievements, procedural mysteries, memory. 77 automated tests pass (`node tests/run.mjs`), including migrations from real v1-v6 saves and a 3-year deterministic run; all views were opened in a browser without console errors.

**Not done / limits (honest):** colonies capped at 150 ly; no per-ship fleet simulation (networks are aggregate); no combat or multiplayer; planets of all systems are simulated, not real; touch and screen-reader support are basic; long-run balance beyond about 3 simulated years is lightly tested.

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
