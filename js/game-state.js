// Creating, validating and migrating the saved game state.
import { SAVE_VERSION, BASE, GAME_VERSION } from './constants.js';

const CREW = [
  { name: 'Cmdr. Amara Okafor', role: 'Station Commander', specialization: 'Astrophysics', experience: 14, assignment: 'operations', skills: { astrophysics: 8, astrobiology: 3, engineering: 4, robotics: 3, computing: 6, planetary: 5, medical: 2 } },
  { name: 'Dr. Mateo Ruiz', role: 'Chief Engineer', specialization: 'Engineering', experience: 11, assignment: 'maintenance', skills: { astrophysics: 3, astrobiology: 1, engineering: 9, robotics: 6, computing: 5, planetary: 2, medical: 2 } },
  { name: 'Dr. Ingrid Solheim', role: 'Planetary Scientist', specialization: 'Planetary science', experience: 8, assignment: 'research', skills: { astrophysics: 6, astrobiology: 6, engineering: 2, robotics: 3, computing: 5, planetary: 8, medical: 2 } },
  { name: 'Dr. Kavya Menon', role: 'Data Scientist', specialization: 'Computer science', experience: 6, assignment: 'research', skills: { astrophysics: 5, astrobiology: 2, engineering: 3, robotics: 5, computing: 9, planetary: 3, medical: 1 } },
  { name: 'Dr. Tomasz Wiśniewski', role: 'Flight Surgeon', specialization: 'Medical science', experience: 10, assignment: 'rest', skills: { astrophysics: 2, astrobiology: 5, engineering: 2, robotics: 2, computing: 3, planetary: 2, medical: 9 } }
];

export function createNewGame(seed = Date.now() % 2147483647) {
  const crew = CREW.map((c, i) => ({ id: `crew-${i + 1}`, ...c, skills: { ...c.skills }, health: 100, morale: 78, fatigue: 5 }));
  return {
    version: SAVE_VERSION, gameVersion: GAME_VERSION, seed, rng: seed | 0, uid: 1,
    time: { t: 8 * 3600, speed: 0, paused: true, lastDay: 0 },
    location: 'Sun–Earth L2 (1.5 million km from Earth)',
    station: { name: 'Meridian Station', systems: { power: { condition: 100 }, lifeSupport: { condition: 100 }, thermal: { condition: 100 }, comms: { condition: 100 }, lab: { condition: 100 } }, condition: 100, battery: 480, brownout: false, power: { gen: 0, load: 0 } },
    resources: { oxygen: 640, water: 3000, food: 1350, credits: 2000, researchPoints: 10, reputation: 0 },
    crew,
    spacecraft: [{ id: 'ship-1', name: 'ESV Calliope', type: 'Research vessel', status: 'Docked', propulsion: 'Chemical bipropellant', fuel: 700, fuelCap: 800, systems: { propulsion: 100, power: 100, navigation: 100, communications: 100, lifeSupport: 100, radiation: 100, computing: 100 }, notes: 'Small short-range research vessel. Cannot yet leave the Earth–Moon–L2 neighbourhood.' }],
    instruments: [],
    observations: [], datasets: [], analyses: [], discoveries: [], anomalies: [],
    missions: { active: [], completed: [], declined: [], offered: [] },
    messages: [],
    tech: { researched: {}, active: null },
    events: { pending: null, history: [], pauseObsUntil: 0, records: [], responses: [] },
    finance: { ledger: [], lastGrantDay: 0, nextResupplyDay: BASE.resupplyFirstDay, lastSupplyRequestDay: -999, reports: [], period: { income: 0, expense: 0, byCat: {} }, reserve: 600 },
    chronicle: [], publications: [], modules: {},
    bookmarks: [], tracked: [], destinations: [],
    history: { oxygen: [], water: [], food: [], power: [], credits: [] },
    log: [],
    stats: { observations: 0, analyses: 0, daysElapsed: 0 },
    flags: {}
  };
}

export function validateState(s) {
  const problems = [];
  if (!s || typeof s !== 'object') return ['Save is not an object.'];
  if (typeof s.version !== 'number') problems.push('Missing save version.');
  for (const key of ['time', 'resources', 'crew', 'station', 'missions', 'finance']) if (!s[key]) problems.push(`Missing "${key}".`);
  if (s.version < 1) problems.push('Invalid save version.');
  for (const key of ['crew', 'discoveries', 'observations', 'datasets', 'messages']) if (s[key] !== undefined && !Array.isArray(s[key])) problems.push(`"${key}" is damaged.`);
  if (s.version > SAVE_VERSION) problems.push(`Save version ${s.version} is newer than this game supports (${SAVE_VERSION}).`);
  return problems;
}

// Future versions add migration steps here. Never drop data silently.
const STEPS = {
  // 1 -> 2: structured event records, civilization history, publications, station modules, monthly reports.
  1: s => {
    s.events.records = s.events.records || []; s.events.responses = s.events.responses || [];
    s.chronicle = s.chronicle || []; s.publications = s.publications || []; s.modules = s.modules || {};
    s.finance.reports = s.finance.reports || []; s.finance.period = s.finance.period || { income: 0, expense: 0, byCat: {} }; if (s.finance.reserve == null) s.finance.reserve = 600;
    for (const d of s.discoveries || []) if (!d.category) d.category = 'Known Universe';
  }
};
export function migrate(state) {
  const s = state;
  while (s.version < SAVE_VERSION) { STEPS[s.version]?.(s); s.version += 1; }
  s.gameVersion = GAME_VERSION;
  for (const [k, v] of Object.entries({ bookmarks: [], tracked: [], destinations: [], anomalies: [], flags: {} })) if (!s[k]) s[k] = v;
  return s;
}
