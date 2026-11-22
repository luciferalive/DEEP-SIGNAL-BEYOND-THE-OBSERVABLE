# Architecture notes (v0.1.0)

- Engine modules never touch the DOM; `Game` owns state and advances it in fixed 600-second ticks. `Clock` converts real time to ticks.
- All randomness uses a seeded mulberry32 generator stored in `state.rng`, so saves replay identically.
- Data files load through an injected reader (`fetch` in the browser, `fs` in tests).
- Commands return `{ ok, error }`; the UI shows errors as toasts.
- Saves: `SaveManager` with `IndexedDbBackend`; format `deep-signal-save`, `SAVE_VERSION = 1`, with `validateState` and `migrate`.
- UI: `data-act` attributes with one delegated handler in `ui-manager.js`; views are pure functions returning HTML strings. Rendering is throttled and preserves focus, caret, scroll and open `<details>`.
