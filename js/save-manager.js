// Persistent saves. IndexedDB holds game saves; LocalStorage holds lightweight preferences.
// Storage is injected so tests can use an in-memory backend.
import { SAVE_VERSION, GAME_VERSION } from './constants.js';
import { validateState, migrate } from './game-state.js';

export class MemoryBackend {
  constructor() { this.map = new Map(); }
  async list() { return [...this.map.values()].map(({ slot, meta }) => ({ slot, meta })); }
  async get(slot) { return this.map.get(slot)?.payload ?? null; }
  async put(slot, payload, meta) { this.map.set(slot, { slot, payload: JSON.parse(JSON.stringify(payload)), meta }); }
  async delete(slot) { this.map.delete(slot); }
}

export class IndexedDbBackend {
  constructor(name = 'deep-signal') { this.name = name; this.dbp = null; }
  open() {
    if (!this.dbp) this.dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('saves', { keyPath: 'slot' });
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    return this.dbp;
  }
  async tx(mode, fn) { const db = await this.open(); return new Promise((resolve, reject) => { const t = db.transaction('saves', mode); const r = fn(t.objectStore('saves')); t.oncomplete = () => resolve(r && r.result); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); }); }
  async list() { const all = await this.tx('readonly', s => s.getAll()); return (all || []).map(({ slot, meta }) => ({ slot, meta })); }
  async get(slot) { const row = await this.tx('readonly', s => s.get(slot)); return row ? row.payload : null; }
  async put(slot, payload, meta) { await this.tx('readwrite', s => s.put({ slot, payload, meta })); }
  async delete(slot) { await this.tx('readwrite', s => s.delete(slot)); }
}

export const SLOTS = ['autosave', 'manual-1', 'manual-2', 'manual-3'];
const metaOf = (state, label) => ({ savedAt: Date.now(), gameTime: state.time.t, version: state.version, gameVersion: GAME_VERSION, label, station: state.station.name, credits: Math.round(state.resources.credits), crew: state.crew.length, discoveries: state.discoveries.length, missions: state.missions.completed.length });

export class SaveManager {
  constructor(backend) { this.backend = backend; }
  list() { return this.backend.list(); }
  async exists(slot) { return (await this.backend.get(slot)) != null; }
  async save(game, slot, { overwrite = false } = {}) {
    if (slot !== 'autosave' && !overwrite && await this.exists(slot)) return { ok: false, needsConfirm: true };
    await this.backend.put(slot, game.state, metaOf(game.state, slot));
    return { ok: true };
  }
  async load(slot) {
    const raw = await this.backend.get(slot); if (!raw) return { ok: false, error: 'That slot is empty.' };
    // Never migrate in place without a safety copy: keep the original under backup-<slot>-v<version>.
    if (typeof raw.version === 'number' && raw.version < SAVE_VERSION && !slot.startsWith('backup-')) {
      const bslot = `backup-${slot}-v${raw.version}`;
      if (!(await this.exists(bslot))) await this.backend.put(bslot, raw, { ...metaOf(raw, bslot), backupOf: slot });
    }
    return this.prepare(raw);
  }
  prepare(raw) {
    const problems = validateState(raw); if (problems.length) return { ok: false, error: problems.join(' ') };
    try { return { ok: true, state: migrate(JSON.parse(JSON.stringify(raw))) }; } catch (e) { return { ok: false, error: `Could not migrate this save: ${e.message}` }; }
  }
  // Recovery: the newest save that still validates and migrates (used when the chosen save is damaged).
  async recover() {
    const rows = (await this.list()).filter(r => r.meta).sort((a, b) => b.meta.savedAt - a.meta.savedAt);
    for (const r of rows) { const raw = await this.backend.get(r.slot); const res = raw ? this.prepare(raw) : null; if (res?.ok) return { ok: true, slot: r.slot, state: res.state }; }
    return { ok: false, error: 'No readable save was found.' };
  }
  remove(slot) { return this.backend.delete(slot); }
  exportJson(game) { return JSON.stringify({ format: 'deep-signal-save', saveVersion: SAVE_VERSION, gameVersion: GAME_VERSION, exportedAt: new Date().toISOString(), state: game.state }, null, 1); }
  parseImport(text) {
    let parsed; try { parsed = JSON.parse(text); } catch { return { ok: false, error: 'That file is not valid JSON.' }; }
    if (parsed?.format !== 'deep-signal-save' || !parsed.state) return { ok: false, error: 'That file is not a DEEP SIGNAL save.' };
    return this.prepare(parsed.state);
  }
  async importToSlot(state, slot, { overwrite = false } = {}) {
    if (!overwrite && await this.exists(slot)) return { ok: false, needsConfirm: true };
    await this.backend.put(slot, state, metaOf(state, slot)); return { ok: true };
  }
}

export const prefsStore = {
  load() { try { return JSON.parse(localStorage.getItem('deep-signal-prefs') || '{}'); } catch { return {}; } },
  save(prefs) { try { localStorage.setItem('deep-signal-prefs', JSON.stringify(prefs)); } catch { /* storage may be unavailable */ } }
};
