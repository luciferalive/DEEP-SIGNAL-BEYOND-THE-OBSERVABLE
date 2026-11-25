// V5.1 Large-scale exploration: a sector map of the galaxy around the Sun.
// REAL: stars from the astronomy database appear in the sector where their catalogued position puts them.
// FICTIONAL (procedural): every other system is generated deterministically from the save's seed and is always labelled FICTIONAL.
// SIMULATED: resource and habitability ratings of every system, including real stars (no real survey data exists for them).
import { DAY } from './constants.js';
import { spend } from './finance.js';
import { schedule, onSchedule } from './scheduler.js';
import { record } from './chronicle.js';
import { netMult } from './network.js';

export const RINGS = [20, 50, 100, 250, 500, 1000, 2500, 8000];
export const SECTORS_PER_RING = 6;
export const sectorId = (ring, az) => `r${ring}-a${az}`;
export const ALL_SECTORS = RINGS.flatMap((_, r) => Array.from({ length: SECTORS_PER_RING }, (_, a) => sectorId(r, a)));
export const parseSector = id => { const m = /^r(\d+)-a(\d+)$/.exec(id); return m ? { ring: +m[1], az: +m[2] } : null; };
export const ringBounds = r => [r ? RINGS[r - 1] : 0, RINGS[r]];
export const sectorName = id => { const p = parseSector(id); return `Ring ${p.ring + 1} / Sector ${p.az + 1} (${ringBounds(p.ring)[0]}-${ringBounds(p.ring)[1]} ly)`; };
export const mapRangeLy = game => 100 + game.techEffect('mapRangeLy');
export const ringReachable = (game, ring) => RINGS[ring] <= mapRangeLy(game);
export const surveyedIds = game => Object.keys(game.state.galaxy.sectors).filter(k => game.state.galaxy.sectors[k].status === 'done');
export const explorationRadiusLy = game => surveyedIds(game).reduce((m, id) => Math.max(m, RINGS[parseSector(id).ring]), 0);
export const mappedFraction = game => surveyedIds(game).length / ALL_SECTORS.length;

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFor(seed, key) { let a = (hash(key) ^ (seed | 0)) | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const STAR_CLASSES = [['M', 0.55], ['K', 0.17], ['G', 0.1], ['F', 0.08], ['A', 0.05], ['B', 0.03], ['O', 0.02]];
const PLANET_TYPES = ['Rocky planet', 'Ice giant', 'Gas giant', 'Ocean world', 'Desert planet', 'Dwarf planet', 'Rocky planet'];
const pickW = (r, list) => { let x = r() * list.reduce((a, [, w]) => a + w, 0); for (const [k, w] of list) { x -= w; if (x <= 0) return k; } return list[0][0]; };

// Procedural systems of a sector (pure function of seed and sector id).
export function generateSystems(seed, id) {
  const p = parseSector(id); const [lo, hi] = ringBounds(p.ring); const out = [];
  const n = 3 + Math.floor(rngFor(seed, id + 'n')() * 4) + Math.min(3, p.ring);
  for (let k = 0; k < n; k++) {
    const r = rngFor(seed, `${id}/${k}`); const cls = pickW(r, STAR_CLASSES); const planets = r() < 0.12 ? 0 : 1 + Math.floor(r() * 7);
    const ps = Array.from({ length: planets }, (_, j) => ({ name: `${String.fromCharCode(98 + j)}`, type: PLANET_TYPES[Math.floor(r() * PLANET_TYPES.length)], habitability: Math.round(r() * r() * 100) / 100, volatiles: Math.floor(r() * 4), materials: Math.floor(r() * 4) }));
    out.push({ id: `px-${id}-${k}`, name: `PX ${p.ring + 1}-${p.az + 1}/${String.fromCharCode(65 + k)}`, designation: `PX-${id}-${k}`, real: false, label: 'FICTIONAL (procedural)', sector: id, distance_ly: Math.round(lo + (hi - lo) * (0.1 + 0.85 * r())), starClass: cls, planets: ps });
  }
  return out;
}
// Real stars in a sector, with simulated planet potentials (SIMULATED).
export function realSystems(game, id) {
  const p = parseSector(id); const [lo, hi] = ringBounds(p.ring);
  return game.data.db.list.filter(o => o.group === 'star' && o.distance_ly > lo && o.distance_ly <= hi && o.ra_deg != null && Math.floor(((o.ra_deg % 360) + 360) % 360 / (360 / SECTORS_PER_RING)) === p.az)
    .map(o => { const r = rngFor(game.state.seed, 'real-' + o.id); const nP = Math.floor(r() * 5); return { id: o.id, name: o.name, designation: o.designation, real: true, label: 'REAL star, SIMULATED planets', sector: id, distance_ly: o.distance_ly, starClass: (o.spectral_type || '?')[0], planets: Array.from({ length: nP }, (_, j) => ({ name: String.fromCharCode(98 + j), type: PLANET_TYPES[Math.floor(r() * PLANET_TYPES.length)], habitability: Math.round(r() * r() * 100) / 100, volatiles: Math.floor(r() * 4), materials: Math.floor(r() * 4) })) }; });
}
export const systemsOf = (game, id) => (game.state.galaxy.sectors[id]?.systems || []);
export const allKnownSystems = game => Object.values(game.state.galaxy.sectors).flatMap(s => s.systems || []);
export const getSystem = (game, sysId) => allKnownSystems(game).find(x => x.id === sysId);

export const surveyCost = ring => 600 + ring * 350;
export const surveyDays = (game, ring) => Math.max(6, Math.round((12 + ring * 6) * (1 / netMult(game, 'exploration', true))));
export const maxConcurrentSurveys = game => (game.unlocked('ops:fleets') ? 2 : 1);
export function canSurvey(game, id) {
  const s = game.state; const p = parseSector(id); if (!p || p.ring >= RINGS.length) return { ok: false, error: 'Unknown sector.' };
  if (!game.unlocked('galaxy:survey')) return { ok: false, error: 'Research Galactic survey arrays first.' };
  if (!ringReachable(game, p.ring)) return { ok: false, error: `Out of mapping range: this ring ends at ${RINGS[p.ring]} ly, your range is ${mapRangeLy(game)} ly.` };
  const st = s.galaxy.sectors[id]; if (st?.status === 'done') return { ok: false, error: 'Already surveyed.' }; if (st?.status === 'running') return { ok: false, error: 'Survey in progress.' };
  if (Object.values(s.galaxy.sectors).filter(x => x.status === 'running').length >= maxConcurrentSurveys(game)) return { ok: false, error: 'Survey capacity is full. Wait or unlock autonomous fleets.' };
  if (s.resources.credits < surveyCost(p.ring)) return { ok: false, error: `Needs ${surveyCost(p.ring)} RC.` };
  return { ok: true };
}
export function startSurvey(game, id) {
  const c = canSurvey(game, id); if (!c.ok) return c; const s = game.state; const p = parseSector(id);
  spend(game, surveyCost(p.ring), `Sector survey: ${sectorName(id)}`); const days = surveyDays(game, p.ring);
  s.galaxy.sectors[id] = { status: 'running', startedAt: s.time.t, doneAt: s.time.t + days * DAY, systems: [] }; schedule(game, s.galaxy.sectors[id].doneAt, 'sector-survey', { id });
  game.log(`Survey started: ${sectorName(id)} (${days} days).`, 'info'); return { ok: true, days };
}
onSchedule('sector-survey', (game, { id }) => {
  const s = game.state; const sec = s.galaxy.sectors[id]; if (!sec || sec.status !== 'running') return; const p = parseSector(id);
  sec.systems = [...realSystems(game, id), ...generateSystems(s.seed, id)]; sec.status = 'done'; s.galaxy.count = surveyedIds(game).length;
  const rp = 10 + p.ring * 8; s.resources.researchPoints += rp; const first = !surveyedIds(game).some(x => x !== id && parseSector(x).ring === p.ring);
  game.log(`${sectorName(id)} mapped: ${sec.systems.filter(x => x.real).length} real and ${sec.systems.filter(x => !x.real).length} procedural (FICTIONAL) systems. +${rp} RP.`, 'good');
  record(game, { kind: 'exploration', title: `Sector mapped: ${sectorName(id)}`, text: `${sec.systems.length} systems catalogued.`, major: first, ref: id });
});
