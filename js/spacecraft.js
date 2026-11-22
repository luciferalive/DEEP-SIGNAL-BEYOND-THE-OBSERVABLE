// Spacecraft: v0.1 provides one vessel with refuelling and repair. Upgrades arrive in 0.5.
import { spend } from './finance.js';
import { workRates } from './crew-management.js';

export const FUEL_COST_PER_KG = 0.6;
export const REPAIR_COST = 60;

export function refuel(game, shipId, kg) {
  const ship = game.state.spacecraft.find(x => x.id === shipId); if (!ship) return { ok: false, error: 'Unknown vessel.' };
  const room = ship.fuelCap - ship.fuel; const amount = Math.min(kg, room);
  if (amount <= 0) return { ok: false, error: 'The tanks are already full.' };
  const cost = Math.round(amount * FUEL_COST_PER_KG);
  if (!spend(game, cost, `Refuel ${ship.name}: ${Math.round(amount)} kg`)) return { ok: false, error: `Refuelling costs ${cost} RC.` };
  ship.fuel += amount; game.log(`${ship.name} refuelled with ${Math.round(amount)} kg (${cost} RC).`, 'info');
  return { ok: true };
}
export function repairSystem(game, shipId, systemId) {
  const ship = game.state.spacecraft.find(x => x.id === shipId); if (!ship || ship.systems[systemId] == null) return { ok: false, error: 'Unknown vessel system.' };
  if (ship.systems[systemId] >= 100) return { ok: false, error: 'That system is already at full condition.' };
  if (workRates(game).maintenance <= 0) return { ok: false, error: 'Assign a healthy crew member to Maintenance first.' };
  if (!spend(game, REPAIR_COST, `Repair ${ship.name}: ${systemId}`)) return { ok: false, error: `A repair costs ${REPAIR_COST} RC.` };
  ship.systems[systemId] = Math.min(100, ship.systems[systemId] + 25); game.log(`${ship.name}: ${systemId} repaired.`, 'info');
  return { ok: true };
}
export function shipTick(game, dt) {
  const days = dt / 86400;
  for (const ship of game.state.spacecraft) for (const k of Object.keys(ship.systems)) ship.systems[k] = Math.max(0, ship.systems[k] - 0.02 * days);
}
export const shipCondition = ship => Object.values(ship.systems).reduce((a, b) => a + b, 0) / Object.keys(ship.systems).length;
