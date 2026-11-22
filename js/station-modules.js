// Station infrastructure: ten modules with levels, condition, power draw and upgrade projects. Effects feed real systems.
import { DAY } from './constants.js';
import { workRates } from './crew-management.js';
import { spend } from './finance.js';
import { record } from './chronicle.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const initialModules = data => Object.fromEntries(data.modules.modules.map(m => [m.id, { level: 1, condition: 100, upgrade: null }]));
export const defOf = (game, id) => game.data.modules.modules.find(m => m.id === id);
export const efficiency = m => clamp(m.condition / 100, 0.4, 1);
export const upgradeCost = (game, id) => { const m = game.state.modules[id], d = defOf(game, id); return Math.round(d.baseCost * Math.pow(game.data.modules.costGrowth, m.level - 1)); };
export const upgradeDays = (game, id) => 4 + 3 * game.state.modules[id].level;
export const powerKw = (game, id) => { const m = game.state.modules[id], d = defOf(game, id); return d.kwPerLevel * (m.level - 1); };
export const totalExtraKw = game => game.data.modules.modules.reduce((a, d) => a + powerKw(game, d.id), 0);

// Sum of one effect key across all modules, scaled by each module's condition.
export function moduleEffect(game, key) {
  let sum = 0;
  for (const d of game.data.modules.modules) { const per = d.perLevel[key]; if (!per) continue; const m = game.state.modules[d.id]; sum += per * (m.level - 1) * efficiency(m); }
  return sum;
}
export function capacityText(game, id) {
  const d = defOf(game, id), m = game.state.modules[id];
  return Object.entries(d.perLevel).map(([k, v]) => `${LABELS[k] || k}: ${fmt(k, v * (m.level - 1) * efficiency(m))}`).join(' · ') || 'No bonus at level 1';
}
const LABELS = { crewEfficiency: 'crew efficiency', accuracy: 'instrument accuracy', analysisSpeed: 'analysis speed', maintenanceMult: 'repair speed', supplyDelayDays: 'convoy transit', healthRecovery: 'health recovery', moraleBonus: 'morale', powerGenMult: 'solar output', batteryCap: 'battery', storageMult: 'storage', rewardMult: 'mission rewards' };
const fmt = (k, v) => k === 'supplyDelayDays' ? `−${v.toFixed(1)} d` : k === 'batteryCap' ? `+${Math.round(v)} kWh` : k === 'moraleBonus' ? `+${v.toFixed(1)}` : k === 'healthRecovery' ? `+${v.toFixed(1)}/d` : `+${Math.round(v * 100)}%`;

export function canUpgrade(game, id) {
  const s = game.state, m = s.modules[id], d = defOf(game, id);
  if (!m) return { ok: false, error: 'Unknown module.' };
  if (m.upgrade) return { ok: false, error: 'An upgrade is already in progress.' };
  if (m.level >= game.data.modules.maxLevel) return { ok: false, error: 'Already at maximum level.' };
  if (workRates(game).maintenance <= 0) return { ok: false, error: 'Assign a healthy crew member to Maintenance to carry out the work.' };
  const cost = upgradeCost(game, id); if (s.resources.credits < cost) return { ok: false, error: `Needs ${cost} RC.` };
  return { ok: true, cost, days: upgradeDays(game, id), name: d.name };
}
export function startUpgrade(game, id) {
  const c = canUpgrade(game, id); if (!c.ok) return c; const m = game.state.modules[id];
  spend(game, c.cost, `Upgrade: ${c.name} to level ${m.level + 1}`);
  m.upgrade = { toLevel: m.level + 1, daysLeft: c.days, total: c.days };
  game.log(`Upgrade started: ${c.name} to level ${m.level + 1} (${c.days} days).`, 'info');
  return { ok: true };
}
export function modulesTick(game, dt) {
  const s = game.state; const days = dt / DAY; const work = workRates(game).maintenance;
  for (const [id, m] of Object.entries(s.modules)) {
    m.condition = clamp(m.condition - 0.05 * days, 0, 100);
    if (m.upgrade && work > 0) {
      m.upgrade.daysLeft -= days * clamp(work / 6, 0.3, 2);
      if (m.upgrade.daysLeft <= 0) { m.level = m.upgrade.toLevel; m.upgrade = null; const d = defOf(game, id); game.log(`${d.name} is now level ${m.level}.`, 'good'); record(game, { kind: 'infrastructure', title: `${d.name} upgraded to level ${m.level}`, major: m.level >= 3, ref: id }); }
    }
  }
}
export function serviceModule(game, id) {
  const m = game.state.modules[id]; if (!m) return { ok: false, error: 'Unknown module.' };
  if (m.condition >= 99) return { ok: false, error: 'Already in excellent condition.' };
  if (workRates(game).maintenance <= 0) return { ok: false, error: 'Assign a healthy crew member to Maintenance first.' };
  if (!spend(game, 60, `Service module: ${defOf(game, id).name}`)) return { ok: false, error: 'Servicing costs 60 RC.' };
  m.condition = Math.min(100, m.condition + 25); return { ok: true };
}
