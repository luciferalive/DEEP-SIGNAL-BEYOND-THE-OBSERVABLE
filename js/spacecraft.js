// Spacecraft: a fleet of eight classes with equipment, fuel, condition and locations. Missions (expeditions.js) fly them.
import { DAY } from './constants.js';
import { spend } from './finance.js';
import { workRates } from './crew-management.js';
import { schedule, onSchedule } from './scheduler.js';
import { record } from './chronicle.js';

export const FUEL_COST_PER_KG = 0.6;
export const REPAIR_COST = 60;
export const SHIP_SYSTEMS = { propulsion: 100, power: 100, navigation: 100, communications: 100, lifeSupport: 100, radiation: 100, computing: 100 };
export const DELIVERY_DAYS = 20;

export const isUnlocked = (game, key) => !key || game.unlocked(key);
export const classDef = (game, id) => game.state.designs?.find(d => d.id === id) || game.data.classById[id];
export const classOf = (game, ship) => classDef(game, ship.class);
export const isReusable = (game, ship) => { const c = classOf(game, ship); return c.recoverable || c.role === 'remote'; };
export const isIdle = ship => !ship.missionId && ship.location.kind === 'dock' && !['Lost', 'Expended', 'Stranded', 'Under delivery'].includes(ship.status);
export const shipCondition = ship => Object.values(ship.systems).reduce((a, b) => a + b, 0) / Object.keys(ship.systems).length;
export const speedAuDay = (game, ship) => classOf(game, ship).speedAuDay * (1 + game.techEffect('shipSpeedMult'));
export const fuelEfficiency = game => 1 + game.techEffect('fuelEfficiency');

