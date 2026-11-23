// Crew: assignments, fatigue, morale, health and the work rates other systems use.
import { ASSIGNMENTS, DAY, SPECIALIZATIONS, SHIFT_POLICIES, SKILLS } from './constants.js';
import { spend } from './finance.js';
import { schedule, onSchedule } from './scheduler.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const isAvailable = c => c.health >= 25 && !c.missionId && c.assignment !== 'training';
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
    if (!isAvailable(c)) continue; const e = efficiency(c) * (1 + game.moduleEffect('crewEfficiency')) * SHIFT_POLICIES[game.state.station.shift || 'normal'].work; const k = c.skills;
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
    const fp = SHIFT_POLICIES[s.station.shift || 'normal'].fatigue;
    c.fatigue = clamp(c.fatigue + (c.missionId ? 3 : working ? 4 * fp : -12) * days, 0, 100);
    if (!c.missionId && isAvailable(c) && working) gainXp(c, days);
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

// ---- experience, training, hiring, shift policy ----
const XP_SKILL = { operations: ['astrophysics', 'computing'], research: ['astrophysics', 'computing', 'planetary'], maintenance: ['engineering'], medical: ['medical'] };
function gainXp(c, days) {
  const ks = XP_SKILL[c.assignment]; if (!ks) return; c.xp = c.xp || {}; c.experience += days / 365;
  for (const k of ks) { c.xp[k] = (c.xp[k] || 0) + days / ks.length; const need = 20 + 12 * c.skills[k]; if (c.xp[k] >= need && c.skills[k] < 10) { c.xp[k] -= need; c.skills[k] += 1; c._levelUp = k; } }
}
export const TRAIN_COST = 250, TRAIN_DAYS = 10;
export function startTraining(game, crewId, skill) {
  const c = game.state.crew.find(x => x.id === crewId); if (!c) return { ok: false, error: 'No such crew member.' };
  if (!SKILLS.includes(skill)) return { ok: false, error: 'Unknown skill.' }; if (c.missionId) return { ok: false, error: 'On a mission.' };
  if (c.assignment === 'training') return { ok: false, error: 'Already training.' }; if (c.skills[skill] >= 10) return { ok: false, error: 'Already at the maximum.' };
  if (!spend(game, TRAIN_COST, `Training: ${c.name}`)) return { ok: false, error: `Training costs ${TRAIN_COST} RC.` };
  c.prevAssignment = c.assignment; c.assignment = 'training'; c.training = { skill, doneAt: game.state.time.t + TRAIN_DAYS * DAY };
  schedule(game, c.training.doneAt, 'training-done', { id: crewId }); game.log(`${c.name} began ${skill} training (${TRAIN_DAYS} days).`, 'info'); return { ok: true };
}
onSchedule('training-done', (game, { id }) => { const c = game.state.crew.find(x => x.id === id); if (!c || !c.training) return; c.skills[c.training.skill] = Math.min(10, c.skills[c.training.skill] + 1); game.log(`${c.name} completed training: ${c.training.skill} is now ${c.skills[c.training.skill]}.`, 'good'); c.training = null; c.assignment = c.prevAssignment || 'rest'; });
export const crewCapacity = game => 6 + 2 * (game.state.modules.quarters.level - 1);
export const HIRE_COST = 900, HIRE_UPKEEP = 25;
const FIRST = ['Ayesha', 'Jonas', 'Lena', 'Kofi', 'Mei', 'Rafael', 'Nadia', 'Tobias', 'Isla', 'Haruto', 'Zara', 'Mikael', 'Camila', 'Ravi', 'Freya', 'Omar'], LAST = ['Haddad', 'Lindqvist', 'Okoye', 'Tanaka', 'Moreau', 'Castillo', 'Novak', 'Rahman', 'Brandt', 'Kowalski', 'Ito', 'Abara', 'Silva', 'Petrov', 'Singh', 'Larsen'];
export function hire(game, specId) {
  const s = game.state, sp = SPECIALIZATIONS.find(x => x.id === specId); if (!sp) return { ok: false, error: 'Unknown specialisation.' };
  if (s.crew.length >= crewCapacity(game)) return { ok: false, error: `Crew quarters hold ${crewCapacity(game)} people. Upgrade Crew Quarters.` };
  if (!spend(game, HIRE_COST, `Recruit: ${sp.label}`)) return { ok: false, error: `Recruitment costs ${HIRE_COST} RC.` };
  const name = `${game.rand() < 0.5 ? 'Dr. ' : ''}${FIRST[Math.floor(game.rand() * 16)]} ${LAST[Math.floor(game.rand() * 16)]}`; const skills = Object.fromEntries(SKILLS.map(k => [k, 1 + Math.floor(game.rand() * 3)])); skills[sp.skill] = 6 + Math.floor(game.rand() * 2); if (specId === 'pilot') skills.engineering = Math.max(skills.engineering, 5);
  const c = { id: `crew-h${s.uid++}`, name, role: sp.label, spec: specId, specialization: sp.label, experience: 2 + Math.floor(game.rand() * 6), assignment: 'rest', skills, health: 100, morale: 70, fatigue: 5, xp: {}, missionId: null, training: null };
  s.crew.push(c); game.log(`${c.name} (${sp.label}) joined the station.`, 'good'); return { ok: true, crew: c };
}
export function setShift(game, policy) { if (!SHIFT_POLICIES[policy]) return { ok: false, error: 'Unknown policy.' }; game.state.station.shift = policy; return { ok: true }; }
export const crewUpkeep = game => Math.max(0, game.state.crew.length - 5) * HIRE_UPKEEP;
