# Architecture (0.2.0)

- `js/` engine modules are DOM-free and tested in Node. `Game` (game-engine.js) owns state and advances it in fixed 600 s ticks; `Clock` maps real time to ticks.
- Tick order: station → crew → observatory → research → ship → station modules → publications → events → mission control → daily finance.
- All randomness uses seeded mulberry32 in `state.rng`; same seed = same game, and saves continue identically (tested).
- Data is JSON in `data/` and loaded through an injected reader. Real astronomy (`solar-system`, `stars`, `exoplanets`, `black-holes`, `galaxies`, `nebulae`) is separate from game content (`instruments`, `technologies`, `missions`, `events`, `modules`).
- Cross-system effects go through `game.techEffect(type)` and `game.moduleEffect(key)`; systems never read each other's private data.
- Saves: `SaveManager` + `IndexedDbBackend`; format `deep-signal-save`, `SAVE_VERSION = 2`; `validateState`, stepwise `migrate` (STEPS keyed by old version), automatic `backup-<slot>-v<n>` before upgrading, `recover()`.
- UI: views are pure functions returning HTML; `ui-manager.js` routes, throttles rendering (preserving focus, scroll, open details) and handles every `data-act` action by delegation.
- Migration rule for new versions: add a `STEPS[n]` function that only adds data, bump `SAVE_VERSION`, add a fixture and test.
