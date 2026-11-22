// UI manager: navigation, rendering, event delegation, saves, modals and toasts.
import { esc, btn } from './ui-components.js';
import { SPEEDS, GAME_NAME, GAME_VERSION, DAY } from './constants.js';
import { formatDate, formatClock } from './time-engine.js';
import { Game } from './game-engine.js';
import { SLOTS, prefsStore } from './save-manager.js';
import { setAssignment } from './crew-management.js';
import { serviceSystem } from './station.js';
import { startObservation, serviceInstrument } from './observatory.js';
import { startAnalysis, startTech } from './research-engine.js';
import { acceptMission, declineMission, submitReport, createSurvey, requestSupplies, sendDiscovery, requestVerification, respondToFunding } from './mission-control.js';
import { resolveEvent, respondToTransient, activeTransients } from './cosmic-events.js';
import { startUpgrade, serviceModule } from './station-modules.js';
import { startPublication } from './publications.js';
import { setReserve } from './finance.js';
import { refuel, repairSystem } from './spacecraft.js';
import * as V from './views/index.js';

const NAV = [['command', 'Command Centre'], ['explorer', 'Universe Explorer'], ['observatory', 'Observatory'], ['lab', 'Research Laboratory'], ['spacecraft', 'Spacecraft'], ['missions', 'Mission Control'], ['crew', 'Crew Management'], ['tech', 'Technology Tree'], ['events', 'Cosmic Events'], ['archive', 'Discovery Archive'], ['anomalies', 'Anomaly Investigation'], ['comms', 'Communications'], ['finance', 'Financial Management'], ['station', 'Station Infrastructure'], ['publications', 'Publications'], ['history', 'Civilization History'], ['settings', 'Settings']];
const VIEWS = { command: V.command, explorer: V.explorer, observatory: V.observatory, lab: V.lab, spacecraft: V.spacecraft, missions: V.missions, crew: V.crew, tech: V.tech, events: V.events, archive: V.archive, anomalies: V.anomalies, comms: V.comms, finance: V.finance, station: V.station, publications: V.publications, history: V.history, settings: V.settings };
const $ = s => document.querySelector(s);

