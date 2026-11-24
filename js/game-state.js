// Creating, validating and migrating the saved game state.
import { SAVE_VERSION, BASE, GAME_VERSION } from './constants.js';

const SPEC = { 'crew-1': 'astrophysicist', 'crew-2': 'engineer', 'crew-3': 'astrobiologist', 'crew-4': 'data', 'crew-5': 'medical' };
const CREW = [
  { name: 'Cmdr. Amara Okafor', role: 'Station Commander', specialization: 'Astrophysics', experience: 14, assignment: 'operations', skills: { astrophysics: 8, astrobiology: 3, engineering: 4, robotics: 3, computing: 6, planetary: 5, medical: 2 } },
  { name: 'Dr. Mateo Ruiz', role: 'Chief Engineer', specialization: 'Engineering', experience: 11, assignment: 'maintenance', skills: { astrophysics: 3, astrobiology: 1, engineering: 9, robotics: 6, computing: 5, planetary: 2, medical: 2 } },
  { name: 'Dr. Ingrid Solheim', role: 'Planetary Scientist', specialization: 'Planetary science', experience: 8, assignment: 'research', skills: { astrophysics: 6, astrobiology: 6, engineering: 2, robotics: 3, computing: 5, planetary: 8, medical: 2 } },
  { name: 'Dr. Kavya Menon', role: 'Data Scientist', specialization: 'Computer science', experience: 6, assignment: 'research', skills: { astrophysics: 5, astrobiology: 2, engineering: 3, robotics: 5, computing: 9, planetary: 3, medical: 1 } },
  { name: 'Dr. Tomasz Wiśniewski', role: 'Flight Surgeon', specialization: 'Medical science', experience: 10, assignment: 'rest', skills: { astrophysics: 2, astrobiology: 5, engineering: 2, robotics: 2, computing: 3, planetary: 2, medical: 9 } }
];

