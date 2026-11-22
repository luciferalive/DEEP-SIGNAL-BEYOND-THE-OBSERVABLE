// Research credits (RC): the ledger, grants and daily running costs.
import { BASE, DAY } from './constants.js';
import { formatDate } from './time-engine.js';

export function addCredits(game, amount, label, kind = amount >= 0 ? 'income' : 'expense') {
  const s = game.state;
  s.resources.credits = Math.round((s.resources.credits + amount) * 100) / 100;
  s.finance.ledger.unshift({ t: s.time.t, amount: Math.round(amount * 100) / 100, label, kind, balance: s.resources.credits });
  if (s.finance.ledger.length > 150) s.finance.ledger.length = 150;
}
export const canAfford = (game, cost) => game.state.resources.credits >= cost;
export function spend(game, cost, label) {
  if (!canAfford(game, cost)) return false;
  addCredits(game, -cost, label, 'expense');
  return true;
}
export const dailyUpkeep = game => BASE.upkeepPerDay;

// Called once per game day.
export function dailyFinance(game) {
  const s = game.state; const day = Math.floor(s.time.t / DAY);
  addCredits(game, -dailyUpkeep(game), 'Station upkeep and crew costs', 'expense');
  if (day - s.finance.lastGrantDay >= BASE.grantEveryDays) {
    s.finance.lastGrantDay = day;
    const grant = Math.round(BASE.monthlyGrant * (1 + 0.04 * s.resources.reputation));
    addCredits(game, grant, 'Monthly research grant from Earth', 'income');
    game.log(`Monthly research grant received: ${grant.toLocaleString('en-US')} RC.`, 'good');
  }
  if (day >= s.finance.nextResupplyDay) {
    s.finance.nextResupplyDay = day + BASE.resupplyEveryDays;
    deliverSupplies(game, { oxygen: 150, water: 600, food: 450 }, 'Scheduled resupply convoy');
  }
}
export function deliverSupplies(game, goods, label) {
  const s = game.state; const parts = [];
  const caps = { oxygen: BASE.oxygenCap, water: BASE.waterCap, food: BASE.foodCap };
  for (const [k, v] of Object.entries(goods)) { const before = s.resources[k]; s.resources[k] = Math.min(caps[k], before + v); parts.push(`${Math.round(s.resources[k] - before)} ${k === 'water' ? 'L' : 'kg'} ${k}`); }
  game.log(`${label} arrived: ${parts.join(', ')}.`, 'good');
  game.addMessage({ from: 'Earth Logistics Office', subject: label, body: `Supplies delivered to Meridian Station: ${parts.join(', ')}. Storage limits may have trimmed the delivery.`, type: 'info' });
}
export const dateLabel = t => formatDate(t);
