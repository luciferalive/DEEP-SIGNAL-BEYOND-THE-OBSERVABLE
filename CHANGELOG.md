# Changelog

## 1.0.0 (V5) - Beyond the Observable
- Galactic map: 8 rings x 6 sectors (to 8,000 ly), sector surveys limited by technology range. Real catalogued stars plus deterministic procedural FICTIONAL systems (seeded per save); planets always SIMULATED.
- Interstellar colonies (station, mine, hub, relay; max 150 ly, years of transit, 10% loss, supply/sustainability, failure when starved) and aggregate civilization networks with five priorities.
- Cosmic intelligence: decoding signals of unknown civilizations (FICTIONAL lore) and studying their technology for data-yield bonuses.
- 12 new technologies (fusion, antimatter, wormhole theory etc.; SPECULATIVE/FICTIONAL ones labelled), 10 achievements and eras, procedurally generated mysteries, unlimited method refinement, chronicle compaction and a universe-memory summary.
- Views: Galactic Map, Interstellar Civilization (colonies, networks), Frontier and Achievements; decode/study buttons in the mysteries view.
- Save format 7 with migration from v6 (real v6 fixture). Saves v1 to v6 still load.

## 0.5.0 (V4) 
- The Unknown: mystery engine, hypotheses, conclusions with consequences, anomaly network, decisions, rare events, unknown civilizations (all FICTIONAL, clearly labelled), explorer and archive integration.
- Save format 6 with migration from v5 (real v5 fixture). Anomalies can have a rare FICTIONAL extraordinary cause that opens a mystery.

## 0.4.0 (V3 in progress) - milestone 3
- Planetary exploration stages (orbital survey to prepared site) advanced by real expeditions; landing vessels needed for surface stages; hostile bodies capped.
- Facilities: deep space relay (+25 AU range), orbital factory, volatiles and ore mines, outposts and settlements; staffing, upkeep, condition, relay-connection rules; materials import and stock.
- Spacecraft design (chassis, propulsion, hull, bays) and construction in the factory; volatiles refuel ships for free.
- Interstellar precursor probes (SPECULATIVE): decades of cruise, light-travel data delay, possible loss.
- Civilization index, tiers, safety doctrine and expansion pace policies; solar-system map.
- Save format 5 with migration from v4 (real v4 fixture). Version 0.4.0.

## 0.3.0 (in progress) - milestone 2c
- Earth contracts (survey, expedition, discovery quota) with deadlines, rewards and penalties; emergency missions that unlock the Emergency mission expedition type only while a request is active.
- Budget allocation (science / operations / expeditions / reserve) with real multipliers; reserve share of each grant becomes savings that cover a deficit.
- Discovery Archive: sorting and side-by-side comparison.
- Test that renders every view module (catches syntax errors the engine tests cannot).
- Not done in V2: data-economy uses beyond dataset quality fields, research-category requirement tiers, per-autosave rotating backups (only pre-migration backups exist).

## 0.3.0 (in progress) - milestone 2b
- 43 technologies in 10 branches with status labels (established / hypothesis / speculative), data requirements (analysed datasets by kind) and unlock effects; visual SVG tech tree.
- Six purchasable instruments unlocked by technology (spectral, infrared, X-ray, gamma, neutrino, gravitational-wave); instrument catalogue in the Observatory; capabilities refresh from the catalog so old saves gain new target classes.
- New real astronomy data: pulsars and neutron stars, star clusters, asteroids and comets (plus Pluto); datasets now carry noise, completeness, reliability and value.
- Staged anomaly investigation (detection to classification) with noisy evidence, hidden cause, disputed misclassification and re-opening.
- Save format 4 with migration from v3 (real v3 fixture added to tests).

## 0.3.0 (in progress) – V2 milestone 2 (save format 3)
Added: speed ladder 1x–100x; event scheduler; spacecraft fleet (8 classes, equipment, ordering, overhaul); multi-stage expeditions (preparation, launch, transit, operation, data collection, recovery, analysis; failure, abort, cancel, stranding and recovery missions); communication links with five states and transmission history; crew recruitment, specialisations, training, experience and shift policy; richer dataset fields; 12 new engine tests and a V2 save fixture.
Changed: save format 2 → 3 (migration with automatic backup); navigation grouped.

## 0.2.0 – V2 milestone 1 (save format 2)
Added: structured event records and transient science alerts; station infrastructure (10 modules); scientific publications; civilization history; monthly financial reports, warnings and reserve; save backups before migration and recovery; three new sections (Station Infrastructure, Publications, Civilization History); 11 new engine tests plus a V1 save fixture.
Changed: save format 1 → 2 (automatic migration; the original V1 save is never modified and a backup copy is made). Discoveries now carry a category (Known Universe or Simulated Event).
Preserved: every V1 feature and all V1 save data.
Not done: see README "NOT implemented yet".

## 0.1.0 – V1 foundation
Engine, 59 real objects, 14 sections, observatory, research, crew, station, missions, Earth communications, events, anomalies, archive, finance, saves, 24 tests.
