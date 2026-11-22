// Shared constants. All simulation time is in game seconds since 2189-01-01 00:00 UTC.
export const SAVE_VERSION = 1;
export const GAME_NAME = 'DEEP SIGNAL: BEYOND THE OBSERVABLE';
export const GAME_VERSION = '0.1.0';
export const EPOCH_MS = Date.UTC(2189, 0, 1);
export const DAY = 86400;
export const HOUR = 3600;
export const TICK = 600; // fixed simulation step: 10 game minutes

// Game seconds per real second.
export const SPEEDS = [
  { id: 0, label: 'Paused', gameSecondsPerSecond: 0 },
  { id: 1, label: '1 min/s', gameSecondsPerSecond: 60 },
  { id: 2, label: '10 min/s', gameSecondsPerSecond: 600 },
  { id: 3, label: '1 h/s', gameSecondsPerSecond: 3600 },
  { id: 4, label: '6 h/s', gameSecondsPerSecond: 21600 },
  { id: 5, label: '1 day/s', gameSecondsPerSecond: 86400 }
];

export const LY_PER_AU = 1 / 63241.077;

export const ASSIGNMENTS = [
  { id: 'operations', label: 'Observatory operations', hint: 'Required to start observations. Operator skill improves data quality.' },
  { id: 'research', label: 'Research and analysis', hint: 'Analyses datasets and advances research projects.' },
  { id: 'maintenance', label: 'Maintenance', hint: 'Repairs station systems and instruments.' },
  { id: 'medical', label: 'Medical', hint: 'Treats injuries and illness and supports morale.' },
  { id: 'rest', label: 'Rest', hint: 'Recovers fatigue.' }
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
