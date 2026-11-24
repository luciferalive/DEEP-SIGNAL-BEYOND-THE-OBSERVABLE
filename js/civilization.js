// V3: planetary exploration stages, facilities, resource network, policies and the civilization index.
// REAL: the bodies and their qualitative resources. SIMULATED: all costs, outputs, timings and the index. Nothing here is a real engineering plan.
import { DAY } from './constants.js';
import { addCredits, spend } from './finance.js';
import { schedule, onSchedule } from './scheduler.js';
import { record } from './chronicle.js';
import { getObject } from './astronomy-database.js';
import { classOf } from './spacecraft.js';

export const STAGE_NAMES = ['UNEXPLORED', 'ORBITAL SURVEY', 'SURFACE SURVEY', 'RESOURCE ASSESSMENT', 'SITE PREPARED'];
const SURVEY_TYPES = new Set(['planetary-survey', 'asteroid-investigation', 'deep-space-exploration']);
export const SAFETY = { cautious: { label: 'Cautious', risk: 0.85, cost: 1.1 }, standard: { label: 'Standard', risk: 1, cost: 1 }, bold: { label: 'Bold', risk: 1.15, cost: 0.92 } };
export const PACE = { steady: { label: 'Steady', build: 1, upkeep: 1 }, rapid: { label: 'Rapid', build: 0.7, upkeep: 1.25 } };
export const safetyOf = game => SAFETY[game.state.civ.policy.safety] || SAFETY.standard;
export const paceOf = game => PACE[game.state.civ.policy.pace] || PACE.steady;
export function setPolicy(game, key, value) {
  const table = key === 'safety' ? SAFETY : key === 'pace' ? PACE : null; if (!table || !table[value]) return { ok: false, error: 'Unknown policy.' };
  game.state.civ.policy[key] = value; return { ok: true };
}

// ---- worlds ----
export const worldInfo = (game, id) => game.data.worlds.worlds[id] || null;
export const worldStage = (game, id) => game.state.worlds[id]?.stage || 0;
export const maxStage = (game, id) => { const w = worldInfo(game, id); return !w ? 0 : (w.volatiles + w.materials === 0 ? 2 : 4); };
export function worldsOnExpedition(game, ex) {
  const s = game.state; if (!SURVEY_TYPES.has(ex.type)) return;
  const w = worldInfo(game, ex.targetId); if (!w) return;
  const ship = s.spacecraft.find(x => x.id === ex.shipId); const lands = ship ? classOf(game, ship).canLand : false;
  const rec = s.worlds[ex.targetId] || (s.worlds[ex.targetId] = { stage: 0, log: [] }); let next = rec.stage;
  if (rec.stage === 0) next = 1; else if (lands || rec.stage >= 2 && ex.type !== 'deep-space-exploration') next = rec.stage + 1;
  if (rec.stage >= 1 && !lands) next = rec.stage; // surface stages need a vessel that can land
  next = Math.min(next, maxStage(game, ex.targetId));
  if (next > rec.stage) { rec.stage = next; rec.log.push({ t: s.time.t, stage: next, by: ex.name });
    const name = getObject(game.data.db, ex.targetId)?.name || ex.targetId; game.log(`${name}: ${STAGE_NAMES[next]} complete.`, 'good');
    record(game, { kind: 'mission', title: `${name}: ${STAGE_NAMES[next].toLowerCase()}`, text: w.note, major: next >= 4, ref: ex.targetId }); }
}

// ---- stock and imports ----
export const MATERIAL_IMPORT_RC = 25;
export function importMaterials(game, units) {
  units = Math.round(units); if (!(units > 0 && units <= 200)) return { ok: false, error: 'Order between 1 and 200 units.' };
  if (!spend(game, units * MATERIAL_IMPORT_RC, `Materials shipped from Earth (${units})`)) return { ok: false, error: `That costs ${units * MATERIAL_IMPORT_RC} RC.` };
  game.state.stock.materials += units; return { ok: true };
}

