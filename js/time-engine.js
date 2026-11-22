// Game clock helpers and the real-time loop. The loop converts real elapsed time into fixed simulation steps.
import { EPOCH_MS, DAY, TICK, SPEEDS } from './constants.js';

export const toDate = t => new Date(EPOCH_MS + t * 1000);
export function formatDate(t) {
  const d = toDate(t);
  return d.toISOString().slice(0, 10);
}
export function formatClock(t) { return toDate(t).toISOString().slice(11, 16) + ' UTC'; }
export function formatDateTime(t) { return `${formatDate(t)} ${formatClock(t)}`; }
export const dayNumber = t => Math.floor(t / DAY) + 1;
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / DAY), h = Math.floor((s % DAY) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}
export const daysUntil = (t, target) => (target - t) / DAY;

// Real-time driver: call `frame(realSeconds)` repeatedly. Excess real time is capped so a background tab cannot run away.
export class Clock {
  constructor(game, { maxStepsPerFrame = 2000 } = {}) { this.game = game; this.carry = 0; this.maxSteps = maxStepsPerFrame; this.timer = null; this.last = 0; }
  frame(realSeconds) {
    const { time } = this.game.state;
    if (time.paused || time.speed === 0) return 0;
    const rate = SPEEDS[time.speed].gameSecondsPerSecond;
    this.carry += Math.min(realSeconds, 1) * rate;
    let steps = Math.min(Math.floor(this.carry / TICK), this.maxSteps);
    this.carry -= steps * TICK; if (this.carry > TICK * 4) this.carry = 0;
    for (let i = 0; i < steps; i++) { this.game.step(TICK); if (this.game.state.time.paused) break; }
    return steps;
  }
  start() {
    if (this.timer) return;
    this.last = performance.now();
    this.timer = setInterval(() => { const now = performance.now(); this.frame((now - this.last) / 1000); this.last = now; this.game.emit('frame'); }, 250);
  }
  stop() { clearInterval(this.timer); this.timer = null; }
}
