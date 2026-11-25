// V5.2 Galactic civilization: interstellar research stations, mines, industrial hubs and relay nodes at other stars.
// Colonies must stay supplied: logistics efficiency, material stock and distance decide whether they survive. A colony that runs out of supply fails.
// SIMULATED game values. The destinations are REAL stars (with simulated planets) or FICTIONAL procedural systems.
import { DAY } from './constants.js';
import { spend, addCredits } from './finance.js';
import { schedule, onSchedule } from './scheduler.js';
import { record } from './chronicle.js';
import { getSystem } from './galaxy.js';
import { cruiseC } from './interstellar.js';
import { efficiency, netMult } from './network.js';

export const YEAR = 365.25 * DAY;
export const COLONY_TYPES = {
  station: { label: 'Interstellar research station', cost: 22000, materials: 150, popCap: 20, upkeep: 120, produces: 'research', desc: 'Researchers turn local conditions into research points.' },
  mine: { label: 'Mining colony', cost: 20000, materials: 130, popCap: 12, upkeep: 110, produces: 'materials', desc: 'Produces materials and volatiles from the system.' },
  hub: { label: 'Industrial hub', cost: 26000, materials: 180, popCap: 16, upkeep: 150, produces: 'manufacturing', desc: 'Adds manufacturing and logistics capacity to the network.' },
  relay: { label: 'Relay node', cost: 15000, materials: 90, popCap: 4, upkeep: 80, produces: 'communications', desc: 'Adds communications capacity and extends the reach of the network.' }
};
export const SETTLER_RC = 500; export const MAX_DISTANCE_LY = 150;
export const colonyUnlocked = game => game.unlocked('facility:colony');
export function canFound(game, sysId, type, pop) {
  const s = game.state; const sys = getSystem(game, sysId); const t = COLONY_TYPES[type]; pop = Math.round(pop);
  if (!colonyUnlocked(game)) return { ok: false, error: 'Research Interstellar colonization first.' };
  if (!sys) return { ok: false, error: 'Survey the sector first: that system is not in your catalogue.' }; if (!t) return { ok: false, error: 'Unknown colony type.' };
  if (sys.distance_ly > MAX_DISTANCE_LY) return { ok: false, error: `Colonies are limited to ${MAX_DISTANCE_LY} ly from the Sun.` };
  if (s.colonies.some(c => c.systemId === sysId && c.status !== 'failed')) return { ok: false, error: 'There is already a colony in that system.' };
  if (s.colonies.filter(c => c.status !== 'failed').length >= 8) return { ok: false, error: 'At most 8 colonies can be supported.' };
  if (!(pop >= 2 && pop <= t.popCap)) return { ok: false, error: `Settlers must be between 2 and ${t.popCap}.` };
  if (s.stock.materials < t.materials) return { ok: false, error: `Needs ${t.materials} materials (you have ${Math.floor(s.stock.materials)}).` };
  const total = t.cost + pop * SETTLER_RC; if (s.resources.credits < total) return { ok: false, error: `Needs ${total} RC.` };
  if (sys.planets.length === 0 && type !== 'relay') return { ok: false, error: 'This system has no planets to settle. Only relay nodes can be built here.' };
  return { ok: true };
}
export const transitYears = (game, sys) => sys.distance_ly / cruiseC(game);
export function foundColony(game, sysId, type, pop) {
  const c = canFound(game, sysId, type, pop); if (!c.ok) return c; const s = game.state; const sys = getSystem(game, sysId); const t = COLONY_TYPES[type]; pop = Math.round(pop);
  spend(game, t.cost + pop * SETTLER_RC, `Colony: ${t.label} at ${sys.name}`); s.stock.materials -= t.materials; const yrs = transitYears(game, sys);
  const col = { id: `col-${s.uid++}`, systemId: sysId, name: sys.name, real: sys.real, type, status: 'transit', pop, distanceLy: sys.distance_ly, foundedAt: s.time.t, arriveAt: s.time.t + yrs * YEAR, supply: 80, lowDays: 0, produced: 0, rating: Math.max(0, ...sys.planets.map(p => p[type === 'mine' ? 'materials' : 'volatiles'] ?? 1)) };
  s.colonies.push(col); schedule(game, col.arriveAt, 'colony-arrive', { id: col.id });
  game.log(`Colony ship launched to ${sys.name} (${yrs.toFixed(1)} years). ${sys.real ? '' : 'FICTIONAL system.'}`, 'info');
  record(game, { kind: 'civilization', title: `Colony expedition launched to ${sys.name}`, text: `${t.label}, ${pop} settlers, ${yrs.toFixed(1)} years.`, major: true, ref: col.id }); return { ok: true, colony: col, years: yrs };
}
onSchedule('colony-arrive', (game, { id }) => {
  const s = game.state; const c = s.colonies.find(x => x.id === id); if (!c || c.status !== 'transit') return;
  if (game.rand() < 0.1) { c.status = 'failed'; c.reason = 'The colony ship was lost in transit.'; game.log(`The colony ship to ${c.name} was lost.`, 'bad'); record(game, { kind: 'civilization', title: `Colony ship to ${c.name} lost`, text: c.reason, ref: c.id }); return; }
  c.status = 'active'; c.activeAt = s.time.t; game.log(`${COLONY_TYPES[c.type].label} established at ${c.name}.`, 'good');
  record(game, { kind: 'civilization', title: `${COLONY_TYPES[c.type].label} established at ${c.name}`, text: `${c.pop} residents.`, major: true, ref: c.id });
});
export function colonyDaily(game) {
  const s = game.state; const logi = efficiency(game, 'logistics'), res = efficiency(game, 'research'), man = efficiency(game, 'manufacturing');
  for (const c of s.colonies) {
    if (c.status !== 'active') continue; const t = COLONY_TYPES[c.type];
    addCredits(game, -Math.round((t.upkeep + c.pop * 5) * 10) / 10, `Colony upkeep: ${c.name}`, 'expense');
    // supply: logistics efficiency and a small materials draw keep the colony alive; distance makes it harder
    const need = 0.25 + c.distanceLy / 400; let delta = (logi * 1.25 * netMult(game, 'logistics')) - 1 - c.distanceLy / 600;
    if (s.stock.materials >= need) { s.stock.materials -= need; delta += 0.15; } else delta -= 1.2;
    c.supply = Math.max(0, Math.min(100, c.supply + delta)); c.lowDays = c.supply <= 0 ? c.lowDays + 1 : 0;
    const eff = Math.min(1, c.supply / 50) * (t.produces === 'research' ? res : t.produces === 'manufacturing' ? man : 1);
    if (c.supply > 60 && c.pop < t.popCap && Math.floor(s.time.t / DAY) % 30 === 0) c.pop += 1;
    if (t.produces === 'research') { const rp = 0.8 * c.pop * eff * netMult(game, 'research'); s.resources.researchPoints += rp; c.produced += rp; }
    if (t.produces === 'materials') { const out = 5 * (c.rating / 3 + 0.3) * eff; s.stock.materials += out; s.stock.volatiles += out * 0.4; c.produced += out; }
    if (c.lowDays >= 30) { c.status = 'failed'; c.reason = 'Supplies ran out. The colony was abandoned.'; game.log(`${c.name} has failed: supplies ran out.`, 'bad'); record(game, { kind: 'civilization', title: `Colony at ${c.name} failed`, text: c.reason, major: true, ref: c.id }); }
    else if (c.supply < 25 && !c.warned) { c.warned = true; game.log(`${c.name} is running short of supplies.`, 'warn'); } else if (c.supply > 40) c.warned = false;
  }
}