// ---- facilities ----
export const facilityType = (game, id) => game.data.facilityById[id];
export const activeFacilities = (game, type) => game.state.facilities.filter(f => f.status === 'active' && (!type || f.type === type));
export const relayBonus = game => 25 * activeFacilities(game, 'relay').length;
export const siteAu = (game, site) => site === 'station' ? 1 : (getObject(game.data.db, site)?.distance_au ?? 1);
export const relaysNeeded = au => au <= 6 ? 0 : au <= 20 ? 1 : 2;
export const isConnected = (game, f) => activeFacilities(game, 'relay').filter(r => r.id !== f.id).length >= relaysNeeded(siteAu(game, f.site));
export function canBuild(game, typeId, site) {
  const s = game.state; const t = facilityType(game, typeId);
  if (!t) return { ok: false, error: 'Unknown facility.' };
  if (t.unlock && !game.unlocked(t.unlock)) return { ok: false, error: 'Research the required technology first.' };
  if (!t.sites.includes(site)) return { ok: false, error: 'This facility cannot be built at that site.' };
  if (worldStage(game, site) < t.minStage && site !== 'station') return { ok: false, error: `Needs ${STAGE_NAMES[t.minStage]} at this site first.` };
  if (s.facilities.some(f => f.type === typeId && f.site === site && f.status !== 'lost')) return { ok: false, error: 'Already built or under construction there.' };
  if (s.stock.materials < t.materials) return { ok: false, error: `Needs ${t.materials} units of materials (you have ${Math.floor(s.stock.materials)}). Import or mine more.` };
  if (s.resources.credits < t.cost) return { ok: false, error: `Needs ${t.cost} RC.` };
  return { ok: true };
}
export function buildFacility(game, typeId, site) {
  const c = canBuild(game, typeId, site); if (!c.ok) return c;
  const s = game.state; const t = facilityType(game, typeId); spend(game, t.cost, `Facility: ${t.name} (${site})`); s.stock.materials -= t.materials;
  const f = { id: `fac-${s.uid++}`, type: typeId, site, status: 'building', startedAt: s.time.t, completeAt: s.time.t + Math.round(t.days * paceOf(game).build) * DAY, pop: 0, condition: 100, produced: 0, settledDays: 0 };
  s.facilities.push(f); schedule(game, f.completeAt, 'facility-complete', { id: f.id });
  game.log(`Construction started: ${t.name} at ${site}.`, 'info'); return { ok: true, facility: f };
}
onSchedule('facility-complete', (game, { id }) => {
  const f = game.state.facilities.find(x => x.id === id); if (!f || f.status !== 'building') return;
  f.status = 'active'; const t = facilityType(game, f.type);
  game.log(`${t.name} at ${f.site} is operational.`, 'good'); record(game, { kind: 'infrastructure', title: `${t.name} built at ${f.site}`, text: t.effect, major: game.state.facilities.filter(x => x.status === 'active').length === 1, ref: f.id });
  game.addMessage({ from: 'Mission Operations', subject: `Facility operational: ${t.name}`, body: t.effect, type: 'info' });
});
export const STAFF_COST = 300;
export function staffFacility(game, id, n) {
  const f = game.state.facilities.find(x => x.id === id); if (!f || f.status !== 'active') return { ok: false, error: 'Facility is not active.' };
  const t = facilityType(game, f.type); n = Math.round(n);
  if (!t.staffCap) return { ok: false, error: 'This facility is not staffed.' };
  if (!(n > 0) || f.pop + n > t.staffCap) return { ok: false, error: `Staff capacity is ${t.staffCap}.` };
  if (!spend(game, n * STAFF_COST, `Staff transport to ${f.site}`)) return { ok: false, error: `Transport costs ${n * STAFF_COST} RC.` };
  f.pop += n; return { ok: true };
}
export const SERVICE_FACILITY_RC = 200;
export function serviceFacility(game, id) {
  const f = game.state.facilities.find(x => x.id === id); if (!f || f.status !== 'active') return { ok: false, error: 'Facility is not active.' };
  if (f.condition >= 99.5) return { ok: false, error: 'Already in perfect condition.' };
  if (!spend(game, SERVICE_FACILITY_RC, `Service: facility at ${f.site}`)) return { ok: false, error: `Servicing costs ${SERVICE_FACILITY_RC} RC.` };
  f.condition = 100; return { ok: true };
}
export function outputFactor(game, f) {
  const t = facilityType(game, f.type); let staff = 1;
  if (t.staffCap) staff = f.pop > 0 ? Math.min(1, f.pop / Math.max(1, t.staffCap * 0.5)) : game.unlocked('ops:autonomous') ? 0.6 : 0;
  return staff * (f.condition < 30 ? 0.5 : 1) * (isConnected(game, f) ? 1 : 0);
}
export function civilizationDaily(game) {
  const s = game.state; const pace = paceOf(game);
  for (const f of s.facilities) {
    if (f.status !== 'active') continue; const t = facilityType(game, f.type);
    addCredits(game, -Math.round((t.upkeepPerDay * pace.upkeep + f.pop * 6) * 10) / 10, `Facility upkeep: ${t.name} (${f.site})`, 'expense');
    f.condition = Math.max(0, f.condition - 0.25);
    if (t.produces) { const w = worldInfo(game, f.site); const f2 = outputFactor(game, f);
      for (const [res, base] of Object.entries(t.produces)) { const rating = w ? w[res] : 0; const out = base * (rating / 3) * f2; s.stock[res] += out; f.produced += out; } }
    if (f.type === 'outpost') { s.resources.researchPoints += 0.3 * f.pop; f.settledDays = f.pop >= 8 ? f.settledDays + 1 : 0; if (f.settledDays === 60) { record(game, { kind: 'infrastructure', title: `Settlement established at ${f.site}`, text: `${f.pop} residents. A permanent presence beyond Earth.`, major: true, ref: f.id }); game.log(`A permanent settlement has been established at ${f.site}.`, 'good'); } }
  }
  const idx = civIndex(game); const tier = idx.tier; if (s.civ.tier !== tier) { if (s.civ.tier !== undefined) record(game, { kind: 'station', title: `The programme becomes: ${tier}`, text: `Civilization index ${idx.score}.`, major: true }); s.civ.tier = tier; }
}

