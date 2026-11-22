# Systems (0.2.0)

| System | Module | Notes |
| --- | --- | --- |
| Time | time-engine.js | 10-minute tick, 6 speeds |
| Station | station.js, station-modules.js | power, life support, wear; 10 modules with levels 1–4 |
| Crew | crew-management.js | 5 crew, 5 assignments, fatigue/morale/health |
| Observatory | observatory.js | optical and radio instruments, 2–24 h exposures |
| Research | research-engine.js | analysis → discovery; 7 technologies |
| Publications | publications.js | preliminary, mission, paper, anomaly, major; peer review can return work |
| Events | cosmic-events.js | decision events plus time-limited transient alerts; all recorded |
| Missions / Earth | mission-control.js | 6 missions, funding, convoys, verification |
| Finance | finance.js | daily upkeep, monthly grant and report, warnings, reserve |
| History | chronicle.js | permanent milestone timeline |
| Saves | save-manager.js, game-state.js | IndexedDB, export/import, backups, recovery |

Formulas live in the modules; tuning constants are in `constants.js` and `data/*.json`.
