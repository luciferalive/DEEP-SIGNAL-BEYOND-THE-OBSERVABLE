// Shared constants. All simulation time is in game seconds since 2189-01-01 00:00 UTC.
export const SAVE_VERSION = 7;
export const GAME_NAME = 'DEEP SIGNAL: BEYOND THE OBSERVABLE';
export const GAME_VERSION = '1.0.0';
export const EPOCH_MS = Date.UTC(2189, 0, 1);
export const DAY = 86400;
export const HOUR = 3600;
export const TICK = 600; // fixed simulation step: 10 game minutes

// Speed ladder. 1x = one game hour per real second; 100x = 100 game hours per real second (about 4 days).
export const SPEEDS = [
  { id: 0, label: 'Paused', gameSecondsPerSecond: 0 },
  { id: 1, label: '1x', gameSecondsPerSecond: 3600 },
  { id: 2, label: '2x', gameSecondsPerSecond: 7200 },
  { id: 3, label: '5x', gameSecondsPerSecond: 18000 },
  { id: 4, label: '10x', gameSecondsPerSecond: 36000 },
  { id: 5, label: '25x', gameSecondsPerSecond: 90000 },
  { id: 6, label: '100x', gameSecondsPerSecond: 360000 }
];
// Old (save v1/v2) speed index -> new index.
export const OLD_SPEED_MAP = [0, 1, 1, 1, 3, 5];
export const SPECIALIZATIONS = [
  { id: 'astrophysicist', label: 'Astrophysicist', skill: 'astrophysics' }, { id: 'engineer', label: 'Engineer', skill: 'engineering' },
  { id: 'astrobiologist', label: 'Astrobiologist', skill: 'astrobiology' }, { id: 'pilot', label: 'Pilot', skill: 'robotics' },
  { id: 'robotics', label: 'Robotics specialist', skill: 'robotics' }, { id: 'comms', label: 'Communications specialist', skill: 'computing' },
  { id: 'medical', label: 'Medical officer', skill: 'medical' }, { id: 'data', label: 'Data scientist', skill: 'computing' }
];
export const SHIFT_POLICIES = { relaxed: { work: 0.9, fatigue: 0.6, label: 'Relaxed' }, normal: { work: 1, fatigue: 1, label: 'Normal' }, intensive: { work: 1.15, fatigue: 1.6, label: 'Intensive' } };

export const LY_PER_AU = 1 / 63241.077;

export const ASSIGNMENTS = [
  { id: 'operations', label: 'Observatory operations', hint: 'Required to start observations. Operator skill improves data quality.' },
  { id: 'research', label: 'Research and analysis', hint: 'Analyses datasets and advances research projects.' },
  { id: 'maintenance', label: 'Maintenance', hint: 'Repairs station systems and instruments.' },
  { id: 'medical', label: 'Medical', hint: 'Treats injuries and illness and supports morale.' },
  { id: 'rest', label: 'Rest', hint: 'Recovers fatigue.' },
  { id: 'training', label: 'Training', hint: 'Set automatically while a crew member trains.' }
];

export const SKILLS = ['astrophysics', 'astrobiology', 'engineering', 'robotics', 'computing', 'planetary', 'medical'];
export const SKILL_LABELS = { astrophysics: 'Astrophysics', astrobiology: 'Astrobiology', engineering: 'Engineering', robotics: 'Robotics', computing: 'Computer science', planetary: 'Planetary science', medical: 'Medical science' };

export const STATION_SYSTEMS = [
  { id: 'power', name: 'Solar array and power bus' },
  { id: 'lifeSupport', name: 'Life support' },
  { id: 'thermal', name: 'Thermal control' },
  { id: 'comms', name: 'Communications' },
  { id: 'lab', name: 'Research laboratory' }
];

export const BASE = {
  solarKw: 36,
  loadsKw: { lifeSupport: 6, thermal: 3, comms: 2, computing: 3, lab: 3 },
  batteryKwh: 600,
  oxygenCap: 1200, waterCap: 6000, foodCap: 1800,
  oxygenPerCrewDay: 0.84, waterPerCrewDay: 3.5, foodPerCrewDay: 1.8,
  oxygenRecycle: 0.55, waterRecycle: 0.85,
  upkeepPerDay: 110,
  monthlyGrant: 5000,
  grantEveryDays: 30,
  resupplyFirstDay: 45, resupplyEveryDays: 60
};