// ---- civilization index (SIMULATED measure) ----
export const TIERS = [[0, 'Research Station'], [30, 'Space Programme'], [80, 'Solar Programme'], [160, 'Interplanetary Society']];
export function civIndex(game) {
  const s = game.state; const act = s.facilities.filter(f => f.status === 'active');
  const science = Math.min(40, s.discoveries.length * 1.2 + Object.keys(s.tech.researched).length * 0.8);
  const infrastructure = Math.min(40, act.length * 5 + Object.values(s.modules).reduce((a, m) => a + (m.level - 1) * 2, 0));
  const exploration = Math.min(40, Object.values(s.worlds).reduce((a, w) => a + w.stage * 2, 0) + s.earth.completed);
  const population = s.crew.length + act.reduce((a, f) => a + f.pop, 0);
  const morale = s.crew.length ? s.crew.reduce((a, c) => a + c.morale, 0) / s.crew.length : 50;
  const stability = Math.round(Math.min(30, morale * 0.2 + (s.resources.credits > 0 ? 8 : 0) + Math.min(6, s.resources.reputation)));
  const score = Math.round(science + infrastructure + exploration + stability + Math.min(30, population));
  const tier = [...TIERS].reverse().find(([min]) => score >= min)[1];
  return { science: Math.round(science), infrastructure: Math.round(infrastructure), exploration: Math.round(exploration), stability, population, score, tier };
}
