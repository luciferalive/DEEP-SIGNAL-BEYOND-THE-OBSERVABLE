// Observatory: instrument capabilities, observation jobs, data production and false positives.
import { HOUR } from './constants.js';
import { getObject, distanceLy, GROUPS } from './astronomy-database.js';
import { workRates } from './crew-management.js';
import { spend } from './finance.js';
import { createAnomaly, resolveAnomaly } from './anomaly-engine.js';
import { formatDuration } from './time-engine.js';

export const EXPOSURE_HOURS = [2, 6, 12, 24];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const instrumentAccuracy = (game, inst) => inst.accuracy + game.techEffect('accuracy', inst.kind);
export const observationCost = (inst, hours) => Math.round(inst.operatingCostPerHour * hours);

// Can this instrument observe this object? Returns {ok, reason, maxDistance}.
export function canObserve(game, inst, obj) {
  if (!obj) return { ok: false, reason: 'No target selected.' };
  if (obj.group === 'exoplanet') return { ok: false, reason: 'Exoplanets cannot be observed directly with current instruments. Observe the host star instead.' };
  const cap = inst.capabilities.find(c => c.group === obj.group);
  if (!cap) return { ok: false, reason: `${inst.name} cannot observe ${GROUPS[obj.group] || obj.group}.` };
  const d = distanceLy(obj);
  if (cap.maxDistanceLy == null) return { ok: true, maxDistance: null };
  if (d == null) return { ok: false, reason: 'Distance unknown, so range cannot be checked.' };
  if (d > cap.maxDistanceLy) return { ok: false, reason: `Out of range: ${inst.name} reaches ${cap.maxDistanceLy.toLocaleString('en-US')} ly for this class of object.`, maxDistance: cap.maxDistanceLy };
  return { ok: true, maxDistance: cap.maxDistanceLy };
}

export function estimateQuality(game, inst, obj, hours) {
  const cap = inst.capabilities.find(c => c.group === obj.group);
  const d = distanceLy(obj);
  const rangeFactor = cap && cap.maxDistanceLy && d != null ? 1 - 0.45 * Math.pow(d / cap.maxDistanceLy, 0.7) : 1;
  const durFactor = 0.6 + 0.4 * (1 - Math.exp(-hours / 8));
  const opSkill = workRates(game).bestOperator || 3;
  const opFactor = 0.85 + 0.03 * opSkill;
  const cond = 0.6 + 0.4 * (inst.condition / 100);
  return clamp(instrumentAccuracy(game, inst) * rangeFactor * durFactor * opFactor * cond / 0.75, 0, 0.97);
}

export const isInstrumentBusy = (game, inst) => game.state.observations.some(o => o.status === 'running' && o.instrumentId === inst.id);

export function startObservation(game, { instrumentId, targetId, hours, anomalyId = null }) {
  const s = game.state;
  const inst = s.instruments.find(i => i.id === instrumentId);
  const obj = getObject(game.data.db, targetId);
  if (!inst) return { ok: false, error: 'Unknown instrument.' };
  if (!EXPOSURE_HOURS.includes(hours)) return { ok: false, error: 'Choose an exposure of 2, 6, 12 or 24 hours.' };
  if (s.events.pauseObsUntil > s.time.t) return { ok: false, error: `Observations are suspended for ${formatDuration(s.events.pauseObsUntil - s.time.t)}.` };
  if (isInstrumentBusy(game, inst)) return { ok: false, error: `${inst.name} is already observing.` };
  const can = canObserve(game, inst, obj);
  if (!can.ok) return { ok: false, error: can.reason };
  if (workRates(game).operations <= 0) return { ok: false, error: 'Assign at least one healthy crew member to Observatory operations.' };
  if (s.station.brownout || s.station.battery < 30) return { ok: false, error: 'Not enough battery power to run the instrument.' };
  if (inst.condition < 15) return { ok: false, error: `${inst.name} needs maintenance before it can be used.` };
  const cost = observationCost(inst, hours);
  if (!spend(game, cost, `Observation: ${obj.name} (${inst.name}, ${hours} h)`)) return { ok: false, error: `Not enough research credits. This observation costs ${cost} RC.` };
  const o = { id: `obs-${s.uid++}`, instrumentId, targetId, hours, start: s.time.t, end: s.time.t + hours * HOUR, status: 'running', anomalyId, interrupted: false };
  s.observations.unshift(o);
  game.log(`${inst.name} began a ${hours} h observation of ${obj.name}.`, 'info');
  return { ok: true, observation: o };
}

export function interruptObservations(game, reason) {
  for (const o of game.state.observations) if (o.status === 'running' && !o.interrupted) { o.interrupted = true; game.log(`Observation of ${getObject(game.data.db, o.targetId)?.name} disturbed: ${reason}.`, 'warn'); }
}

export function observatoryTick(game) {
  const s = game.state;
  for (const o of s.observations) {
    if (o.status !== 'running') continue;
    if (s.station.brownout && !o.interrupted) { o.interrupted = true; game.log('Brownout disturbed a running observation.', 'warn'); }
    if (s.time.t >= o.end) completeObservation(game, o);
  }
  if (s.observations.length > 60) s.observations.length = 60;
}

function completeObservation(game, o) {
  const s = game.state; const inst = s.instruments.find(i => i.id === o.instrumentId); const obj = getObject(game.data.db, o.targetId);
  const noise = (game.rand() - 0.5) * 0.16;
  let q = clamp(estimateQuality(game, inst, obj, o.hours) + noise - (o.interrupted ? 0.3 : 0), 0, 0.97);
  q = Math.round(q * 100) / 100;
  o.quality = q; s.stats.observations += 1;
  if (q < 0.3) { o.status = 'failed'; game.log(`Observation of ${obj.name} failed: signal too weak (quality ${(q * 100) | 0}%).`, 'bad'); if (o.anomalyId) game.log('The anomaly could not be re-observed with this exposure.', 'warn'); return; }
  o.status = 'complete';
  const partial = q < 0.5;
  const ds = { id: `ds-${s.uid++}`, obsId: o.id, targetId: o.targetId, instrumentId: o.instrumentId, kind: inst.kind, quality: q, hours: o.hours, t: s.time.t, partial, sizeGB: Math.round(o.hours * 0.8 * 10) / 10, status: 'raw' };
  s.datasets.unshift(ds); o.datasetId = ds.id;
  game.log(`${partial ? 'Incomplete' : 'Complete'} observation of ${obj.name}: ${ds.sizeGB} GB, quality ${(q * 100) | 0}%.`, partial ? 'warn' : 'good');
  if (o.anomalyId) { resolveAnomaly(game, o.anomalyId, q); return; }
  if (!partial && game.rand() < 0.07) createAnomaly(game, ds);
}

export const SERVICE_COST = 80;
export function serviceInstrument(game, instrumentId) {
  const inst = game.state.instruments.find(i => i.id === instrumentId); if (!inst) return { ok: false, error: 'Unknown instrument.' };
  if (isInstrumentBusy(game, inst)) return { ok: false, error: 'Wait until the observation finishes.' };
  if (inst.condition >= 99) return { ok: false, error: 'The instrument is already in excellent condition.' };
  if (workRates(game).maintenance <= 0) return { ok: false, error: 'Assign a healthy crew member to Maintenance first.' };
  if (!spend(game, SERVICE_COST, `Service: ${inst.name}`)) return { ok: false, error: `Servicing costs ${SERVICE_COST} RC.` };
  inst.condition = Math.min(100, inst.condition + 30); game.log(`${inst.name} serviced (condition ${Math.round(inst.condition)}%).`, 'info');
  return { ok: true };
}
