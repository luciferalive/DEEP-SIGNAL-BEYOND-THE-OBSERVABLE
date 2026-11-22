// Crew: assignments, fatigue, morale, health and the work rates other systems use.
import { ASSIGNMENTS, DAY } from './constants.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const isAvailable = c => c.health >= 25;
const efficiency = c => clamp(1 - c.fatigue / 200, 0.5, 1) * clamp(c.health / 100, 0.3, 1);

export function setAssignment(game, crewId, assignment) {
  const c = game.state.crew.find(x => x.id === crewId);
  if (!c) return { ok: false, error: 'No such crew member.' };
  if (!ASSIGNMENTS.some(a => a.id === assignment)) return { ok: false, error: 'Unknown assignment.' };
  c.assignment = assignment;
  return { ok: true };
}

// Work done per game hour by each assignment.
export function workRates(game) {
  const r = { operations: 0, research: 0, maintenance: 0, medical: 0, bestOperator: 0 };
  for (const c of game.state.crew) {
    if (!isAvailable(c)) continue; const e = efficiency(c) * (1 + game.moduleEffect('crewEfficiency')); const k = c.skills;
    if (c.assignment === 'operations') { r.operations += 1; r.bestOperator = Math.max(r.bestOperator, ((k.astrophysics + k.computing) / 2) * e); }
    if (c.assignment === 'research') r.research += ((k.astrophysics + k.computing + k.planetary) / 3) * e;
    if (c.assignment === 'maintenance') r.maintenance += k.engineering * e;
    if (c.assignment === 'medical') r.medical += k.medical * e;
  }
  return r;
}

export function crewTick(game, dt) {
  const s = game.state; const days = dt / DAY; const res = s.resources;
  const oxygenDays = res.oxygen / Math.max(0.01, s.crew.length * 0.84 * 0.5);
  const foodDays = res.food / Math.max(0.01, s.crew.length * 1.8);
  const medics = workRates(game).medical;
  const techBonus = game.techEffect('moraleBonus') + game.moduleEffect('moraleBonus');
  for (const c of s.crew) {
    const working = c.assignment !== 'rest';
    c.fatigue = clamp(c.fatigue + (working ? 4 : -12) * days, 0, 100);
    let target = 78 + techBonus - Math.max(0, c.fatigue - 40) * 0.5 + (c.assignment === 'rest' ? 6 : 0) + Math.min(6, medics * 0.4);
    if (s.station.brownout) target -= 15;
    if (foodDays < 14) target -= 12; if (oxygenDays < 14) target -= 25;
    c.morale = clamp(c.morale + clamp(target - c.morale, -6, 6) * days * 0.5, 0, 100);
    // Health: slow recovery with medical support, loss when supplies run out.
    let dh = 0.8 + Math.min(2.5, medics * 0.15) + game.moduleEffect('healthRecovery');
    if (res.oxygen <= 0) dh = -25; else if (res.food <= 0) dh = -6; else if (res.water <= 0) dh = -10;
    if (s.station.systems.lifeSupport.condition < 25) dh -= 2;
    c.health = clamp(c.health + dh * days, res.oxygen <= 0 ? 0 : 5, 100); // crew are incapacitated, never lost, while any oxygen remains
  }
}
export const crewSummary = game => {
  const c = game.state.crew; const n = c.length || 1;
  return { count: c.length, health: c.reduce((a, x) => a + x.health, 0) / n, morale: c.reduce((a, x) => a + x.morale, 0) / n, fatigue: c.reduce((a, x) => a + x.fatigue, 0) / n, incapacitated: c.filter(x => !isAvailable(x)).length };
};
