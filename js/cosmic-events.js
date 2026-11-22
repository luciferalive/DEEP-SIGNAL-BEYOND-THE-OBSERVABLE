// Cosmic and station events: random occurrences that need a decision from the player.
import { DAY, HOUR } from './constants.js';
import { weightedPick } from './rng.js';
import { interruptObservations } from './observatory.js';
import { addCredits } from './finance.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function eventsTick(game) {
  const s = game.state; const day = Math.floor(s.time.t / DAY);
  if (s.events.solarFactor !== undefined && s.events.solarUntil && s.time.t >= s.events.solarUntil) { delete s.events.solarFactor; delete s.events.solarUntil; }
  // Pending events that wait too long are resolved by default (the last option).
  const p = s.events.pending;
  if (p && s.time.t - p.t > DAY) { const def = game.data.events.find(e => e.id === p.id); const opt = def.options[def.options.length - 1]; game.log(`No decision was made on "${def.title}"; the default action was taken.`, 'warn'); resolveEvent(game, opt.id, true); }
  if (day > s.time.lastDay) {
    s.time.lastDay = day; s.stats.daysElapsed = day;
    if (!s.events.pending && day >= 3 && game.rand() < 0.16) triggerEvent(game);
  }
}

export function triggerEvent(game, id = null) {
  const s = game.state;
  const def = id ? game.data.events.find(e => e.id === id) : weightedPick(() => game.rand(), game.data.events, e => e.weight);
  if (!def) return null;
  s.events.pending = { id: def.id, t: s.time.t };
  game.log(`EVENT: ${def.title}. A decision is needed.`, 'warn');
  if (def.id === 'solar-particle-event') { s.events.solarFactor = 0.9; s.events.solarUntil = s.time.t + 12 * HOUR; }
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
