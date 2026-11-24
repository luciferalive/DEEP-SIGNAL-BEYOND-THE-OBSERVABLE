import { worldsOnExpedition, safetyOf } from './civilization.js';
import { expeditionCostMult, contractsOnExpedition, emergencyActive } from './earth.js';
// Expeditions: multi-stage missions flown by spacecraft.
// PLANNING (the planner form) → PREPARATION → LAUNCH → TRANSIT → OPERATION → DATA COLLECTION → [RECOVERY] → ANALYSIS → COMPLETED
// Other end states: FAILED, INTERRUPTED (temporary), ABORTED (then RECOVERY), CANCELLED.
import { DAY, HOUR } from './constants.js';
import { getObject } from './astronomy-database.js';
import { spend, addCredits } from './finance.js';
import { schedule, onSchedule } from './scheduler.js';
import { classOf, speedAuDay, fuelEfficiency, isIdle, isReusable, shipCondition } from './spacecraft.js';
import { linkStatus, logTransmission } from './comms-network.js';
import { isAvailable } from './crew-management.js';
import { record } from './chronicle.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const STAGES = ['PLANNING', 'PREPARATION', 'LAUNCH', 'TRANSIT', 'OPERATION', 'DATA COLLECTION', 'RECOVERY', 'ANALYSIS', 'COMPLETED'];
export const END_STATES = ['COMPLETED', 'FAILED', 'ABORTED', 'CANCELLED'];
export const PREP = [{ label: 'Standard', days: 3, cost: 0, risk: 0 }, { label: 'Thorough', days: 5, cost: 0.15, risk: 0.2 }, { label: 'Exhaustive', days: 8, cost: 0.35, risk: 0.38 }];
const isPilot = c => c.spec === 'pilot';
export const targetOf = (game, id) => getObject(game.data.db, id) || game.state.spacecraft.find(x => x.id === id) || null;
const crewSkill = (crew, skill) => crew.length ? crew.reduce((a, c) => a + (c.skills[skill] || 0), 0) / crew.length : 0;

function pathAu(game, type, target) {
  if (type.mode === 'remote') return 0;
  if (type.mode === 'recovery') { const loc = target.location; const o = loc.kind === 'orbit' ? getObject(game.data.db, loc.at) : null; return Math.max(0.05, (o?.distance_au != null ? Math.abs(o.distance_au - 1) : 1) + 0.05); }
  return Math.max(0.03, Math.abs((target.distance_au ?? 1) - 1) + 0.05);
}
export function targetsFor(game, type) {
  if (type.mode === 'recovery') return game.state.spacecraft.filter(x => x.status === 'Stranded').map(x => ({ id: x.id, name: x.name }));
  return game.data.db.list.filter(o => type.groups.includes(o.group) && (type.minAu == null || (o.distance_au ?? 0) >= type.minAu)).map(o => ({ id: o.id, name: o.name }));
}

