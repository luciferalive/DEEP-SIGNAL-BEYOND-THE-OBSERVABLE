// Station systems: power budget, life support, condition decay and maintenance.
import { BASE, DAY, HOUR } from './constants.js';
import { workRates } from './crew-management.js';
import { totalExtraKw } from './station-modules.js';
export const storageCap = (game, key) => BASE[key + 'Cap'] * (1 + game.moduleEffect('storageMult'));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const batteryCap = game => BASE.batteryKwh + game.techEffect('batteryCap') + game.moduleEffect('batteryCap');

export function powerBudget(game) {
  const s = game.state; const sys = s.station.systems;
  const stormFactor = s.events.solarFactor ?? 1;
  const gen = BASE.solarKw * (sys.power.condition / 100) * (1 + game.techEffect('powerGenMult') + game.moduleEffect('powerGenMult')) * stormFactor;
  const loads = { ...BASE.loadsKw };
  loads.lab = s.analyses.some(a => a.status === 'active') || s.tech.active ? BASE.loadsKw.lab : 1;
  let instruments = 0;
  for (const inst of s.instruments) instruments += game.isInstrumentBusy(inst) ? inst.powerKw : inst.standbyKw;
  const ship = 1.0;
  loads.modules = totalExtraKw(game);
  const load = loads.lifeSupport + loads.thermal + loads.comms + loads.computing + loads.lab + instruments + ship + loads.modules;
  return { gen, load, instruments, loads, net: gen - load };
}

export function lifeSupportEfficiency(game) {
  const s = game.state;
  return clamp(s.station.systems.lifeSupport.condition / 100, 0.1, 1) * (s.station.brownout ? 0.4 : 1);
}

export function stationTick(game, dt) {
  const s = game.state; const days = dt / DAY; const res = s.resources; const n = Math.max(1, s.crew.filter(c => !c.missionId).length);
  const p = powerBudget(game); s.station.power = { gen: p.gen, load: p.load };
  // Battery
  const cap = batteryCap(game);
  s.station.battery = clamp(s.station.battery + p.net * (dt / HOUR), 0, cap);
  s.station.brownout = s.station.battery <= 0 && p.net < 0;
  // Life support
  const eff = lifeSupportEfficiency(game);
  const leak = 0.5 * (1 - s.station.systems.lifeSupport.condition / 100) + 0.05;
  res.oxygen = clamp(res.oxygen - (n * BASE.oxygenPerCrewDay * (1 - BASE.oxygenRecycle * eff) + leak) * days, 0, storageCap(game, 'oxygen'));
  res.water = clamp(res.water - n * BASE.waterPerCrewDay * (1 - (BASE.waterRecycle + game.techEffect('waterRecycle')) * eff) * days, 0, storageCap(game, 'water'));
  res.food = clamp(res.food - n * BASE.foodPerCrewDay * days + game.techEffect('foodProduction') * (s.station.systems.lifeSupport.condition / 100) * days, 0, storageCap(game, 'food'));
  // Decay and maintenance
  const rates = workRates(game);
  for (const [id, sys] of Object.entries(s.station.systems)) {
    sys.condition = clamp(sys.condition - 0.08 * days * (id === 'power' ? 1.3 : 1), 0, 100);
  }
  for (const inst of s.instruments) if (game.isInstrumentBusy(inst)) inst.condition = clamp(inst.condition - 0.03 * (dt / HOUR), 0, 100); else inst.condition = clamp(inst.condition - 0.01 * days, 0, 100);
  // Maintenance crew repairs the most damaged item first
  const work = rates.maintenance * 0.12 * days * (1 + game.moduleEffect('maintenanceMult')); // condition points per day per skill-point-ish
  if (work > 0) {
    const items = [...Object.values(s.station.systems), ...s.instruments, ...Object.values(s.modules)].filter(x => x.condition < 100).sort((a, b) => a.condition - b.condition);
    if (items[0]) items[0].condition = clamp(items[0].condition + work * 4, 0, 100);
  }
  s.station.condition = Object.values(s.station.systems).reduce((a, x) => a + x.condition, 0) / Object.keys(s.station.systems).length;
}

export function daysRemaining(game) {
  const s = game.state; const n = Math.max(1, s.crew.length); const res = s.resources;
  const eff = lifeSupportEfficiency(game);
  const oxy = BASE.oxygenPerCrewDay * n * (1 - BASE.oxygenRecycle * eff) + 0.05;
  const wat = n * BASE.waterPerCrewDay * (1 - (BASE.waterRecycle + game.techEffect('waterRecycle')) * eff);
  const food = Math.max(0.0001, n * BASE.foodPerCrewDay - game.techEffect('foodProduction'));
  const p = powerBudget(game);
  return { oxygen: res.oxygen / oxy, water: res.water / Math.max(0.01, wat), food: res.food / food, power: p.net < 0 ? s.station.battery / (-p.net) / 24 : Infinity };
}

export const SYSTEM_SERVICE_COST = 100;
export function serviceSystem(game, systemId) {
  const sys = game.state.station.systems[systemId]; if (!sys) return { ok: false, error: 'Unknown system.' };
  if (sys.condition >= 99) return { ok: false, error: 'That system is already in excellent condition.' };
  if (workRates(game).maintenance <= 0) return { ok: false, error: 'Assign a healthy crew member to Maintenance first.' };
  if (game.state.resources.credits < SYSTEM_SERVICE_COST) return { ok: false, error: `Servicing costs ${SYSTEM_SERVICE_COST} RC.` };
  game.state.resources.credits -= SYSTEM_SERVICE_COST;
  game.state.finance.ledger.unshift({ t: game.state.time.t, amount: -SYSTEM_SERVICE_COST, label: `Service: ${systemId}`, kind: 'expense', balance: game.state.resources.credits });
  sys.condition = Math.min(100, sys.condition + 20); game.log(`${systemId} serviced (condition ${Math.round(sys.condition)}%).`, 'info');
  return { ok: true };
}
