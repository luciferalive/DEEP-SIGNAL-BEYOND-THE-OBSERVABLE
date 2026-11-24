// V3 spacecraft design and construction. Designs are derived from an unlocked base class plus a propulsion module, payload bays and shielding.
// All numbers are SIMULATED game values. Building needs an active orbital factory and materials.
import { DAY } from './constants.js';
import { spend } from './finance.js';
import { schedule } from './scheduler.js';
import { activeFacilities } from './civilization.js';
import { makeShip, classOf } from './spacecraft.js';

export const PROPULSION = {
  chemical: { label: 'Chemical bipropellant', speed: 1, fuel: 1, range: 1, cost: 0, unlock: null },
  ion: { label: 'Ion drive', speed: 1.5, fuel: 0.55, range: 1.5, cost: 700, unlock: 'class:deep-probe' },
  nuclear: { label: 'Nuclear thermal', speed: 2, fuel: 0.7, range: 2, cost: 1800, unlock: null, tech: 'nuclear-thermal' }
};
export const SHIELDING = { none: { label: 'Standard hull', risk: 0, cost: 0 }, reinforced: { label: 'Reinforced hull', risk: 0.12, cost: 500, tech: 'advanced-materials' }, radiation: { label: 'Radiation shielding', risk: 0.2, cost: 1100, tech: 'radiation-shielding' } };
export const BUILD_DAYS = 30; export const FACTORY_DISCOUNT = 0.75;
const propOk = (game, k) => { const p = PROPULSION[k]; return p && (!p.unlock || game.unlocked(p.unlock)) && (!p.tech || game.state.tech.researched[p.tech]); };
const shieldOk = (game, k) => { const p = SHIELDING[k]; return p && (!p.tech || game.state.tech.researched[p.tech]); };
export const baseClasses = game => game.data.spacecraftClasses.filter(c => !c.hidden && (!c.unlock || game.unlocked(c.unlock)));

export function deriveClass(game, spec) {
  const b = game.data.classById[spec.base]; if (!b || b.hidden) return null;
  const p = PROPULSION[spec.propulsion], sh = SHIELDING[spec.shielding]; const bays = Math.max(0, Math.min(3, Math.round(spec.bays || 0)));
  const cost = Math.round((b.cost * (1 + 0.12 * bays) + p.cost + sh.cost) * FACTORY_DISCOUNT);
  return { ...b, baseClass: b.id, name: spec.name, speedAuDay: b.speedAuDay * p.speed, fuelPerAu: b.fuelPerAu * p.fuel, rangeAu: Math.round(b.rangeAu * p.range), slots: b.slots + bays, cost, riskBase: Math.round(b.riskBase * (1 - sh.risk) * 1000) / 1000, unlock: null, designed: true, spec: { ...spec, bays },
    description: `Custom design on the ${b.name} chassis: ${p.label}, ${bays} extra bay${bays === 1 ? '' : 's'}, ${sh.label.toLowerCase()}.` };
}
export const materialsFor = cls => Math.ceil(cls.cost / 200);
export function validateDesign(game, spec) {
  if (!game.unlocked('design:custom')) return { ok: false, error: 'Research In-space manufacturing first.' };
  if (!(spec.name || '').trim()) return { ok: false, error: 'Give the design a name.' };
  if (!game.data.classById[spec.base] || game.data.classById[spec.base].hidden || (game.data.classById[spec.base].unlock && !game.unlocked(game.data.classById[spec.base].unlock))) return { ok: false, error: 'Choose an unlocked base chassis.' };
  if (!propOk(game, spec.propulsion)) return { ok: false, error: 'That propulsion module is not available yet.' };
  if (!shieldOk(game, spec.shielding)) return { ok: false, error: 'That hull option is not available yet.' };
  return { ok: true, cls: deriveClass(game, { ...spec, name: spec.name.trim() }) };
}
export function saveDesign(game, spec) {
  const v = validateDesign(game, spec); if (!v.ok) return v; const s = game.state;
  if (s.designs.length >= 12) return { ok: false, error: 'You can keep at most 12 designs. Delete one first.' };
  const d = { ...v.cls, id: `design-${s.uid++}` }; s.designs.push(d); return { ok: true, design: d };
}
export function deleteDesign(game, id) {
  const s = game.state; if (s.spacecraft.some(x => x.class === id)) return { ok: false, error: 'Vessels of this design exist, so it cannot be deleted.' };
  s.designs = s.designs.filter(d => d.id !== id); return { ok: true };
}
export function buildShip(game, designId, name) {
  const s = game.state; const d = s.designs.find(x => x.id === designId); if (!d) return { ok: false, error: 'Unknown design.' };
  if (!activeFacilities(game, 'factory').length) return { ok: false, error: 'An operational orbital factory is required.' };
  const mats = materialsFor(d); if (s.stock.materials < mats) return { ok: false, error: `Needs ${mats} units of materials (you have ${Math.floor(s.stock.materials)}).` };
  if (s.resources.credits < d.cost) return { ok: false, error: `Needs ${d.cost} RC.` };
  const nm = (name || '').trim() || `${d.name} ${s.spacecraft.length + 1}`;
  spend(game, d.cost, `Spacecraft: ${nm}`); s.stock.materials -= mats;
  const ship = makeShip(game, designId, nm, { status: 'Under delivery', location: { kind: 'dock', at: 'station' } });
  s.spacecraft.push(ship); schedule(game, s.time.t + BUILD_DAYS * DAY, 'ship-delivery', { id: ship.id });
  game.log(`Construction started: ${nm} (${d.name}). Ready in ${BUILD_DAYS} days.`, 'info'); return { ok: true, ship };
}
