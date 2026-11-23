// Research credits (RC): the ledger, grants and daily running costs.
import { BASE, DAY } from './constants.js';
import { formatDate } from './time-engine.js';
import { storageCap } from './station.js';

export const CATEGORIES = ['Personnel and station', 'Missions', 'Research and publications', 'Observations', 'Spacecraft', 'Infrastructure', 'Grants and funding', 'Repairs and servicing', 'Other'];
export function categoryOf(label) {
  if (/upkeep/i.test(label)) return 'Personnel and station';
  if (/^Mission reward|Supplementary|Monthly research grant|Discovery|Funding/i.test(label)) return /Mission reward/.test(label) ? 'Missions' : 'Grants and funding';
  if (/^Research:|^Publication/i.test(label)) return 'Research and publications';
  if (/^Observation|Event response/i.test(label)) return 'Observations';
  if (/Refuel|Repair .*:/i.test(label)) return 'Spacecraft';
  if (/^Upgrade|module/i.test(label)) return 'Infrastructure';
  if (/^Service|Event cost|Emergency supply/i.test(label)) return 'Repairs and servicing';
  return 'Other';
}
export function addCredits(game, amount, label, kind = amount >= 0 ? 'income' : 'expense') {
  const s = game.state;
  const per = s.finance.period || (s.finance.period = { income: 0, expense: 0, byCat: {} }); const cat = categoryOf(label);
  if (amount >= 0) per.income += amount; else per.expense -= amount; per.byCat[cat] = (per.byCat[cat] || 0) + amount;
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
export const dailyUpkeep = game => BASE.upkeepPerDay + Math.max(0, game.state.crew.length - 5) * 25 + game.state.spacecraft.filter(x => !['Lost', 'Expended'].includes(x.status)).length * 8 - 8;

// Called once per game day.
export function dailyFinance(game) {
  const s = game.state; const day = Math.floor(s.time.t / DAY);
  addCredits(game, -dailyUpkeep(game), 'Station upkeep and crew costs', 'expense');
  if (day - s.finance.lastGrantDay >= BASE.grantEveryDays) {
    s.finance.lastGrantDay = day;
    const grant = Math.round(BASE.monthlyGrant * (1 + 0.04 * s.resources.reputation));
    addCredits(game, grant, 'Monthly research grant from Earth', 'income');
    game.log(`Monthly research grant received: ${grant.toLocaleString('en-US')} RC.`, 'good');
    closeMonth(game);
  }
  if (day >= s.finance.nextResupplyDay) {
    s.finance.nextResupplyDay = day + BASE.resupplyEveryDays;
    deliverSupplies(game, { oxygen: 150, water: 600, food: 450 }, 'Scheduled resupply convoy');
  }
}
export function deliverSupplies(game, goods, label) {
  const s = game.state; const parts = [];
  const caps = { oxygen: storageCap(game, 'oxygen'), water: storageCap(game, 'water'), food: storageCap(game, 'food') };
  for (const [k, v] of Object.entries(goods)) { const before = s.resources[k]; s.resources[k] = Math.min(caps[k], before + v); parts.push(`${Math.round(s.resources[k] - before)} ${k === 'water' ? 'L' : 'kg'} ${k}`); }
  game.log(`${label} arrived: ${parts.join(', ')}.`, 'good');
  game.addMessage({ from: 'Earth Logistics Office', subject: label, body: `Supplies delivered to Meridian Station: ${parts.join(', ')}. Storage limits may have trimmed the delivery.`, type: 'info' });
}
export const dateLabel = t => formatDate(t);

// Monthly report: totals since the previous report, taken from running counters (the ledger is capped, so it is not used).
export function closeMonth(game) {
  const s = game.state; const per = s.finance.period || { income: 0, expense: 0, byCat: {} };
  const rep = { t: s.time.t, income: Math.round(per.income), expense: Math.round(per.expense), net: Math.round(per.income - per.expense), byCat: { ...per.byCat }, balance: Math.round(s.resources.credits) };
  s.finance.reports.unshift(rep); if (s.finance.reports.length > 60) s.finance.reports.length = 60;
  s.finance.period = { income: 0, expense: 0, byCat: {} };
  game.addMessage({ from: 'Earth Funding Office', subject: 'Monthly financial report', body: `Income ${rep.income} RC, spending ${rep.expense} RC, net ${rep.net >= 0 ? '+' : ''}${rep.net} RC. Balance ${rep.balance} RC.`, type: 'info' });
  return rep;
}
// Warnings are derived from the real balance; nothing is invented.
export function financeWarnings(game) {
  const s = game.state; const out = []; const bal = s.resources.credits; const daily = dailyUpkeep(game);
  const runway = bal / daily; const reserve = s.finance.reserve ?? 600;
  if (bal < 0) out.push({ level: 'bad', text: 'The balance is negative. Earth will not fund further spending until it is positive.' });
  else if (runway < 10) out.push({ level: 'bad', text: `Only ${runway.toFixed(1)} days of upkeep remain in the balance.` });
  else if (runway < 30) out.push({ level: 'warn', text: `Balance covers ${Math.round(runway)} days of upkeep.` });
  if (bal < reserve && bal >= 0) out.push({ level: 'warn', text: `Balance is below your emergency reserve of ${reserve} RC.` });
  const last = s.finance.reports[0]; if (last && last.net < 0) out.push({ level: 'warn', text: `Last month closed with a net loss of ${-last.net} RC.` });
  return out;
}
export function setReserve(game, v) { if (!(v >= 0 && v <= 5000)) return { ok: false, error: 'Reserve must be between 0 and 5000 RC.' }; game.state.finance.reserve = Math.round(v); return { ok: true }; }