// Pure estimate + validation. plan: { type, targetId, shipId, crewIds, equipment, days, prep }
export function estimate(game, plan) {
  const s = game.state, errors = [], type = game.data.typeById[plan.type]; const ship = s.spacecraft.find(x => x.id === plan.shipId);
  if (!type) return { ok: false, errors: ['Choose a mission type.'] };
  const target = plan.targetId ? targetOf(game, plan.targetId) : null;
  if (!target) errors.push('Choose a target.');
  if (!ship) errors.push('Choose a spacecraft.'); else {
    const c = classOf(game, ship);
    if (!isIdle(ship)) errors.push(`${ship.name} is not available (${ship.status}).`);
    if (!type.classes.includes(c.baseClass || ship.class)) errors.push(`${c.name} cannot fly this mission type.`);
  }
  if (target && type.mode !== 'recovery' && !type.groups.includes(target.group)) errors.push(`This mission type does not suit this kind of target.`);
  const eq = (plan.equipment || []).map(id => game.data.equipById[id]).filter(Boolean);
  if (ship) for (const e of eq) if (!ship.equipment.includes(e.id)) errors.push(`${e.name} is not installed on ${ship.name}.`);
  if (type.mode !== 'recovery') {
    if (!eq.some(e => type.kinds.includes(e.kind))) errors.push(`Select equipment that returns ${type.kinds.join(', ')} data.`);
    if (target) for (const e of eq) {
      if (type.mode === 'remote') { const d = target.distance_ly; if (!e.remoteGroups.includes(target.group) || (d != null && d > e.remoteMaxLy)) errors.push(`${e.name} cannot observe this target from Earth's neighbourhood.`); }
      else if (!e.inSitu) errors.push(`${e.name} is a remote instrument and cannot be used in situ.`);
    }
  }
  if (type.id === 'emergency' && !emergencyActive(game)) errors.push('Emergency missions need an active emergency request from Earth.');
  const days = clamp(Math.round(plan.days || type.days[0]), type.days[0], type.days[1]);
  const crew = (plan.crewIds || []).map(id => s.crew.find(c => c.id === id)).filter(Boolean);
  if (ship) { const c = classOf(game, ship);
    if (c.crewed) { if (!crew.length) errors.push('Assign crew.'); if (crew.length > c.crewCap) errors.push(`Crew capacity is ${c.crewCap}.`); if (crew.length && !crew.some(isPilot)) errors.push('A crewed vessel needs a pilot.'); for (const m of crew) if (!isAvailable(m) || m.missionId || m.assignment === 'training') errors.push(`${m.name} is not available.`); }
    else if (crew.length) errors.push('This vessel is uncrewed.'); }
  let travel = 0, fuel = 5, path = 0, cost = 0, risk = 0, parts = {}, ret = 0;
  if (ship && target) {
    const c = classOf(game, ship); path = pathAu(game, type, target);
    if (type.mode !== 'remote') { if (path > c.rangeAu) errors.push(`Target is ${path.toFixed(1)} AU away; ${c.name} reaches ${c.rangeAu} AU.`); if (type.minAu && (target.distance_au ?? 0) < type.minAu) errors.push(`Needs a target beyond ${type.minAu} AU.`); }
    const spd = speedAuDay(game, ship); travel = type.mode === 'remote' ? 2 : Math.max(1, Math.ceil(path / spd));
    const reusableTrip = isReusable(game, ship) && type.mode !== 'remote';
    ret = reusableTrip || type.mode === 'recovery' ? travel : 0;
    fuel = type.mode === 'remote' ? 5 : Math.max(2, Math.round(path * c.fuelPerAu * (ret ? 2 : 1) / fuelEfficiency(game)));
    if (fuel > ship.fuel) errors.push(`Needs ${fuel} kg of propellant; ${ship.name} has ${Math.round(ship.fuel)} kg.`);
    const prep = PREP[plan.prep || 0]; const ops = c.opsPerDay * (days + 0.4 * (travel + ret));
    cost = Math.round((ops * (1 + prep.cost) + 100) * expeditionCostMult(game) * safetyOf(game).cost);
    if (s.resources.credits < cost) errors.push(`Needs ${cost} RC.`);
    const known = type.mode !== 'recovery' && s.discoveries.some(d => d.targetId === target.id);
    const pilot = crew.filter(isPilot).reduce((a, m) => Math.max(a, (m.skills.robotics + m.skills.engineering) / 2), 0);
    parts = { mission: type.riskBase, vessel: c.riskBase, distance: 0.012 * Math.sqrt(path), condition: (100 - shipCondition(ship)) / 100 * 0.15 + (ship.maintenance.overdue ? 0.04 : 0) };
    const raw = Object.values(parts).reduce((a, b) => a + b, 0);
    const mods = { preparation: -prep.risk, knowledge: known ? -0.15 : 0, crew: c.crewed ? -0.02 * pilot : 0, technology: -game.techEffect('shipReliability') };
    const mod = clamp(1 + Object.values(mods).reduce((a, b) => a + b, 0), 0.3, 1.5); risk = clamp(raw * mod * safetyOf(game).risk, 0.01, 0.6); parts = { ...parts, ...mods };
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], type, ship, target, days, travel, ret, fuel, cost, risk, parts, path, prepDays: PREP[plan.prep || 0].days, crew };
}