export function createNewGame(seed = Date.now() % 2147483647) {
  const crew = CREW.map((c, i) => ({ id: `crew-${i + 1}`, ...c, skills: { ...c.skills }, health: 100, morale: 78, fatigue: 5, spec: SPEC[`crew-${i + 1}`], xp: {}, missionId: null, training: null }));
  return {
    version: SAVE_VERSION, gameVersion: GAME_VERSION, seed, rng: seed | 0, uid: 1,
    time: { t: 8 * 3600, speed: 0, paused: true, lastDay: 0 },
    location: 'Sun–Earth L2 (1.5 million km from Earth)',
    station: { shift: 'normal', name: 'Meridian Station', systems: { power: { condition: 100 }, lifeSupport: { condition: 100 }, thermal: { condition: 100 }, comms: { condition: 100 }, lab: { condition: 100 } }, condition: 100, battery: 480, brownout: false, power: { gen: 0, load: 0 } },
    resources: { oxygen: 640, water: 3000, food: 1350, credits: 2000, researchPoints: 10, reputation: 0 },
    crew,
    spacecraft: [{ id: 'ship-1', name: 'ESV Calliope', class: 'science-vessel', type: 'Science vessel', status: 'Docked', propulsion: 'Chemical bipropellant', fuel: 700, fuelCap: 800, energy: 100, systems: { propulsion: 100, power: 100, navigation: 100, communications: 100, lifeSupport: 100, radiation: 100, computing: 100 }, equipment: ['opt-cam', 'spec-1'], crewIds: [], cargo: { used: 0, cap: 200 }, location: { kind: 'dock', at: 'station' }, missionId: null, commsDownUntil: 0, maintenance: { hours: 0, dueAt: 60 * 86400 }, hullCondition: 100, notes: 'Short-range crewed research vessel. Needs a pilot to fly.' }],
    instruments: [],
    observations: [], datasets: [], analyses: [], discoveries: [], anomalies: [],
    missions: { active: [], completed: [], declined: [], offered: [] },
    messages: [],
    tech: { researched: {}, active: null },
    events: { pending: null, history: [], pauseObsUntil: 0, records: [], responses: [] },
    finance: { ledger: [], lastGrantDay: 0, nextResupplyDay: BASE.resupplyFirstDay, lastSupplyRequestDay: -999, reports: [], period: { income: 0, expense: 0, byCat: {} }, reserve: 600 },
    chronicle: [], publications: [], modules: {},
    schedule: [], expeditions: [], comms: { interruptedUntil: 0, history: [] }, earth: { completed: 0, failed: 0, aborted: 0 },
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
const SPEC_BY_NAME = { astrophysics: 'astrophysicist', engineering: 'engineer', 'planetary science': 'astrobiologist', 'computer science': 'data', 'medical science': 'medical' };
const STEPS = {
  // 3 -> 4: staged anomaly investigation, instrument data fields. V1-V3 anomalies were all instrument artefacts, so they keep that cause.
  3: s => {
    for (const a of s.anomalies || []) {
      if (a.evidence === undefined) {
        a.evidence = []; a.hypothesis = null; a.pending = null; a.cause = a.cause || 'instrument-error'; a.category = a.category || 'Known Universe';
        if (a.status === 'resolved') { a.classification = 'instrument-error'; a.stage = 'CLASSIFICATION'; a.truthRevealed = true; a.reviewed = 'upheld'; a.confirmed = true; } else { a.classification = null; a.stage = 'DETECTION'; }
      }
    }
    for (const d of s.datasets || []) if (d.noise === undefined) { d.noise = Math.round((1 - d.quality) * 60) / 100; d.completeness = d.partial ? 0.55 : Math.min(0.99, 0.8 + d.quality * 0.2); d.reliability = Math.round(d.quality * 0.9 * 100) / 100; d.value = d.quality; }
    s.earth = s.earth || {}; s.earth.contracts = s.earth.contracts || []; s.budget = s.budget || null;
  },
  // 2 -> 3: speed ladder, spacecraft classes, scheduler, expeditions, communications, crew specialisations and experience.
  2: s => {
    const OLD = [0, 1, 1, 1, 3, 5]; s.time.speed = OLD[s.time.speed] ?? 0; if (s.time.speed === 0) s.time.paused = true;
    s.schedule = s.schedule || []; s.expeditions = s.expeditions || []; s.comms = s.comms || { interruptedUntil: 0, history: [] }; s.earth = s.earth || { completed: s.missions.completed.length, failed: 0, aborted: 0 }; s.station.shift = s.station.shift || 'normal';
    for (const c of s.crew) { c.spec = c.spec || SPEC_BY_NAME[(c.specialization || '').toLowerCase()] || 'astrophysicist'; c.xp = c.xp || {}; if (c.missionId === undefined) c.missionId = null; if (c.training === undefined) c.training = null; }
    s.spacecraft.forEach((sh, i) => { Object.assign(sh, { class: sh.class || 'science-vessel', type: sh.class ? sh.type : 'Science vessel', equipment: sh.equipment || ['opt-cam', 'spec-1'], crewIds: sh.crewIds || [], cargo: sh.cargo || { used: 0, cap: 200 }, location: sh.location || { kind: 'dock', at: 'station' }, missionId: sh.missionId ?? null, commsDownUntil: sh.commsDownUntil || 0, maintenance: sh.maintenance || { hours: 0, dueAt: s.time.t + 60 * 86400 }, hullCondition: sh.hullCondition ?? 100, energy: sh.energy ?? 100 }); });
    for (const d of s.datasets || []) if (d.noise === undefined) { d.noise = Math.round((1 - d.quality) * 60) / 100; d.completeness = d.partial ? 0.55 : Math.min(0.99, 0.8 + d.quality * 0.2); d.reliability = Math.round(d.quality * 0.95 * 100) / 100; d.value = d.quality; d.derived = true; }
  },
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
