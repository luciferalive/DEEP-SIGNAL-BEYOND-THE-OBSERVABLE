// Communication links between the station, Earth and remote assets. Distances are simplified: a vessel at a Solar System
// target is |target AU − 1| from Earth (orbital geometry is not simulated).
import { DAY } from './constants.js';
import { getObject } from './astronomy-database.js';

export const LIGHT_MIN_PER_AU = 8.317;
export const STATES = ['connected', 'delayed', 'weak', 'interrupted', 'offline'];
export const commRangeAu = game => 25 + game.techEffect('commRangeAu') + 15 * (game.state.modules?.communications.level - 1 || 0) + (game.networkRangeBonus?.() || 0);

export function earthDistanceAu(game, ship) {
  const loc = ship.location || { kind: 'dock' };
  const au = id => { const o = getObject(game.data.db, id); return o && o.distance_au != null ? Math.abs(o.distance_au - 1) + 0.01 : 0.01; };
  if (loc.kind === 'dock') return 0.01;
  if (loc.kind === 'transit') { const f = Math.min(1, Math.max(0, (game.state.time.t - loc.departed) / Math.max(1, loc.eta - loc.departed))); const a = loc.from === 'station' ? 0.01 : au(loc.from), b = loc.to === 'station' ? 0.01 : au(loc.to); return a + (b - a) * (loc.outbound === false ? 1 - f : f) * 1; }
  return au(loc.at);
}
export function linkStatus(game, ship) {
  const s = game.state; const d = earthDistanceAu(game, ship); const delay = d * LIGHT_MIN_PER_AU;
  const sys = ship.systems?.communications ?? 100; const range = commRangeAu(game);
  let state = 'connected';
  if (ship.status === 'Lost' || ship.status === 'Expended' || sys < 5 || d > range) state = 'offline';
  else if ((s.comms.interruptedUntil || 0) > s.time.t || (ship.commsDownUntil || 0) > s.time.t) state = 'interrupted';
  else if (sys < 40 || d > range * 0.7) state = 'weak';
  else if (delay >= 5) state = 'delayed';
  return { state, distanceAu: d, delayMin: delay, rangeAu: range, usable: state !== 'offline' && state !== 'interrupted' };
}
export function logTransmission(game, { from, to, kind, text, delayMin = 0 }) {
  const h = game.state.comms.history; h.unshift({ t: game.state.time.t, from, to, kind, text, delayMin: Math.round(delayMin * 10) / 10 }); if (h.length > 150) h.length = 150;
}
export function interruptComms(game, hours, why) { const s = game.state; s.comms.interruptedUntil = Math.max(s.comms.interruptedUntil || 0, s.time.t + hours * 3600); logTransmission(game, { from: 'Network', to: 'All', kind: 'notification', text: `Communications interrupted (${why}) for about ${hours} h.` }); }
export const endpoints = game => [{ id: 'earth', name: 'Earth Mission Control', kind: 'Earth', state: (game.state.comms.interruptedUntil || 0) > game.state.time.t ? 'interrupted' : 'connected', delayMin: LIGHT_MIN_PER_AU * 0.01 }, ...game.state.spacecraft.map(sh => ({ id: sh.id, name: sh.name, kind: 'Spacecraft', ...linkStatus(game, sh) }))];