export function createExpedition(game, plan) {
  const e = estimate(game, plan); if (!e.ok) return { ok: false, error: e.errors[0], errors: e.errors };
  const s = game.state; spend(game, e.cost, `Mission: ${e.type.name} (${e.target.name})`);
  const ex = { id: `exp-${s.uid++}`, name: `${e.type.name}: ${e.target.name}`, type: e.type.id, targetId: e.target.id, shipId: e.ship.id, crewIds: e.crew.map(c => c.id), equipment: [...plan.equipment], days: e.days, travelDays: e.travel, returnDays: e.ret,
    fuel: e.fuel, cost: e.cost, risk: e.risk, prep: plan.prep || 0, stage: 'PREPARATION', status: 'active', history: [{ stage: 'PLANNING', t: s.time.t }, { stage: 'PREPARATION', t: s.time.t }], datasetIds: [], delayDays: 0, anomalyId: plan.anomalyId || null, createdAt: s.time.t, outcome: null };
  s.expeditions.unshift(ex); e.ship.missionId = ex.id; e.ship.status = 'In preparation'; for (const c of e.crew) c.missionId = ex.id;
  schedule(game, s.time.t + e.prepDays * DAY, 'exp-stage', { id: ex.id });
  game.log(`Mission planned: ${ex.name} (${e.ship.name}). Risk ${(e.risk * 100).toFixed(0)}%.`, 'info'); logTransmission(game, { from: 'Station', to: e.ship.name, kind: 'directive', text: `Mission directive: ${ex.name}.` });
  return { ok: true, expedition: ex };
}
const setStage = (game, ex, stage) => { ex.stage = stage; ex.history.push({ stage, t: game.state.time.t }); };
const shipOf = (game, ex) => game.state.spacecraft.find(x => x.id === ex.shipId);
const crewOf = (game, ex) => ex.crewIds.map(id => game.state.crew.find(c => c.id === id)).filter(Boolean);
const freeCrew = (game, ex) => { for (const c of crewOf(game, ex)) c.missionId = null; };

function rollRisk(game, ex, where) {
  if (game.rand() >= ex.risk / 2) return null;
  const ship = shipOf(game, ex); const r = game.rand();
  if (r < 0.62) { const d = 1 + Math.floor(game.rand() * 4); const k = Object.keys(ship.systems)[Math.floor(game.rand() * 7)]; ship.systems[k] = Math.max(0, ship.systems[k] - 15); game.log(`${ex.name}: malfunction in ${k} during ${where}; ${d} days lost.`, 'warn'); return { type: 'delay', days: d }; }
  if (r < 0.88) { const h = 2 + Math.floor(game.rand() * 4); ship.commsDownUntil = game.state.time.t + h * DAY; game.log(`${ex.name}: contact lost for ${h} days.`, 'warn'); logTransmission(game, { from: ship.name, to: 'Station', kind: 'notification', text: `Contact lost for ${h} days.` }); return { type: 'interrupt', days: h }; }
  return { type: 'major' };
}
function fail(game, ex, why) {
  const s = game.state, ship = shipOf(game, ex), crew = crewOf(game, ex); setStage(game, ex, 'FAILED'); ex.status = 'failed'; ex.outcome = why;
  if (classOf(game, ship).crewed) { ship.status = 'Stranded'; for (const c of crew) { c.health = clamp(c.health - 20, 5, 100); c.morale = clamp(c.morale - 12, 0, 100); } ship.location = ship.location.kind === 'transit' ? { kind: 'orbit', at: ex.targetId, stranded: true } : { ...ship.location, stranded: true }; }
  else { ship.status = 'Lost'; ship.missionId = null; }
  ship.systems.propulsion = Math.min(ship.systems.propulsion, 20); s.earth.failed += 1; s.resources.reputation -= 1;
  game.log(`MISSION FAILED: ${ex.name}. ${why}`, 'bad'); game.addMessage({ from: 'Mission Operations', subject: `Mission failed: ${ex.name}`, body: why + (ship.status === 'Stranded' ? ' The crew survived and is awaiting recovery (plan a Spacecraft recovery mission).' : ' The vessel is lost.'), type: 'info', fictional: false });
  record(game, { kind: 'mission', title: `Mission failed: ${ex.name}`, text: why, major: true, ref: ex.id });
  if (!classOf(game, ship).crewed) freeCrew(game, ex);
}
const delay = (game, ex, d) => { ex.delayDays += d; };

