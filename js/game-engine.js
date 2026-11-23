// The Game object ties the state, the data and every system together and advances the simulation in fixed steps.
import { DAY, HOUR, TICK, SPEEDS } from './constants.js';
import { nextRandom } from './rng.js';
import { createNewGame, migrate, validateState } from './game-state.js';
import { stationTick } from './station.js';
import { crewTick } from './crew-management.js';
import { observatoryTick, isInstrumentBusy } from './observatory.js';
import { researchTick } from './research-engine.js';
import { missionControlTick, addMessage, offerMission } from './mission-control.js';
import { eventsTick } from './cosmic-events.js';
import { shipTick } from './spacecraft.js';
import { dailyFinance } from './finance.js';
import { formatDateTime } from './time-engine.js';
import { moduleEffect, initialModules, modulesTick } from './station-modules.js';
import { publicationsTick } from './publications.js';
import { runDue } from './scheduler.js';
import { expeditionsTick } from './expeditions.js';
import { record, backfill } from './chronicle.js';

const DEFAULT_PREFS = { autoPauseOnEvent: true, autosaveSeconds: 60, uiScale: 1 };

export class Game {
  constructor(data, state, prefs = {}) {
    this.data = data; this.state = state; this.prefs = { ...DEFAULT_PREFS, ...prefs };
    this.listeners = new Set(); this.lastHistory = -1;
    for (const [id, m] of Object.entries(initialModules(data))) if (!this.state.modules[id]) this.state.modules[id] = m;
    for (const inst of this.state.instruments) if (!inst.name) Object.assign(inst, data.instruments.active.find(i => i.id === inst.id));
  }
  static create(data, { seed, prefs } = {}) {
    const state = createNewGame(seed);
    state.instruments = data.instruments.active.filter(i => i.owned).map(i => ({ ...JSON.parse(JSON.stringify(i)), condition: 100 }));
    const g = new Game(data, state, prefs);
    g.state.flags.chronicleBackfilled = true; g.state.comms.history.push({ t: 0, from: 'Earth', to: 'Station', kind: 'directive', text: 'Programme established.', delayMin: 0 });
    record(g, { kind: 'station', title: 'Meridian Station established', text: 'The programme begins at Sun–Earth L2 (simulated setting).', major: true });
    g.log('Meridian Station is operational. Simulation paused. Press Play to begin.', 'info');
    g.addMessage({ from: 'Earth Mission Control', subject: 'Welcome to Meridian Station', body: 'Commander, the programme is yours. Keep your crew healthy, your systems powered and your instruments pointed at the sky. Your first assignment follows. (Simulated future communication.)', type: 'info' });
    offerMission(g, 'm01');
    return g;
  }
  static fromSave(data, saved, prefs) {
    const problems = validateState(saved); if (problems.length) throw new Error(problems.join(' '));
    const state = migrate(JSON.parse(JSON.stringify(saved)));
    state.time.paused = true; state.time.speed = 0;
    const g = new Game(data, state, prefs);
    backfill(g);
    g.log('Game loaded. Simulation paused.', 'info');
    return g;
  }
  rand() { return nextRandom(this.state); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type = 'change') { for (const fn of this.listeners) fn(type); }
  addMessage(msg) { return addMessage(this, msg); }
  log(text, level = 'info') {
    const s = this.state; s.log.unshift({ t: s.time.t, text, level });
    if (s.log.length > 250) s.log.length = 250;
  }
  isInstrumentBusy(inst) { return isInstrumentBusy(this, inst); }
  moduleEffect(key) { return moduleEffect(this, key); }
  unlocked(key) { for (const id of Object.keys(this.state.tech.researched)) for (const e of this.data.techById[id]?.effects || []) if (e.type === 'unlock' && e.key === key) return true; return false; }
  techEffect(type, kind) {
    let sum = 0;
    for (const id of Object.keys(this.state.tech.researched)) for (const e of this.data.techById[id]?.effects || []) if (e.type === type && (!kind || !e.kind || e.kind === kind)) sum += e.value;
    return sum;
  }
  // Time controls
  setSpeed(index) { const t = this.state.time; t.speed = index; t.paused = index === 0; this.emit('time'); }
  pause() { this.state.time.paused = true; this.emit('time'); }
  play() { const t = this.state.time; if (t.speed === 0) t.speed = 1; t.paused = false; this.emit('time'); }
  togglePause() { this.state.time.paused ? this.play() : this.pause(); }

  step(dt = TICK) {
    const s = this.state; s.time.t += dt; runDue(this);
    stationTick(this, dt); crewTick(this, dt); observatoryTick(this); researchTick(this, dt); shipTick(this, dt); modulesTick(this, dt); publicationsTick(this, dt);
    eventsTick(this); missionControlTick(this); expeditionsTick(this);
    const day = Math.floor(s.time.t / DAY);
    if (s.finance.lastUpkeepDay === undefined) s.finance.lastUpkeepDay = Math.floor((s.time.t - dt) / DAY);
    while (s.finance.lastUpkeepDay < day) { s.finance.lastUpkeepDay += 1; dailyFinance(this); }
    this.sampleHistory();
  }
  sampleHistory() {
    const s = this.state; const hour = Math.floor(s.time.t / HOUR);
    if (hour === this.lastHistory) return; this.lastHistory = hour;
    const push = (k, v) => { const a = s.history[k]; a.push([s.time.t, Math.round(v * 10) / 10]); if (a.length > 240) a.shift(); };
    push('oxygen', s.resources.oxygen); push('water', s.resources.water); push('food', s.resources.food); push('power', s.station.battery); push('credits', s.resources.credits);
  }
  advance(seconds) { for (let t = 0; t < seconds; t += TICK) { this.step(TICK); } }
  clockLabel() { return formatDateTime(this.state.time.t); }
}
export { SPEEDS };
