// V3 interstellar precursor probes. SPECULATIVE: the propulsion is not demonstrated (hypothesis-level technology).
// A probe cannot return. It arrives after decades and its data reaches the station after a further light-travel time.
import { DAY } from './constants.js';
import { spend } from './finance.js';
import { schedule, onSchedule } from './scheduler.js';
import { record } from './chronicle.js';
import { getObject } from './astronomy-database.js';

export const PROBE_COST = 30000; export const CRUISE_C = 0.2; export const cruiseC = game => CRUISE_C + game.techEffect('cruiseFraction'); export const MAX_LY = 15; export const YEAR = 365.25 * DAY;
export const probeTargets = game => game.data.db.list.filter(o => o.group === 'star' && o.distance_ly > 0 && o.distance_ly <= MAX_LY);
export function launchProbe(game, targetId) {
  const s = game.state; const t = getObject(game.data.db, targetId);
  if (!game.unlocked('class:interstellar')) return { ok: false, error: 'Research Interstellar precursor probes first.' };
  if (!t || t.group !== 'star' || !(t.distance_ly > 0) || t.distance_ly > MAX_LY) return { ok: false, error: `Choose a star within ${MAX_LY} light-years.` };
  if (s.interstellar.some(p => p.targetId === targetId && p.status !== 'lost')) return { ok: false, error: 'A probe is already on its way there.' };
  if (!spend(game, PROBE_COST, `Interstellar probe to ${t.name}`)) return { ok: false, error: `The probe costs ${PROBE_COST} RC.` };
  const years = t.distance_ly / cruiseC(game); const p = { id: `probe-${s.uid++}`, targetId, launchedAt: s.time.t, arriveAt: s.time.t + years * YEAR, dataAt: s.time.t + (years + t.distance_ly) * YEAR, years: Math.round(years * 10) / 10, status: 'cruise', datasets: [] };
  s.interstellar.push(p); schedule(game, p.arriveAt, 'probe-arrival', { id: p.id });
  game.log(`Interstellar probe launched toward ${t.name}: arrival in ${p.years} years (SPECULATIVE propulsion).`, 'info');
  record(game, { kind: 'mission', title: `Interstellar probe launched toward ${t.name}`, text: `Arrival in about ${p.years} years.`, major: true, ref: p.id }); return { ok: true, probe: p };
}
onSchedule('probe-arrival', (game, { id }) => {
  const s = game.state; const p = s.interstellar.find(x => x.id === id); if (!p || p.status !== 'cruise') return; const t = getObject(game.data.db, p.targetId);
  if (game.rand() < 0.25) { p.status = 'lost'; game.log(`Contact with the probe to ${t.name} was never established. It is presumed lost.`, 'bad'); record(game, { kind: 'mission', title: `Probe to ${t.name} presumed lost`, text: 'Decades of cruise took their toll.', ref: p.id }); return; }
  p.status = 'arrived'; game.log(`The probe reached ${t.name}. Its data will take ${t.distance_ly} years to reach us.`, 'good'); schedule(game, p.dataAt, 'probe-data', { id });
});
onSchedule('probe-data', (game, { id }) => {
  const s = game.state; const p = s.interstellar.find(x => x.id === id); if (!p || p.status !== 'arrived') return; const t = getObject(game.data.db, p.targetId);
  for (const kind of ['optical', 'spectral', 'planetary']) { const q = Math.round((0.6 + game.rand() * 0.3) * 100) / 100;
    s.datasets.unshift({ id: `ds-${s.uid++}`, obsId: null, expId: p.id, targetId: p.targetId, instrumentId: null, kind, quality: q, hours: 1000, t: s.time.t, partial: false, sizeGB: 40, status: 'raw', noise: Math.round((1 - q) * 60) / 100, completeness: 0.9, reliability: q, value: Math.min(1, q + 0.2) }); }
  p.status = 'complete'; s.resources.reputation += 8; s.resources.researchPoints += 150;
  game.log(`Probe data from ${t.name} received: 3 datasets, +8 reputation, +150 RP.`, 'good'); record(game, { kind: 'mission', title: `First close-up data from ${t.name}`, text: 'Delivered by an interstellar precursor probe.', major: true, ref: p.id });
});
