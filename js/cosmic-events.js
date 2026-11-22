// Cosmic and station events. Every event is a structured record (id, type, category, severity, time, description,
// affected systems, consequences, resolution, status). Decision events wait for the player; transient events
// (flares, supernova alerts, pulsar timing...) are time-limited science opportunities. All are simulated game events.
import { DAY, HOUR } from './constants.js';
import { weightedPick } from './rng.js';
import { interruptObservations, instrumentAccuracy } from './observatory.js';
import { addCredits } from './finance.js';
import { workRates } from './crew-management.js';
import { record } from './chronicle.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const EFFECT_TEXT = { credits: e => `${e.value >= 0 ? '+' : ''}${e.value} RC`, morale: e => `crew morale ${e.value > 0 ? '+' : ''}${e.value}`, crewHealthAll: e => `crew health ${e.value}`, crewHealthOne: () => 'one crew member falls ill', systemCondition: e => `${e.system} condition ${e.value}`, instrumentCondition: e => `instrument condition ${e.value}`, pauseObservations: e => `observations paused ${e.hours} h` };
export const activeTransients = game => game.state.events.records.filter(r => r.transient && r.status === 'active');

function newRecord(game, def, extra = {}) {
  const s = game.state;
  const r = { id: `ev-${s.uid++}`, defId: def.id, type: def.type || def.title, category: def.category, severity: def.severity || 'info', t: s.time.t, title: def.title, description: def.text, affected: def.affected || [], consequences: [], resolution: null, status: 'active', simulated: true, ...extra };
  s.events.records.unshift(r); if (s.events.records.length > 200) s.events.records.length = 200;
  return r;
}

export function eventsTick(game) {
  const s = game.state; const day = Math.floor(s.time.t / DAY);
  if (s.events.solarFactor !== undefined && s.events.solarUntil && s.time.t >= s.events.solarUntil) { delete s.events.solarFactor; delete s.events.solarUntil; }
  const p = s.events.pending;
  if (p && s.time.t - p.t > DAY) { const def = game.data.events.find(e => e.id === p.id); const opt = def.options[def.options.length - 1]; game.log(`No decision was made on "${def.title}"; the default action was taken.`, 'warn'); resolveEvent(game, opt.id, true); }
  // Transient opportunities that were not answered in time are logged as missed.
  for (const r of s.events.records) if (r.transient && r.status === 'active' && s.time.t >= r.expiresAt) { r.status = 'missed'; r.resolution = 'The observing window closed before a response.'; game.log(`Missed: ${r.title}.`, 'info'); }
  completeResponses(game);
  if (day > s.time.lastDay) {
    s.time.lastDay = day; s.stats.daysElapsed = day;
    if (!s.events.pending && day >= 3 && game.rand() < 0.16) triggerEvent(game);
    if (day >= 2 && activeTransients(game).length < 3 && game.rand() < 0.25) spawnTransient(game);
  }
}

export function triggerEvent(game, id = null) {
  const s = game.state;
  const def = id ? game.data.events.find(e => e.id === id) : weightedPick(() => game.rand(), game.data.events, e => e.weight);
  if (!def) return null;
  const r = newRecord(game, def, { type: def.title });
  s.events.pending = { id: def.id, t: s.time.t, recordId: r.id };
  game.log(`EVENT: ${def.title}. A decision is needed.`, 'warn');
  if (def.id === 'solar-particle-event') { s.events.solarFactor = 0.9; s.events.solarUntil = s.time.t + 12 * HOUR; r.consequences.push('Solar output reduced for about 12 hours.'); }
  game.addMessage({ from: 'Meridian Station Operations', subject: def.title, body: def.text, type: 'info', fictional: false });
  if (game.prefs.autoPauseOnEvent) game.pause();
  return def;
}

export function resolveEvent(game, optionId, auto = false) {
  const s = game.state; const p = s.events.pending;
  if (!p) return { ok: false, error: 'No event is waiting for a decision.' };
  const def = game.data.events.find(e => e.id === p.id); const opt = def.options.find(o => o.id === optionId);
  if (!opt) return { ok: false, error: 'Unknown option.' };
  for (const e of opt.effects) applyEffect(game, e);
  s.events.history.unshift({ id: def.id, title: def.title, t: p.t, resolvedAt: s.time.t, choice: opt.label, auto });
  if (s.events.history.length > 40) s.events.history.length = 40;
  const r = s.events.records.find(x => x.id === p.recordId);
  if (r) { r.status = 'resolved'; r.resolvedAt = s.time.t; r.resolution = `${opt.label}${auto ? ' (default action)' : ''}`; for (const e of opt.effects) if (EFFECT_TEXT[e.type]) r.consequences.push(EFFECT_TEXT[e.type](e)); }
  record(game, { kind: 'event', title: def.title, text: `Decision: ${opt.label}${auto ? ' (default action)' : ''}`, ref: p.recordId });
  s.events.pending = null;
  return { ok: true };
}

function applyEffect(game, e) {
  const s = game.state;
  switch (e.type) {
    case 'credits': addCredits(game, e.value, 'Event cost', e.value >= 0 ? 'income' : 'expense'); break;
    case 'morale': for (const c of s.crew) c.morale = clamp(c.morale + e.value, 0, 100); break;
    case 'crewHealthAll': for (const c of s.crew) c.health = clamp(c.health + e.value, 5, 100); break;
    case 'crewHealthOne': { const c = s.crew[Math.floor(game.rand() * s.crew.length)]; c.health = clamp(c.health + e.value, 5, 100); game.log(`${c.name} is unwell (health ${Math.round(c.health)}%).`, 'warn'); break; }
    case 'systemCondition': s.station.systems[e.system].condition = clamp(s.station.systems[e.system].condition + e.value, 0, 100); break;
    case 'instrumentCondition': { for (const i of s.instruments) i.condition = clamp(i.condition + e.value, 0, 100); break; }
    case 'pauseObservations': s.events.pauseObsUntil = s.time.t + e.hours * HOUR; interruptObservations(game, 'event'); break;
    case 'log': game.log(e.text, 'info'); break;
    default: break;
  }
}