export function makeShip(game, classId, name, extra = {}) {
  const s = game.state, c = classDef(game, classId);
  return { id: `ship-${s.uid++}`, name, class: classId, type: c.name, status: 'Docked', propulsion: c.speedAuDay >= 0.01 ? 'Ion / advanced' : 'Chemical bipropellant', fuel: c.fuelCap, fuelCap: c.fuelCap, energy: 100,
    systems: { ...SHIP_SYSTEMS }, equipment: [], crewIds: [], cargo: { used: 0, cap: c.cargo }, location: { kind: 'dock', at: 'station' }, missionId: null, commsDownUntil: 0, maintenance: { hours: 0, dueAt: s.time.t + 60 * DAY }, hullCondition: 100, notes: c.description, ...extra };
}
// Procurement: order a vessel from Earth; it arrives after a delivery delay. (Construction in the shipyard arrives in V3.)
export function orderShip(game, classId, name) {
  const c = game.data.classById[classId]; const s = game.state;
  if (!c) return { ok: false, error: 'Unknown vessel class.' };
  if (!isUnlocked(game, c.unlock)) return { ok: false, error: 'Research is needed before this class can be ordered.' };
  const nm = (name || '').trim() || `${c.name} ${s.spacecraft.length + 1}`;
  if (!spend(game, c.cost, `Spacecraft: ${nm}`)) return { ok: false, error: `This vessel costs ${c.cost} RC.` };
  const ship = makeShip(game, classId, nm, { status: 'Under delivery', location: { kind: 'dock', at: 'earth' } });
  s.spacecraft.push(ship); schedule(game, s.time.t + DELIVERY_DAYS * DAY, 'ship-delivery', { id: ship.id });
  game.log(`Ordered ${nm} (${c.name}). Delivery in ${DELIVERY_DAYS} days.`, 'info');
  return { ok: true, ship };
}
onSchedule('ship-delivery', (game, { id }) => {
  const ship = game.state.spacecraft.find(x => x.id === id); if (!ship) return;
  ship.status = 'Docked'; ship.location = { kind: 'dock', at: 'station' };
  game.log(`${ship.name} has arrived at the station.`, 'good');
  game.addMessage({ from: 'Earth Logistics Office', subject: `Delivered: ${ship.name}`, body: `${ship.name} (${ship.type}) is docked. Install equipment before planning a mission.`, type: 'info' });
  record(game, { kind: 'infrastructure', title: `Spacecraft commissioned: ${ship.name}`, text: ship.type, major: game.state.spacecraft.filter(s => s.status !== 'Under delivery').length === 2 });
});
export function installEquipment(game, shipId, equipId) {
  const ship = game.state.spacecraft.find(x => x.id === shipId), e = game.data.equipById[equipId], c = ship && classOf(game, ship);
  if (!ship || !e) return { ok: false, error: 'Unknown vessel or equipment.' };
  if (!isIdle(ship)) return { ok: false, error: 'The vessel must be docked and idle.' };
  if (ship.equipment.includes(equipId)) return { ok: false, error: 'Already installed.' };
  if (ship.equipment.length >= c.slots) return { ok: false, error: `All ${c.slots} equipment slots are in use.` };
  if (!isUnlocked(game, e.unlock)) return { ok: false, error: 'Research is needed before this equipment can be built.' };
  if (workRates(game).maintenance <= 0) return { ok: false, error: 'Assign a healthy crew member to Maintenance to fit equipment.' };
  if (!spend(game, e.cost, `Equipment: ${e.name} on ${ship.name}`)) return { ok: false, error: `${e.name} costs ${e.cost} RC.` };
  ship.equipment.push(equipId); game.log(`${e.name} installed on ${ship.name}.`, 'info'); return { ok: true };
}
export function removeEquipment(game, shipId, equipId) {
  const ship = game.state.spacecraft.find(x => x.id === shipId); if (!ship || !isIdle(ship)) return { ok: false, error: 'The vessel must be docked and idle.' };
  ship.equipment = ship.equipment.filter(x => x !== equipId); return { ok: true };
}
export function refuel(game, shipId, kg) {
  const ship = game.state.spacecraft.find(x => x.id === shipId); if (!ship) return { ok: false, error: 'Unknown vessel.' };
  if (ship.location.kind !== 'dock') return { ok: false, error: 'Only docked vessels can be refuelled.' };
  const room = ship.fuelCap - ship.fuel; const amount = Math.min(kg, room);
  if (amount <= 0) return { ok: false, error: 'The tanks are already full.' };
  const free = Math.min(amount, (game.state.stock?.volatiles || 0) * 4); const cost = Math.round((amount - free) * FUEL_COST_PER_KG);
  if (free > 0) game.state.stock.volatiles -= free / 4;
  if (!spend(game, cost, `Refuel ${ship.name}: ${Math.round(amount)} kg`)) return { ok: false, error: `Refuelling costs ${cost} RC.` };
  ship.fuel += amount; game.log(`${ship.name} refuelled with ${Math.round(amount)} kg (${cost} RC).`, 'info');
  return { ok: true };
}
export function repairSystem(game, shipId, systemId) {
  const ship = game.state.spacecraft.find(x => x.id === shipId); if (!ship || ship.systems[systemId] == null) return { ok: false, error: 'Unknown vessel system.' };
  if (ship.location.kind !== 'dock') return { ok: false, error: 'Only docked vessels can be repaired.' };
  if (ship.systems[systemId] >= 100) return { ok: false, error: 'That system is already at full condition.' };
  if (workRates(game).maintenance <= 0) return { ok: false, error: 'Assign a healthy crew member to Maintenance first.' };
  if (!spend(game, REPAIR_COST, `Repair ${ship.name}: ${systemId}`)) return { ok: false, error: `A repair costs ${REPAIR_COST} RC.` };
  ship.systems[systemId] = Math.min(100, ship.systems[systemId] + 25); game.log(`${ship.name}: ${systemId} repaired.`, 'info');
  return { ok: true };
}
export const MAINTENANCE_COST = 150;
export function serviceShip(game, shipId) {
  const ship = game.state.spacecraft.find(x => x.id === shipId); if (!ship || !isIdle(ship)) return { ok: false, error: 'The vessel must be docked and idle.' };
  if (workRates(game).maintenance <= 0) return { ok: false, error: 'Assign a healthy crew member to Maintenance first.' };
  if (!spend(game, MAINTENANCE_COST, `Overhaul ${ship.name}`)) return { ok: false, error: `An overhaul costs ${MAINTENANCE_COST} RC.` };
  for (const k of Object.keys(ship.systems)) ship.systems[k] = Math.min(100, ship.systems[k] + 40);
  ship.hullCondition = Math.min(100, ship.hullCondition + 30); ship.maintenance.dueAt = game.state.time.t + 60 * DAY; return { ok: true };
}
export function shipTick(game, dt) {
  const days = dt / DAY;
  for (const ship of game.state.spacecraft) {
    if (['Lost', 'Expended', 'Under delivery'].includes(ship.status)) continue;
    const away = ship.location.kind !== 'dock'; const wear = away ? 0.06 : 0.015;
    for (const k of Object.keys(ship.systems)) ship.systems[k] = Math.max(0, ship.systems[k] - wear * days);
    ship.maintenance.overdue = game.state.time.t > ship.maintenance.dueAt;
    if (ship.maintenance.overdue) for (const k of Object.keys(ship.systems)) ship.systems[k] = Math.max(0, ship.systems[k] - 0.03 * days);
  }
}