onSchedule('exp-stage', (game, { id }) => {
  const s = game.state, ex = s.expeditions.find(x => x.id === id); if (!ex || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(ex.stage) || ex.status === 'aborting-lock') return;
  const ship = shipOf(game, ex), type = game.data.typeById[ex.type], now = s.time.t, L = linkStatus(game, ship);
  // A vessel without contact cannot be commanded or return data: wait for the link.
  if (['OPERATION', 'DATA COLLECTION', 'TRANSIT'].includes(ex.stage) && ship.location.kind !== 'dock' && !L.usable) { if (ex.status !== 'interrupted') { ex.status = 'interrupted'; game.log(`${ex.name} is interrupted: link ${L.state}.`, 'warn'); } schedule(game, now + 12 * HOUR, 'exp-stage', { id }); return; }
  ex.status = 'active';
  switch (ex.stage) {
    case 'PREPARATION': { setStage(game, ex, 'LAUNCH'); ship.fuel -= ex.fuel; ship.status = 'Launching'; const r = rollRisk(game, ex, 'launch');
      if (r?.type === 'major') return fail(game, ex, 'A launch anomaly destroyed or disabled the vessel.');
      schedule(game, now + (1 + (r?.type === 'delay' ? r.days : 0)) * DAY, 'exp-stage', { id }); break; }
    case 'LAUNCH': { setStage(game, ex, 'TRANSIT'); ship.status = 'In transit'; const r = rollRisk(game, ex, 'transit'); if (r?.type === 'major') return fail(game, ex, 'A major system failure occurred in transit.');
      const trav = ex.travelDays + (r?.type === 'delay' ? r.days : 0) + (r?.type === 'interrupt' ? r.days : 0); ship.location = { kind: 'transit', from: 'station', to: ex.targetId, departed: now, eta: now + trav * DAY, outbound: true };
      logTransmission(game, { from: ship.name, to: 'Station', kind: 'mission-update', text: `Launched. Arrival in ${trav} days.`, delayMin: L.delayMin });
      schedule(game, now + trav * DAY, 'exp-stage', { id }); break; }
    case 'TRANSIT': { setStage(game, ex, 'OPERATION'); ship.status = 'On station'; ship.location = { kind: 'orbit', at: ex.targetId }; const r = rollRisk(game, ex, 'operations'); if (r?.type === 'major') return fail(game, ex, 'A major failure ended operations at the target.');
      const d = ex.days + (r?.type === 'delay' || r?.type === 'interrupt' ? r.days : 0); logTransmission(game, { from: ship.name, to: 'Station', kind: 'mission-update', text: `Arrived at ${targetOf(game, ex.targetId).name}. Operations for ${d} days.`, delayMin: linkStatus(game, ship).delayMin });
      schedule(game, now + d * DAY, 'exp-stage', { id }); break; }
    case 'OPERATION': setStage(game, ex, 'DATA COLLECTION'); schedule(game, now + 1 * DAY, 'exp-stage', { id }); break;
    case 'DATA COLLECTION': collectData(game, ex); afterData(game, ex); break;
    case 'RECOVERY': finishRecovery(game, ex); break;
    default: break;
  }
});
function afterData(game, ex) {
  const s = game.state, ship = shipOf(game, ex), type = game.data.typeById[ex.type], now = s.time.t;
  if (type.mode === 'recovery') { const t = s.spacecraft.find(x => x.id === ex.targetId); if (t) { t.status = 'Docked'; t.location = { kind: 'dock', at: 'station' }; t.missionId = null; for (const k of Object.keys(t.systems)) t.systems[k] = Math.max(t.systems[k], 35); for (const c of s.crew.filter(c => c.missionId === t.lastMission)) c.missionId = null; } }
  if (ex.returnDays > 0) { setStage(game, ex, 'RECOVERY'); ship.status = 'Returning'; ship.location = { kind: 'transit', from: ex.targetId, to: 'station', departed: now, eta: now + ex.returnDays * DAY, outbound: true }; schedule(game, now + ex.returnDays * DAY, 'exp-stage', { id: ex.id }); }
  else { if (isReusable(game, ship)) { ship.status = 'Docked'; ship.location = { kind: 'dock', at: 'station' }; ship.missionId = null; } else { ship.status = 'Expended'; ship.missionId = null; } freeCrew(game, ex); toAnalysis(game, ex); }
}
function finishRecovery(game, ex) {
  const ship = shipOf(game, ex); ship.status = 'Docked'; ship.location = { kind: 'dock', at: 'station' }; ship.missionId = null; for (const k of Object.keys(ship.systems)) ship.systems[k] = Math.max(0, ship.systems[k] - 5); freeCrew(game, ex);
  game.log(`${ship.name} returned to the station.`, 'good'); toAnalysis(game, ex);
}
function toAnalysis(game, ex) {
  const type = game.data.typeById[ex.type];
  if (!ex.datasetIds.length) return complete(game, ex);
  setStage(game, ex, 'ANALYSIS'); ex.analysisDeadline = game.state.time.t + 45 * DAY; game.log(`${ex.name}: data returned. Analyse it in the Research Laboratory.`, 'good');
}
function collectData(game, ex) {
  const s = game.state, ship = shipOf(game, ex), type = game.data.typeById[ex.type], crew = crewOf(game, ex), target = targetOf(game, ex.targetId);
  if (type.mode === 'recovery') { setStage(game, ex, 'DATA COLLECTION'); return; }
  const cond = shipCondition(ship); const skillF = crew.length ? 0.85 + 0.03 * crewSkill(crew, type.skill) : 0.9; const durF = 0.6 + 0.4 * (1 - Math.exp(-ex.days / 10));
  for (const id of ex.equipment) { const e = game.data.equipById[id]; const q0 = e.accuracy * durF * skillF * (0.6 + 0.4 * cond / 100) * (1 + game.techEffect('dataYield')) / 0.75;
    const q = Math.round(clamp(q0 + (game.rand() - 0.5) * 0.16, 0.1, 0.97) * 100) / 100; const match = type.kinds.includes(e.kind); const partial = q < 0.5;
    const ds = { id: `ds-${s.uid++}`, obsId: null, expId: ex.id, targetId: target.id, instrumentId: null, equipmentId: id, kind: e.kind, quality: q, hours: ex.days * 24, t: s.time.t, partial, sizeGB: Math.round(ex.days * 2.5 * 10) / 10, status: 'raw',
      noise: Math.round((1 - q) * 60) / 100, completeness: partial ? 0.55 : Math.min(0.99, 0.8 + q * 0.2), reliability: Math.round(q * (match ? 0.95 : 0.7) * 100) / 100, value: Math.round(q * (match ? 1 : 0.4) * 100) / 100 };
    s.datasets.unshift(ds); ex.datasetIds.push(ds.id); }
  const L = linkStatus(game, ship); logTransmission(game, { from: ship.name, to: 'Station', kind: 'data', text: `Data return: ${ex.datasetIds.length} datasets from ${target.name}.`, delayMin: L.delayMin });
  game.log(`${ex.name}: ${ex.datasetIds.length} datasets received.`, 'good');
}
function complete(game, ex) {
  const s = game.state, type = game.data.typeById[ex.type]; const ds = ex.datasetIds.map(id => s.datasets.find(d => d.id === id)).filter(Boolean); const q = ds.length ? ds.reduce((a, d) => a + d.quality, 0) / ds.length : 0.5;
  const credits = Math.round(type.reward * 400 * q * (1 + game.moduleEffect('rewardMult'))), rp = Math.round(type.reward * 10 * q), rep = Math.round(type.reward * 5) / 10;
  addCredits(game, credits, `Mission reward: ${ex.name}`, 'income'); s.resources.researchPoints += rp; s.resources.reputation += rep; setStage(game, ex, 'COMPLETED'); ex.status = 'done'; ex.outcome = `Data quality ${Math.round(q * 100)}%`; ex.rewards = { credits, rp, rep }; s.earth.completed += 1;
  game.log(`MISSION COMPLETE: ${ex.name} (+${credits} RC, +${rp} RP, +${rep} reputation).`, 'good'); record(game, { kind: 'mission', title: `Mission completed: ${ex.name}`, text: ex.outcome, major: s.earth.completed === 1, ref: ex.id });
  game.addMessage({ from: 'Mission Operations', subject: `Mission complete: ${ex.name}`, body: `Final data quality ${Math.round(q * 100)}%. Rewards credited.`, type: 'info', fictional: false });
  worldsOnExpedition(game, ex); contractsOnExpedition(game, ex); game.emit?.('expedition-complete', ex);
}
export function abortExpedition(game, id) {
  const s = game.state, ex = s.expeditions.find(x => x.id === id); if (!ex || ['COMPLETED', 'FAILED', 'CANCELLED', 'ABORTED', 'RECOVERY', 'ANALYSIS'].includes(ex.stage)) return { ok: false, error: 'This mission cannot be aborted now.' };
  const ship = shipOf(game, ex), now = s.time.t;
  if (ex.stage === 'PREPARATION') { addCredits(game, Math.round(ex.cost * 0.7), `Refund: ${ex.name}`, 'income'); ex.stage = 'CANCELLED'; ex.status = 'cancelled'; ex.history.push({ stage: 'CANCELLED', t: now }); ship.status = 'Docked'; ship.missionId = null; freeCrew(game, ex); s.schedule = s.schedule.filter(x => !(x.type === 'exp-stage' && x.payload.id === id)); game.log(`${ex.name} cancelled (70% refunded).`, 'info'); return { ok: true }; }
  if (ship.location.kind !== 'dock' && !linkStatus(game, ship).usable) return { ok: false, error: 'No contact with the vessel: it cannot be commanded.' };
  s.schedule = s.schedule.filter(x => !(x.type === 'exp-stage' && x.payload.id === id));
  const wasOp = ex.stage === 'OPERATION' || ex.stage === 'DATA COLLECTION'; ex.history.push({ stage: 'ABORTED', t: now }); ex.status = 'aborted'; s.earth.aborted += 1; s.resources.reputation -= 0.3;
  if (wasOp) { ex.days = Math.max(1, Math.round((now - ex.history.find(h => h.stage === 'OPERATION').t) / DAY)); collectData(game, ex); }
  if (isReusable(game, ship) && classOf(game, ship).role !== 'remote' || ship.location.kind === 'transit' && ex.returnDays > 0) { const back = Math.max(1, ex.returnDays || ex.travelDays); ex.stage = 'RECOVERY'; ship.status = 'Returning'; ship.location = { kind: 'transit', from: ex.targetId, to: 'station', departed: now, eta: now + back * DAY, outbound: true }; ex.returnDays = back; schedule(game, now + back * DAY, 'exp-stage', { id }); }
  else { ex.stage = 'ANALYSIS'; ship.status = isReusable(game, ship) ? 'Docked' : 'Expended'; if (isReusable(game, ship)) ship.location = { kind: 'dock', at: 'station' }; ship.missionId = null; freeCrew(game, ex); if (!ex.datasetIds.length) { ex.stage = 'ABORTED'; } else ex.analysisDeadline = now + 45 * DAY; }
  game.log(`${ex.name} aborted.`, 'warn'); return { ok: true };
}
export function expeditionsTick(game) {
  const s = game.state;
  for (const ex of s.expeditions) {
    if (ex.stage !== 'ANALYSIS') continue;
    const ds = ex.datasetIds.map(id => s.datasets.find(d => d.id === id)).filter(Boolean);
    if (ds.every(d => d.status === 'analysed') || s.time.t >= ex.analysisDeadline) { if (ds.some(d => d.status !== 'analysed')) ex.outcome = 'Closed with unanalysed data.'; complete(game, ex); }
  }
  if (s.expeditions.length > 80) s.expeditions.length = 80;
}
export const activeExpeditions = game => game.state.expeditions.filter(e => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(e.stage) && e.stage !== 'ABORTED');