// ---- transient science events ----
export function spawnTransient(game, defId = null) {
  const s = game.state; const def = defId ? game.data.transients.find(x => x.id === defId) : weightedPick(() => game.rand(), game.data.transients, x => x.weight);
  if (!def) return null;
  const hasInst = s.instruments.some(i => i.kind === def.kind);
  const r = newRecord(game, def, { transient: true, kind: def.kind, expiresAt: s.time.t + def.windowHours * HOUR, respondable: hasInst });
  if (def.solarFactor && (s.events.solarFactor ?? 1) > def.solarFactor) { s.events.solarFactor = def.solarFactor; s.events.solarUntil = s.time.t + 8 * HOUR; r.consequences.push(`Solar output reduced to ${Math.round(def.solarFactor * 100)}% for about 8 hours.`); }
  if (!hasInst) { r.status = 'logged'; r.resolution = `Alert logged. Meridian Station has no ${def.kind} instrument, so no response was possible.`; r.consequences.push('No scientific return.'); }
  game.log(`${def.type} (simulated): ${def.title}.`, hasInst ? 'info' : 'info');
  game.addMessage({ from: 'Transient Alert Network (simulated)', subject: def.title, body: def.text + (hasInst ? ` Respond from Cosmic Events within ${def.windowHours} hours.` : ''), type: 'info', fictional: true });
  return r;
}
export const RESPONSE_HOURS = 4;
export function canRespond(game, recordId, instrumentId) {
  const s = game.state; const r = s.events.records.find(x => x.id === recordId); const inst = s.instruments.find(i => i.id === instrumentId);
  if (!r || !r.transient || r.status !== 'active') return { ok: false, error: 'This event is no longer open.' };
  if (!inst) return { ok: false, error: 'Choose an instrument.' };
  if (inst.kind !== r.kind) return { ok: false, error: `This event needs a ${r.kind} instrument.` };
  if (game.isInstrumentBusy(inst)) return { ok: false, error: `${inst.name} is busy.` };
  if (s.events.pauseObsUntil > s.time.t) return { ok: false, error: 'Observations are currently suspended.' };
  if (workRates(game).operations <= 0) return { ok: false, error: 'Assign a healthy crew member to Observatory operations.' };
  const cost = Math.round(inst.operatingCostPerHour * RESPONSE_HOURS);
  if (s.resources.credits < cost) return { ok: false, error: `Needs ${cost} RC.` };
  return { ok: true, cost, inst, r };
}
export function respondToTransient(game, recordId, instrumentId) {
  const c = canRespond(game, recordId, instrumentId); if (!c.ok) return c; const s = game.state;
  addCredits(game, -c.cost, `Event response: ${c.r.title}`, 'expense');
  s.events.responses.push({ recordId, instrumentId, doneAt: s.time.t + RESPONSE_HOURS * HOUR });
  c.r.status = 'responding'; game.log(`${c.inst.name} is responding to ${c.r.title} (${RESPONSE_HOURS} h).`, 'info');
  return { ok: true };
}
function completeResponses(game) {
  const s = game.state; const due = s.events.responses.filter(x => x.doneAt <= s.time.t); if (!due.length) return;
  s.events.responses = s.events.responses.filter(x => x.doneAt > s.time.t);
  for (const x of due) {
    const r = s.events.records.find(e => e.id === x.recordId); const inst = s.instruments.find(i => i.id === x.instrumentId); const def = game.data.transients.find(d => d.id === r.defId);
    const q = clamp(instrumentAccuracy(game, inst) * (0.6 + 0.4 * inst.condition / 100) * (0.85 + 0.03 * (workRates(game).bestOperator || 3)) / 0.75 + (game.rand() - 0.5) * 0.2, 0, 0.97);
    if (q < 0.45) { r.status = 'missed'; r.resolution = `Response data quality was too low (${Math.round(q * 100)}%).`; r.consequences.push('No scientific return.'); game.log(`Response to ${r.title} failed: data quality ${Math.round(q * 100)}%.`, 'warn'); continue; }
    const rp = Math.round(def.rp * (0.5 + q)); s.resources.researchPoints += rp; s.resources.reputation += def.rep;
    r.status = 'observed'; r.resolvedAt = s.time.t; r.resolution = `Observed with ${inst.name}; data quality ${Math.round(q * 100)}%.`; r.consequences.push(`+${rp} research points`, `+${def.rep} reputation`);
    const confidence = Math.round(100 * (0.4 + 0.6 * q)); const d = { id: `disc-${s.uid++}`, t: s.time.t, targetId: null, category: 'Simulated Event', type: def.type, title: `${def.type} response (simulated)`, instrumentId: inst.id, evidence: [r.id], quality: q, hours: RESPONSE_HOURS, confidence, confidenceLabel: confidence >= 75 ? 'High' : confidence >= 55 ? 'Moderate' : 'Low', rp, sentToEarth: false, verification: null, summary: `${def.title}: a simulated event. ${RESPONSE_HOURS} h ${inst.kind} response, data quality ${Math.round(q * 100)}%. This record describes game-world data and is not a real astronomical measurement.` };
    s.discoveries.unshift(d); r.discoveryId = d.id; game.log(`Response complete: ${r.title} (+${rp} RP).`, 'good');
    record(game, { kind: 'event', title: `${def.type} observed (simulated)`, text: r.resolution, ref: r.id });
  }
}