export class UI {
  constructor({ data, saves, clock }) {
    this.data = data; this.saves = saves; this.clock = clock; this.game = null; this.view = 'command'; this.saveList = []; this.open = new Set(); this.dirty = true; this.lastRender = 0; this.lastAutosave = 0; this.unsub = null; this.modalOpen = false;
    this.s = { query: '', group: 'all', bookmarksOnly: false, object: null, mapMode: 'sky', obsTarget: 'proxima-centauri', obsInstrument: 'opt-1', obsHours: 6, missionTab: 'active', archiveQuery: '', archiveType: 'all', sendDisc: '', verDisc: '', reportSel: '', pubSel: '', histQuery: '', histKind: 'all', histMajor: false, respInst: {} };
    this.prefs = { autoPauseOnEvent: true, autosaveSeconds: 60, uiScale: 1, ...prefsStore.load() };
  }
  isOpen(k) { return this.open.has(k); }
  async init() {
    this.applyScale(); this.bind(); await this.refreshSaves(); this.showTitle();
    setInterval(() => this.tick(), 250);
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (this.game && VIEWS[h] && h !== this.view) this.goto(h); });
  }
  applyScale() { document.documentElement.style.setProperty('--scale', this.prefs.uiScale); }
  async refreshSaves() { try { this.saveList = await this.saves.list(); } catch { this.saveList = []; } }
  // ---------- game lifecycle ----------
  attach(game) {
    this.unsub?.(); if (this.clock.game) this.clock.stop(); game.prefs = Object.assign(game.prefs, this.prefs);
    this.game = game; this.clock.game = game; this.clock.carry = 0; this.unsub = game.on(t => { if (t === 'time' || t === 'change') this.dirty = true; if (t === 'frame' && !game.state.time.paused) this.dirty = true; });
    this.lastAutosave = performance.now(); this.hideOverlay(); this.clock.start(); this.shell(); this.goto(VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'command');
  }
  newGame() { this.attach(Game.create(this.data, { prefs: this.prefs })); this.toast('New game started. The simulation is paused. Press Play.', 'good'); }
  // ---------- shell ----------
  shell() {
    $('#nav').innerHTML = NAV.map(([id, name], i) => `<button class="nav-item" data-act="goto" data-id="${id}"><i>${String(i + 1).padStart(2, '0')}</i><span>${name}</span><span class="pip" hidden></span></button>`).join('');
    $('#topbar').innerHTML = `<button class="btn small menu-btn" data-act="menu" aria-label="Open navigation menu">☰ Menu</button><div class="brand"><b>DEEP SIGNAL</b><span>Beyond the observable</span></div>
      <div class="top-clock"><span id="clk-date"></span><small id="clk-time"></small></div>
      <div class="speed" role="group" aria-label="Simulation speed">${SPEEDS.map((sp, i) => `<button data-act="speed" data-id="${i}" aria-label="${sp.label}" title="${sp.label}">${i === 0 ? '❚❚' : sp.label}</button>`).join('')}</div>
      <div class="row" style="margin-left:auto"><span id="top-res" class="mono faint" style="font-size:.74rem"></span><button class="btn small" data-act="quick-save">Quick save</button><button class="btn small" data-act="title">Title</button></div>`;
  }
  goto(id) {
    if (!VIEWS[id]) return; this.view = id; document.body.classList.remove('nav-open'); history.replaceState(null, '', '#' + id);
    this.dirty = true; this.render(true); $('#view').scrollTo?.(0, 0); window.scrollTo(0, 0);
  }
  // ---------- rendering ----------
  tick() {
    if (!this.game) return; const g = this.game;
    if (!this.modalOpen && !g.state.time.paused && this.prefs.autosaveSeconds > 0 && performance.now() - this.lastAutosave > this.prefs.autosaveSeconds * 1000) this.autosave();
    this.topbar(); this.watchAlerts();
    if (this.dirty && performance.now() - this.lastRender > 240) this.render();
  }
  async autosave() { this.lastAutosave = performance.now(); try { await this.saves.save(this.game, 'autosave'); await this.refreshSaves(); } catch (e) { this.toast('Autosave failed: ' + e.message, 'bad'); } }
  topbar() {
    const g = this.game, s = g.state; const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };
    set('clk-date', formatDate(s.time.t)); set('clk-time', formatClock(s.time.t) + (s.time.paused ? ' · PAUSED' : ''));
    set('top-res', `${Math.round(s.resources.credits).toLocaleString('en-US')} RC`);
    document.querySelectorAll('.speed button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.id === (s.time.paused ? 0 : s.time.speed))));
    const unread = s.messages.filter(m => !m.read).length, offers = s.missions.offered.length, an = s.anomalies.filter(a => a.status === 'unresolved').length, ev = (s.events.pending ? 1 : 0) + activeTransients(this.game).filter(r => r.respondable).length;
    const pips = { comms: [unread, false], missions: [offers, false], anomalies: [an, false], events: [ev, !!s.events.pending] };
    document.querySelectorAll('.nav-item').forEach(n => { const id = n.dataset.id; n.setAttribute('aria-current', id === this.view ? 'page' : 'false'); const p = n.querySelector('.pip'); const v = pips[id]; if (v && v[0]) { p.hidden = false; p.textContent = v[0]; p.classList.toggle('warn', v[1]); } else p.hidden = true; });
  }
  watchAlerts() { const p = this.game.state.events.pending; const id = p ? p.id + p.t : null; if (id && id !== this.alerted) { this.alerted = id; this.toast('A cosmic event needs your decision. See Cosmic Events.', 'warn'); } if (!id) this.alerted = null; }
  render(force = false) {
    if (!this.game) return; if (!force && this.modalOpen) return;
    const root = $('#view'); const a = document.activeElement; const typing = a && root.contains(a) && (a.tagName === 'INPUT' && a.type !== 'checkbox' || a.tagName === 'TEXTAREA');
    if (typing && !force) { this.lastRender = performance.now(); return; }
    // remember focus, caret, scroll and details state
    const focus = a && root.contains(a) && a.id ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null; const sy = window.scrollY;
    root.querySelectorAll('details[data-key]').forEach(d => d.open ? this.open.add(d.dataset.key) : this.open.delete(d.dataset.key));
    const v = VIEWS[this.view]; let html; try { html = v.render(this); } catch (e) { console.error(e); html = `<div class="panel"><h3>Display error</h3><p class="muted">This section failed to draw: ${esc(e.message)}. Your game is unaffected.</p></div>`; }
    const pending = this.view !== 'events' && this.game.state.events.pending ? V.events.eventBanner(this) : '';
    root.innerHTML = pending + html; document.title = `${v.title} · ${GAME_NAME}`;
    if (focus) { const el = document.getElementById(focus.id); if (el) { el.focus({ preventScroll: true }); try { if (focus.s != null) el.setSelectionRange(focus.s, focus.e); } catch { /* not a text field */ } } }
    window.scrollTo(0, sy); this.dirty = false; this.lastRender = performance.now();
  }
  // ---------- overlay / toasts ----------
  toast(text, kind = 'info') { const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = text; $('#toasts').append(el); setTimeout(() => el.remove(), 5200); }
  hideOverlay() { const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; this.modalOpen = false; }
  modal(html) { const o = $('#overlay'); o.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`; o.hidden = false; this.modalOpen = true; o.querySelector('button')?.focus(); }
  confirm(title, text, okLabel = 'Confirm', danger = false) {
    return new Promise(res => { const was = this.modalOpen; this.modal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="actions"><button class="btn" data-modal="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-modal="yes">${esc(okLabel)}</button></div>`);
      const o = $('#overlay'); const done = v => { o.removeEventListener('click', h); document.removeEventListener('keydown', k); if (!was) this.hideOverlay(); res(v); };
      const h = e => { const m = e.target.closest('[data-modal]'); if (m) done(m.dataset.modal === 'yes'); }; const k = e => { if (e.key === 'Escape') done(false); };
      o.addEventListener('click', h); document.addEventListener('keydown', k); }); }
  showTitle() {
    this.clock.stop(); const latest = [...this.saveList].filter(x => x.meta && !x.slot.startsWith('backup-')).sort((a, b) => b.meta.savedAt - a.meta.savedAt)[0];
    this.modal(`<h2 style="letter-spacing:.14em">DEEP SIGNAL</h2><div class="kicker" style="margin-bottom:1rem">BEYOND THE OBSERVABLE · v${GAME_VERSION}</div>
      <p class="muted">The year is 2189. You command Meridian Station, a deep-space observatory beyond Earth's orbit. Observe real objects, analyse your data and decide what counts as a discovery.</p>
      <p class="faint" style="font-size:.78rem">Real astronomical data and fictional content are always labelled separately. Missing values read DATA UNKNOWN.</p>
      <div class="stack" style="margin-top:1rem">${latest ? btn(`Continue (${SLOTS.includes(latest.slot) ? latest.slot : latest.slot}, game date ${new Date(Date.UTC(2189, 0, 1) + latest.meta.gameTime * 1000).toISOString().slice(0, 10)})`, 'title-continue', { id: latest.slot, cls: 'primary' }) : ''}${btn('New game', 'title-new', { cls: latest ? '' : 'primary' })}<label class="btn" style="cursor:pointer;text-align:center">Import save file…<input type="file" accept=".json,application/json" data-act="import-file" hidden></label></div>
      ${this.game ? `<div class="actions"><button class="btn" data-act="title-close">Back to game</button></div>` : ''}`);
  }
  // ---------- save helpers ----------
  async loadState(state, label) { await this.refreshSaves(); try { this.attach(Game.fromSave(this.data, state, this.prefs)); this.toast(`${label} loaded. The simulation is paused.`, 'good'); } catch (e) { this.toast('Load failed: ' + e.message, 'bad'); } }
  async saveSlot(slot) {
    let r = await this.saves.save(this.game, slot);
    if (r.needsConfirm) { if (!await this.confirm('Overwrite this save?', `Slot "${slot}" already holds a game. Saving replaces it permanently.`, 'Overwrite', true)) return; r = await this.saves.save(this.game, slot, { overwrite: true }); }
    await this.refreshSaves(); this.toast(r.ok ? 'Game saved.' : 'Save failed.', r.ok ? 'good' : 'bad'); this.dirty = true;
  }
  download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  async importFile(file) {
    if (!file) return; const r = this.saves.parseImport(await file.text()); if (!r.ok) return this.toast(r.error, 'bad');
    if (this.game && !await this.confirm('Replace the current game?', 'Importing starts the imported game. Your current game is not saved by this; save it first if you want to keep it.', 'Import', true)) return;
    await this.loadState(r.state, 'Imported save');
  }
  // ---------- actions ----------
  bind() {
    const root = document.body;
    root.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el || el.disabled || el.tagName === 'SELECT' || el.tagName === 'OPTION') return; if (el.tagName === 'INPUT' && el.type === 'file') return; if (el.tagName === 'INPUT' && el.type === 'checkbox') return; this.act(el.dataset.act, el); });
    root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-act]')) { e.preventDefault(); this.act(e.target.dataset.act, e.target); } });
    root.addEventListener('change', e => { const el = e.target; if (el.matches('select[data-act], input[type=checkbox][data-act], input[type=file][data-act]')) this.act(el.dataset.act, el); });
    root.addEventListener('input', e => { const el = e.target; if (el.dataset?.input === 'explorer-query') { this.s.query = el.value; this.liveSearch(); } if (el.dataset?.input === 'history-query') { this.s.histQuery = el.value; this.liveSearch(); } if (el.dataset?.input === 'archive-query') { this.s.archiveQuery = el.value; this.liveSearch(); } });
    root.addEventListener('mouseover', e => this.tip(e)); root.addEventListener('mousemove', e => this.tip(e)); root.addEventListener('mouseleave', () => { $('#tooltip').hidden = true; });
  }
  liveSearch() { clearTimeout(this.st); this.st = setTimeout(() => { this.render(true); }, 180); }
  tip(e) {
    const t = $('#tooltip'); const c = e.target.closest?.('.chart'); if (!c || !c.dataset.pts) { t.hidden = true; return; }
    const r = c.getBoundingClientRect(); const pts = JSON.parse(c.dataset.pts); const i = Math.max(0, Math.min(pts.length - 1, Math.round((e.clientX - r.left) / r.width * (pts.length - 1)))); const p = pts[i];
    t.innerHTML = `<b>${esc(p[2] ?? p[1])}</b>${p[3] ? ' ' + esc(p[3]) : ''}<br><span class="faint">${esc(p[0])}</span>`; t.hidden = false; t.style.left = Math.min(innerWidth - 180, e.clientX + 12) + 'px'; t.style.top = e.clientY + 14 + 'px';
  }
  res(r, ok = '') { if (r && r.ok === false) this.toast(r.error || 'That did not work.', 'bad'); else if (ok) this.toast(ok, 'good'); this.dirty = true; this.render(true); return r; }
  async act(a, el) {
    const g = this.game; const id = el.dataset.id, v = el.dataset.val; const s = this.s;
    if (a === 'title-new') { if (this.game && !await this.confirm('Start a new game?', 'Your current progress is not saved by this. Save it first if you want to keep it.', 'New game', true)) return; return this.newGame(); }
    if (a === 'title-continue') { const r = await this.saves.load(id); if (r.ok) return this.loadState(r.state, 'Save'); this.toast(r.error + ' Looking for another save…', 'warn'); const rec = await this.saves.recover(); return rec.ok ? this.loadState(rec.state, `Recovered save (${rec.slot})`) : this.toast(rec.error, 'bad'); }
    if (a === 'title-close') return this.hideOverlay();
    if (a === 'import-file') { const f = el.files[0]; el.value = ''; return this.importFile(f); }
    if (!g) return;
    switch (a) {
      case 'goto': return this.goto(id);
      case 'menu': return document.body.classList.toggle('nav-open');
      case 'speed': g.setSpeed(+id); return this.render(true);
      case 'title': await this.refreshSaves(); return this.showTitle();
      case 'quick-save': return this.saveSlot('manual-1');
      // explorer
      case 'select-object': s.object = id; return this.render(true);
      case 'select-and-go': s.object = id; return this.goto('explorer');
      case 'map-mode': s.mapMode = id; return this.render(true);
      case 'explorer-group': s.group = el.value; return this.render(true);
      case 'explorer-bm': s.bookmarksOnly = el.checked; return this.render(true);
      case 'bookmark': { const b = g.state.bookmarks, i = b.indexOf(id); i < 0 ? b.push(id) : b.splice(i, 1); return this.render(true); }
      case 'track': { const b = g.state.tracked, i = b.indexOf(id); i < 0 ? b.push(id) : b.splice(i, 1); return this.render(true); }
      case 'target-observe': s.obsTarget = id; s.obsInstrument = v || s.obsInstrument; return this.goto('observatory');
      case 'survey': return this.res(createSurvey(g, id, v), 'Survey mission created. See Mission Control.');
      // observatory
      case 'obs-set': s.obsInstrument = $('#obs-instrument')?.value || s.obsInstrument; s.obsHours = +($('#obs-hours')?.value || s.obsHours); s.obsTarget = $('#obs-target')?.value || s.obsTarget; return this.render(true);
      case 'obs-start': return this.res(startObservation(g, { instrumentId: s.obsInstrument, targetId: s.obsTarget, hours: s.obsHours }), 'Observation started.');
      case 'service-instrument': return this.res(serviceInstrument(g, id), 'Instrument serviced.');
      case 'reobserve': { const an = g.state.anomalies.find(x => x.id === id); return this.res(startObservation(g, { instrumentId: an.instrumentId, targetId: an.targetId, hours: +v, anomalyId: id }), 'Re-observation started.'); }
      // lab / tech
      case 'analyse': return this.res(startAnalysis(g, id), 'Analysis started.');
      case 'tech-start': return this.res(startTech(g, id), 'Research started.');
      // spacecraft / crew
      case 'refuel': return this.res(refuel(g, id, +v), 'Refuelled.');
      case 'repair-ship': return this.res(repairSystem(g, id, v), 'Repair complete.');
      case 'assign': return this.res(setAssignment(g, id, el.value));
      case 'service-system': return this.res(serviceSystem(g, id), 'System serviced.');
      // missions & comms
      case 'mission-tab': s.missionTab = id; return this.render(true);
      case 'mission-accept': return this.res(acceptMission(g, id), 'Mission accepted.');
      case 'mission-decline': return this.res(declineMission(g, id));
      case 'submit-report': return this.res(submitReport(g, id), 'Report submitted.');
      case 'read': { const m = g.state.messages.find(x => x.id === +id || x.id === id); if (m) m.read = true; return; }
      case 'read-all': g.state.messages.forEach(m => m.read = true); return this.render(true);
      case 'send-selected': return this.res(sendDiscovery(g, $('#send-disc').value), 'Discovery sent to Earth.');
      case 'verify-selected': return this.res(requestVerification(g, $('#ver-disc').value), 'Verification requested.');
      case 'report-selected': return this.res(submitReport(g, $('#report-sel').value), 'Report submitted.');
      case 'send-discovery': return this.res(sendDiscovery(g, id), 'Discovery sent to Earth.');
      case 'request-verification': return this.res(requestVerification(g, id), 'Verification requested.');
      case 'request-supplies': return this.res(requestSupplies(g), 'Supply convoy requested.');
      case 'funding-accept': return this.res(respondToFunding(g, +id || id, true), 'Funding accepted.');
      case 'funding-decline': return this.res(respondToFunding(g, +id || id, false));
      case 'event-choose': return this.res(resolveEvent(g, id));
      // archive
      case 'module-upgrade': return this.res(startUpgrade(g, id), 'Upgrade started.');
      case 'module-service': return this.res(serviceModule(g, id), 'Module serviced.');
      case 'pub-select': s.pubSel = el.value; return this.render(true);
      case 'pub-start': { const [type, ...rest] = id.split('|'); return this.res(startPublication(g, type, rest.join('|')), 'Publication started.'); }
      case 'resp-select': s.respInst[id] = el.value; return this.render(true);
      case 'event-respond': return this.res(respondToTransient(g, id, s.respInst[id] || g.state.instruments.find(i => i.kind === g.state.events.records.find(r => r.id === id)?.kind)?.id), 'Response under way.');
      case 'set-reserve': return this.res(setReserve(g, +$('#reserve-in').value), 'Reserve updated.');
      case 'history-kind': s.histKind = el.value; return this.render(true);
      case 'history-major': s.histMajor = el.checked; return this.render(true);
      case 'archive-type': s.archiveType = el.value; return this.render(true);
      // settings
      case 'pref-autopause': this.setPref('autoPauseOnEvent', el.checked); return;
      case 'pref-autosave': this.setPref('autosaveSeconds', +el.value); return;
      case 'pref-scale': this.setPref('uiScale', +el.value); this.applyScale(); return;
      case 'pref-speed': g.setSpeed(+el.value); return this.render(true);
      case 'save-slot': return this.saveSlot(id);
      case 'load-slot': { if (!await this.confirm('Load this save?', 'The current game is replaced. Unsaved progress is lost.', 'Load', true)) return; const r = await this.saves.load(id); return r.ok ? this.loadState(r.state, 'Save') : this.toast(r.error, 'bad'); }
      case 'delete-slot': { if (!await this.confirm('Delete this save?', 'This cannot be undone.', 'Delete', true)) return; await this.saves.remove(id); await this.refreshSaves(); return this.render(true); }
      case 'export-slot': { const r = await this.saves.load(id); if (!r.ok) return this.toast(r.error, 'bad'); const tmp = { state: r.state }; return this.download(`deep-signal-${id}.json`, this.saves.exportJson(tmp)); }
      case 'export-current': return this.download('deep-signal-current.json', this.saves.exportJson(g));
      case 'new-game': return this.act('title-new', el);
    }
  }
  setPref(k, v) { this.prefs[k] = v; this.game.prefs[k] = v; prefsStore.save(this.prefs); this.dirty = true; }
}
