// Earth relationship: contracts (incl. emergency missions) and budget allocation with real consequences.
import { DAY } from './constants.js';
import { addCredits } from './finance.js';
import { record } from './chronicle.js';

export const ALLOC_KEYS = ['science', 'operations', 'expeditions', 'reserve'];
export const ALLOC_DEFAULT = { science: 40, operations: 30, expeditions: 20, reserve: 10 };
export const allocation = game => game.state.finance.allocation || ALLOC_DEFAULT;
// Effects: science share raises research points from analysis; operations share lowers daily upkeep; expeditions share lowers mission cost;
// the reserve share of each monthly grant is set aside as protected savings.
export const rpMult = game => (1 + (allocation(game).science - 25) / 250) * (game.state.flags.priorityUntil > game.state.time.t ? 0.8 : 1);
export const upkeepMult = game => 1 - (allocation(game).operations - 25) / 500;
export const expeditionCostMult = game => 1 - (allocation(game).expeditions - 25) / 400;
export function setAllocation(game, a) {
  const vals = ALLOC_KEYS.map(k => Math.round(+a[k])); if (vals.some(v => !(v >= 0 && v <= 100))) return { ok: false, error: 'Each share must be between 0 and 100.' };
  const sum = vals.reduce((x, y) => x + y, 0); if (sum !== 100) return { ok: false, error: `Shares must total 100% (now ${sum}%).` };
  game.state.finance.allocation = Object.fromEntries(ALLOC_KEYS.map((k, i) => [k, vals[i]])); return { ok: true };
}
export function splitGrant(game, grant) {
  const s = game.state; const keep = Math.round(grant * allocation(game).reserve / 100); s.finance.savings = (s.finance.savings || 0) + keep; return grant - keep;
}
export function releaseSavings(game) {
  const s = game.state; const v = s.finance.savings || 0; if (v <= 0) return { ok: false, error: 'No savings to release.' };
  s.finance.savings = 0; addCredits(game, v, 'Savings released to the operating balance', 'income'); return { ok: true };
}
// Savings automatically cover a negative balance.
export function coverDeficit(game) {
  const s = game.state; if (s.resources.credits < 0 && (s.finance.savings || 0) > 0) { const v = Math.min(s.finance.savings, -s.resources.credits); s.finance.savings -= v; addCredits(game, v, 'Savings released to cover a deficit', 'income'); game.log(`Reserve savings covered a deficit of ${Math.round(v)} RC.`, 'warn'); }
}

const TEMPLATES = [
  { id: 'survey-optical', kind: 'datasets', dataKind: 'optical', n: 2, days: 40, title: 'Optical survey', desc: 'Analyse 2 new optical datasets.', reward: { credits: 700, rp: 20, rep: 1 } },
  { id: 'survey-radio', kind: 'datasets', dataKind: 'radio', n: 2, days: 40, title: 'Radio survey', desc: 'Analyse 2 new radio datasets.', reward: { credits: 700, rp: 20, rep: 1 } },
  { id: 'survey-spectral', kind: 'datasets', dataKind: 'spectral', n: 2, days: 45, title: 'Spectroscopic campaign', desc: 'Analyse 2 new spectral datasets.', reward: { credits: 900, rp: 28, rep: 1 } },
  { id: 'expedition', kind: 'expedition', n: 1, days: 60, title: 'Field expedition', desc: 'Complete one expedition of any kind.', reward: { credits: 1200, rp: 25, rep: 2 } },
  { id: 'discovery', kind: 'discoveries', n: 3, days: 50, title: 'Discovery quota', desc: 'Add 3 new analysed results to the archive.', reward: { credits: 1000, rp: 25, rep: 2 } }
];
const EMERGENCY = { id: 'emergency', kind: 'emergency', n: 1, days: 25, title: 'Emergency mission', desc: 'Earth requests an urgent in-situ mission (Expeditions, type: Emergency mission).', reward: { credits: 2600, rp: 40, rep: 4 }, penalty: { rep: 3 } };

export function offerContract(game, tpl) { return offer(game, tpl); }
function offer(game, tpl) {
  const s = game.state; const c = { uid: `ct-${s.uid++}`, ...JSON.parse(JSON.stringify(tpl)), status: 'offered', offeredAt: s.time.t, deadline: null, progress: 0 };
  s.earth.contracts.unshift(c);
  game.addMessage({ from: 'Earth Mission Control', subject: `${tpl.kind === 'emergency' ? 'URGENT: ' : 'Contract offer: '}${tpl.title}`, body: `${tpl.desc} Deadline ${tpl.days} days after acceptance. Reward ${tpl.reward.credits} RC, ${tpl.reward.rp} RP, +${tpl.reward.rep} reputation.${tpl.penalty ? ` Failure costs ${tpl.penalty.rep} reputation.` : ''}`, type: 'info' });
  game.log(`${tpl.kind === 'emergency' ? 'Emergency request' : 'Contract offered'}: ${tpl.title}.`, tpl.kind === 'emergency' ? 'warn' : 'info');
}
export function acceptContract(game, uid) {
  const c = game.state.earth.contracts.find(x => x.uid === uid); if (!c || c.status !== 'offered') return { ok: false, error: 'Not available.' };
  if (game.state.earth.contracts.filter(x => x.status === 'active').length >= 3) return { ok: false, error: 'You can hold at most 3 active contracts.' };
  c.status = 'active'; c.acceptedAt = game.state.time.t; c.deadline = c.acceptedAt + c.days * DAY; c.base = { discoveries: game.state.discoveries.length }; return { ok: true };
}
export function declineContract(game, uid) {
  const c = game.state.earth.contracts.find(x => x.uid === uid); if (!c || c.status !== 'offered') return { ok: false, error: 'Not available.' };
  c.status = 'declined'; if (c.kind === 'emergency') game.state.resources.reputation = Math.max(0, game.state.resources.reputation - 1); return { ok: true };
}
export const emergencyActive = game => game.state.earth.contracts.some(c => c.kind === 'emergency' && c.status === 'active');
function finish(game, c, ok) {
  const s = game.state; c.status = ok ? 'done' : 'failed'; c.finishedAt = s.time.t;
  if (ok) { addCredits(game, c.reward.credits, `Funding: contract ${c.title}`, 'income'); s.resources.researchPoints += c.reward.rp; s.resources.reputation += c.reward.rep; game.log(`Contract complete: ${c.title} (+${c.reward.credits} RC).`, 'good'); }
  else { s.resources.reputation = Math.max(0, s.resources.reputation - (c.penalty?.rep || 1)); game.log(`Contract failed: ${c.title}. Reputation reduced.`, 'bad'); }
  record(game, { kind: 'mission', title: `Contract ${ok ? 'completed' : 'failed'}: ${c.title}`, text: ok ? 'Delivered to Earth.' : 'Deadline passed.', ref: c.uid });
}
export function contractProgress(game, c) {
  const s = game.state; if (c.status !== 'active') return c.progress;
  if (c.kind === 'datasets') return s.datasets.filter(d => d.status === 'analysed' && d.analysedAt >= c.acceptedAt && (d.kind === c.dataKind)).length;
  if (c.kind === 'discoveries') return Math.max(0, s.discoveries.length - (c.base?.discoveries ?? 0));
  return c.progress;
}
export function contractsOnExpedition(game, ex) {
  for (const c of game.state.earth.contracts) if (c.status === 'active' && (c.kind === 'expedition' || (c.kind === 'emergency' && ex.type === 'emergency')) && ex.finishedAfter !== false) c.progress += 1;
}
export function earthTick(game) {
  const s = game.state; const day = Math.floor(s.time.t / DAY);
  for (const c of s.earth.contracts) if (c.status === 'active') { c.progress = contractProgress(game, c); if (c.progress >= c.n) finish(game, c, true); else if (s.time.t > c.deadline) finish(game, c, false); }
  for (const c of s.earth.contracts) if (c.status === 'offered' && s.time.t - c.offeredAt > 15 * DAY) c.status = 'expired';
  if (s.earth.contracts.length > 40) s.earth.contracts.length = 40;
  coverDeficit(game);
  if (day >= (s.flags.nextContract ?? 12)) { s.flags.nextContract = day + 18 + Math.floor(game.rand() * 10); const tpl = TEMPLATES[Math.floor(game.rand() * TEMPLATES.length)]; offer(game, tpl); }
  if (day >= (s.flags.nextEmergency ?? 60)) { s.flags.nextEmergency = day + 70 + Math.floor(game.rand() * 40); if (s.resources.reputation >= 3 && !emergencyActive(game)) offer(game, EMERGENCY); }
}
