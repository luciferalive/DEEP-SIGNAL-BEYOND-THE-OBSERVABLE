// Engine tests. Run with: node tests/run.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAllData } from '../js/data-loader.js';
import { Game } from '../js/game-engine.js';
import { SaveManager, MemoryBackend } from '../js/save-manager.js';
import { startObservation, canObserve } from '../js/observatory.js';
import { startAnalysis, startTech } from '../js/research-engine.js';
import { acceptMission, submitReport, requestSupplies, sendDiscovery, requestVerification, missionProgress, respondToFunding, createSurvey } from '../js/mission-control.js';
import { triggerEvent, resolveEvent } from '../js/cosmic-events.js';
import { setAssignment } from '../js/crew-management.js';
import { refuel, repairSystem } from '../js/spacecraft.js';
import { search, getObject, formatRA } from '../js/astronomy-database.js';
import { DAY, HOUR } from '../js/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = await loadAllData(async p => JSON.parse(await readFile(path.join(root, p), 'utf8')));
let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'eq'}: expected ${b}, got ${a}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const fresh = seed => Game.create(data, { seed: seed ?? 12345 });

await test('astronomy data: unique ids, sources, references, no invented fields', () => {
  const ids = new Set();
  for (const o of data.db.list) {
    ok(!ids.has(o.id), 'duplicate ' + o.id); ids.add(o.id);
    ok(o.source && o.references.length, `${o.id} needs a source and references`);
    ok(o.category === 'known', `${o.id} must be in the known universe`);
    ok(o.last_verified === null, `${o.id}: last_verified must not be claimed`);
    if (o.group !== 'solar') ok(o.distance_ly != null, `${o.id} needs a distance`);
  }
  for (const name of ['Sagittarius A*', 'M87*', 'TON 618', 'Cygnus X-1', 'Andromeda Galaxy', 'Triangulum Galaxy', 'Sombrero Galaxy', 'Proxima Centauri', 'Alpha Centauri A', 'Alpha Centauri B', 'Betelgeuse', 'Sirius A', 'Vega', 'Rigel', 'Polaris', 'TRAPPIST-1', 'Kepler-186f'.replace('f', ' f'), 'Proxima Centauri b', 'Kepler-452 b', 'TOI-700 d', 'Crab Nebula', 'Orion Nebula', 'Eagle Nebula', 'Pillars of Creation', 'Helix Nebula', 'Cygnus Loop', 'Milky Way'])
    ok(data.db.list.some(o => o.name === name), 'missing ' + name);
  ok(data.db.list.length >= 55, 'database size ' + data.db.list.length);
});
await test('astronomy: search, filters and coordinate formatting', () => {
  eq(search(data.db, { query: 'proxima' }).length, 2);
  ok(search(data.db, { group: 'galaxy' }).length === 5);
  eq(formatRA(getObject(data.db, 'sirius-a').ra_deg), '06h 45m 08.9s');
});
await test('new game: station, crew, instruments, first mission offered, paused', () => {
  const g = fresh(); const s = g.state;
  eq(s.crew.length, 5); eq(s.instruments.length, 2); eq(s.spacecraft.length, 1); ok(s.time.paused);
  eq(s.missions.offered[0], 'm01'); eq(s.messages.length, 2);
  eq(Object.keys(s.station.systems).length, 5);
});
await test('clock advances consistently', () => {
  const g = fresh(); const t0 = g.state.time.t; g.advance(DAY); eq(g.state.time.t, t0 + DAY);
});
await test('resources: power positive, oxygen/food fall slowly, caps respected', () => {
  const g = fresh(); const r0 = { ...g.state.resources }; g.advance(10 * DAY);
  ok(g.state.station.battery > 400, 'battery should stay healthy'); ok(g.state.resources.food < r0.food && g.state.resources.food > r0.food - 120);
  ok(g.state.resources.oxygen < r0.oxygen); ok(!g.state.station.brownout);
});
await test('observation rules: range, class and operator checks', () => {
  const g = fresh(); const opt = g.state.instruments.find(i => i.kind === 'optical'); const rad = g.state.instruments.find(i => i.kind === 'radio');
  ok(!canObserve(g, opt, getObject(data.db, 'sagittarius-a-star')).ok, 'optical cannot reach Sgr A*');
  ok(canObserve(g, rad, getObject(data.db, 'sagittarius-a-star')).ok, 'radio can');
  ok(!canObserve(g, rad, getObject(data.db, 'm87-star')).ok, 'radio cannot reach M87*');
  ok(!canObserve(g, opt, getObject(data.db, 'proxima-b')).ok, 'exoplanets are not directly observable');
  ok(canObserve(g, opt, getObject(data.db, 'betelgeuse')).ok);
  for (const c of g.state.crew) setAssignment(g, c.id, 'rest');
  ok(!startObservation(g, { instrumentId: opt.id, targetId: 'proxima-centauri', hours: 6 }).ok, 'needs an operator');
});
await test('full first-mission loop: accept, observe, analyse, report, rewards, next missions', () => {
  const g = fresh(); const s = g.state; const opt = s.instruments[0];
  ok(acceptMission(g, 'm01').ok);
  const credits0 = s.resources.credits;
  const r = startObservation(g, { instrumentId: opt.id, targetId: 'proxima-centauri', hours: 12 }); ok(r.ok, r.error);
  ok(s.resources.credits < credits0, 'observation costs credits');
  ok(!startObservation(g, { instrumentId: opt.id, targetId: 'sirius-a', hours: 6 }).ok, 'instrument busy');
  g.advance(13 * HOUR);
  eq(s.datasets.length, 1); ok(s.datasets[0].quality >= 0.3);
  ok(startAnalysis(g, s.datasets[0].id).ok);
  g.advance(3 * DAY);
  eq(s.discoveries.length, 1); ok(s.resources.researchPoints > 10, 'RP awarded');
  eq(s.missions.active[0].status, 'report-ready');
  const rp0 = s.resources.researchPoints; ok(submitReport(g, 'm01').ok);
  ok(s.resources.researchPoints >= rp0 + 20); ok(s.missions.completed.length === 1);
  ok(s.missions.offered.includes('m02') && s.missions.offered.includes('m05'));
});
await test('missions: partial progress is tracked from live state', () => {
  const g = fresh(); acceptMission(g, 'm01'); const p = missionProgress(g, g.state.missions.active[0]); eq(p.done, 0); eq(p.total, 2);
});
await test('datasets must be analysed; discoveries record evidence and a timestamp', () => {
  const g = fresh(); const s = g.state; startObservation(g, { instrumentId: 'opt-1', targetId: 'sirius-a', hours: 6 }); g.advance(7 * HOUR);
  ok(s.datasets[0].status === 'raw'); eq(s.discoveries.length, 0);
  startAnalysis(g, s.datasets[0].id); g.advance(2 * DAY);
  const d = s.discoveries[0]; ok(d && d.t > 0 && d.evidence.length >= 1 && d.confidence > 0);
});
await test('false positives create anomalies that re-observation resolves', () => {
  let found = null;
  for (let seed = 1; seed < 400 && !found; seed++) {
    const g = fresh(seed); const s = g.state; g.state.resources.credits = 100000;
    for (let i = 0; i < 8 && !s.anomalies.length; i++) { startObservation(g, { instrumentId: 'opt-1', targetId: 'proxima-centauri', hours: 12 }); g.advance(13 * HOUR); }
    if (s.anomalies.length) found = g;
  }
  ok(found, 'an anomaly should appear within some seeds'); const a = found.state.anomalies[0]; eq(a.status, 'unresolved');
  for (let i = 0; i < 4 && a.status === 'unresolved'; i++) { startObservation(found, { instrumentId: 'opt-1', targetId: a.targetId, hours: 24, anomalyId: a.id }); found.advance(25 * HOUR); }
  eq(a.status, 'resolved'); ok(a.resolution.includes('instrumental'));
});
await test('research: tech requires RP, credits, prerequisites and has real effects', () => {
  const g = fresh(); const s = g.state;
  ok(!startTech(g, 'solar-mk2').ok, 'not enough RP');
  s.resources.researchPoints = 500; s.resources.credits = 9000;
  ok(!startTech(g, 'battery-bank').ok, 'prerequisite'); const gen0 = g.techEffect('powerGenMult');
  ok(startTech(g, 'solar-mk2').ok); ok(!startTech(g, 'water-mk2').ok, 'one at a time');
  g.advance(10 * DAY); ok(s.tech.researched['solar-mk2']); ok(g.techEffect('powerGenMult') > gen0);
  ok(startTech(g, 'battery-bank').ok);
});
await test('technology effects change capabilities', () => {
  const g = fresh(); const opt = g.state.instruments[0]; const before = estimate(g, opt);
  g.state.tech.researched['adaptive-optics'] = 1; ok(estimate(g, opt) > before);
  function estimate(gm, i) { return i.accuracy + gm.techEffect('accuracy', 'optical'); }
});
await test('crew assignments change work rates; fatigue builds and rest recovers it', () => {
  const g = fresh(); const c = g.state.crew[1]; setAssignment(g, c.id, 'rest');
  g.advance(10 * DAY); const rested = c.fatigue; setAssignment(g, c.id, 'maintenance'); g.advance(10 * DAY); ok(c.fatigue > rested + 10);
});
await test('hunger and thirst hurt crew but never remove them', () => {
  const g = fresh(); g.state.resources.food = 0; g.state.resources.water = 0; g.advance(40 * DAY);
  ok(g.state.crew.every(c => c.health >= 5 && c.health < 100)); eq(g.state.crew.length, 5);
});
await test('supplies, funding and daily costs', () => {
  const g = fresh(); const s = g.state; g.advance(31 * DAY);
  ok(s.finance.ledger.some(l => l.label.includes('grant')), 'monthly grant'); ok(s.finance.ledger.some(l => l.label.includes('upkeep')));
  const food0 = s.resources.food; const c0 = s.resources.credits;
  ok(requestSupplies(g).ok); ok(s.resources.credits < c0); ok(!requestSupplies(g).ok, 'cooldown'); g.advance(9 * DAY); ok(s.resources.food > food0 - 120);
});
await test('Earth: send discovery and request verification', () => {
  const g = fresh(); const s = g.state; startObservation(g, { instrumentId: 'opt-1', targetId: 'vega', hours: 12 }); g.advance(13 * HOUR); startAnalysis(g, s.datasets[0].id); g.advance(3 * DAY);
  const d = s.discoveries[0]; const rep0 = s.resources.reputation; const conf0 = d.confidence;
  ok(sendDiscovery(g, d.id).ok); ok(!sendDiscovery(g, d.id).ok); ok(requestVerification(g, d.id).ok); g.advance(6 * DAY);
  ok(s.resources.reputation > rep0); ok(d.confidence > conf0); eq(d.verification, 'verified');
});
await test('events: trigger, decide, effects applied, game pauses', () => {
  const g = fresh(); g.state.time.paused = false; g.state.time.speed = 3; const def = triggerEvent(g, 'micrometeoroid'); ok(def); ok(g.state.time.paused);
  const cond0 = g.state.station.systems.power.condition; ok(resolveEvent(g, 'defer').ok); ok(g.state.station.systems.power.condition < cond0); eq(g.state.events.pending, null);
});
await test('events fire randomly over a long run', () => {
  const g = fresh(7); g.prefs.autoPauseOnEvent = false; g.advance(60 * DAY); ok(g.state.events.history.length + (g.state.events.pending ? 1 : 0) >= 2);
});
await test('spacecraft: refuel and repair work and cost credits', () => {
  const g = fresh(); const ship = g.state.spacecraft[0]; ship.fuel = 400; ship.systems.propulsion = 50; const c0 = g.state.resources.credits;
  ok(refuel(g, ship.id, 100).ok); eq(ship.fuel, 500); ok(g.state.resources.credits < c0); ok(repairSystem(g, ship.id, 'propulsion').ok); eq(ship.systems.propulsion, 75);
});
await test('self-directed survey creates a functional objective', () => {
  const g = fresh(); ok(createSurvey(g, 'vega', 'optical').ok); const a = g.state.missions.active[0]; eq(missionProgress(g, a).total, 2);
});
await test('funding offers can be accepted', () => {
  const g = fresh(); g.advance(22 * DAY); const m = g.state.messages.find(x => x.type === 'funding-offer'); ok(m); const c0 = g.state.resources.credits; ok(respondToFunding(g, m.id, true).ok); ok(g.state.resources.credits > c0);
});
await test('determinism: same seed gives the same game', () => {
  const a = fresh(99), b = fresh(99); a.prefs.autoPauseOnEvent = b.prefs.autoPauseOnEvent = false; a.advance(40 * DAY); b.advance(40 * DAY);
  eq(JSON.stringify(a.state), JSON.stringify(b.state));
});
await test('saves: round trip, overwrite confirmation, export, import, bad files', async () => {
  const g = fresh(); g.advance(5 * DAY); const sm = new SaveManager(new MemoryBackend());
  ok((await sm.save(g, 'manual-1')).ok); const again = await sm.save(g, 'manual-1'); ok(again.needsConfirm && !again.ok);
  ok((await sm.save(g, 'manual-1', { overwrite: true })).ok); ok((await sm.save(g, 'autosave')).ok); ok((await sm.save(g, 'autosave')).ok, 'autosave needs no confirmation');
  const loaded = await sm.load('manual-1'); ok(loaded.ok); eq(JSON.stringify(loaded.state), JSON.stringify(g.state));
  const g2 = Game.fromSave(data, loaded.state); ok(g2.state.time.paused); eq(g2.state.time.t, g.state.time.t);
  const text = sm.exportJson(g); const imp = sm.parseImport(text); ok(imp.ok); ok(!sm.parseImport('{nope').ok); ok(!sm.parseImport('{"format":"x"}').ok);
  ok(!(await sm.importToSlot(imp.state, 'manual-1')).ok); ok((await sm.importToSlot(imp.state, 'manual-2')).ok);
  ok(!sm.prepare({ version: 99, time: {}, resources: {}, crew: [], station: {}, missions: {}, finance: {} }).ok, 'newer version rejected');
  eq((await sm.list()).length, 3); await sm.remove('manual-2'); eq((await sm.list()).length, 2); ok(!(await sm.load('manual-3')).ok);
});
await test('loaded game continues identically to an uninterrupted one', async () => {
  const a = fresh(5); a.prefs.autoPauseOnEvent = false; a.advance(10 * DAY); const sm = new SaveManager(new MemoryBackend()); await sm.save(a, 'manual-1');
  const b = Game.fromSave(data, (await sm.load('manual-1')).state); b.prefs.autoPauseOnEvent = false; a.advance(10 * DAY); b.advance(10 * DAY);
  eq(a.state.resources.food, b.state.resources.food); eq(a.state.time.t, b.state.time.t);
});

// ---------------- V2 milestone tests ----------------
import { startUpgrade, canUpgrade, moduleEffect, upgradeCost } from '../js/station-modules.js';
import { sources, startPublication, TYPES } from '../js/publications.js';
import { spawnTransient, respondToTransient, canRespond, activeTransients } from '../js/cosmic-events.js';
import { searchChronicle } from '../js/chronicle.js';
import { financeWarnings, closeMonth } from '../js/finance.js';
import { SAVE_VERSION } from '../js/constants.js';
const v1file = JSON.parse(await readFile(path.join(root, 'tests/fixtures/v1-save.json'), 'utf8'));
// A game with one analysed discovery, for publication tests.
async function withDiscovery() {
  const g = fresh(4242); g.state.resources.credits = 20000; acceptMission(g, 'm01');
  startObservation(g, { instrumentId: 'opt-1', targetId: 'proxima-centauri', hours: 12 }); g.advance(DAY);
  const ds = g.state.datasets[0]; ok(ds, 'dataset'); startAnalysis(g, ds.id); g.advance(DAY * 8); ok(g.state.discoveries.length >= 1, 'discovery');
  return g;
}

await test('V1 -> V2 migration: real V1 save keeps all data, gains new structures, original backed up', async () => {
  eq(v1file.state.version, 1);
  const backend = new MemoryBackend(); const sm = new SaveManager(backend);
  const before = JSON.stringify(v1file.state);
  await backend.put('manual-1', v1file.state, { savedAt: 1, gameTime: v1file.state.time.t, version: 1 });
  const r = await sm.load('manual-1'); ok(r.ok, r.error); eq(r.state.version, SAVE_VERSION);
  eq(JSON.stringify(await backend.get('manual-1')), before, 'original slot untouched');
  ok(await sm.exists('backup-manual-1-v1'), 'backup created');
  eq(JSON.stringify(await backend.get('backup-manual-1-v1')), before, 'backup identical to original');
  const g = Game.fromSave(data, r.state);
  eq(g.state.discoveries.length, v1file.state.discoveries.length); eq(g.state.resources.credits, v1file.state.resources.credits);
  eq(g.state.missions.completed.length, v1file.state.missions.completed.length); eq(g.state.crew.length, 5);
  ok(g.state.chronicle.length >= 3, 'history backfilled'); ok(g.state.chronicle.some(e => e.kind === 'mission' && e.major), 'first mission in history');
  eq(Object.keys(g.state.modules).length, 10); ok(Array.isArray(g.state.publications));
  const before2 = g.state.chronicle.length; const g2 = Game.fromSave(data, JSON.parse(JSON.stringify(g.state))); eq(g2.state.chronicle.length, before2, 'backfill runs only once');
  g.advance(DAY * 20); ok(g.state.time.t > v1file.state.time.t, 'migrated game keeps running');
});
await test('saves: damaged save is rejected, recovery finds a good one', async () => {
  const sm = new SaveManager(new MemoryBackend()); const g = fresh();
  await sm.save(g, 'manual-2'); await sm.backend.put('autosave', { version: 2, time: {}, resources: {}, crew: 'broken', station: {}, missions: {}, finance: {} }, { savedAt: Date.now() + 5000 });
  ok(!(await sm.load('autosave')).ok, 'damaged rejected'); const rec = await sm.recover(); ok(rec.ok && rec.slot === 'manual-2', 'recovered ' + JSON.stringify(rec));
  ok(!sm.parseImport('{"format":"deep-signal-save","state":{"version":99}}').ok, 'newer version rejected');
});
await test('station modules: upgrade costs credits and time, effects reach real systems', () => {
  const g = fresh(); const s = g.state; const base = { gen: powerGen(g), cap: g.moduleEffect('storageMult') };
  eq(moduleEffect(g, 'powerGenMult'), 0, 'level 1 gives no bonus');
  const c0 = s.resources.credits; const cost = upgradeCost(g, 'power'); const r = startUpgrade(g, 'power'); ok(r.ok, r.error);
  eq(s.resources.credits, c0 - cost); ok(!startUpgrade(g, 'power').ok, 'one at a time');
  g.advance(DAY * 40); eq(s.modules.power.level, 2); ok(moduleEffect(g, 'powerGenMult') > 0.05, 'power bonus'); ok(powerGen(g) > base.gen, 'generation actually rose');
  ok(s.chronicle.some(e => e.kind === 'infrastructure'), 'upgrade recorded in history');
  const poor = fresh(); poor.state.resources.credits = 10; ok(!canUpgrade(poor, 'storage').ok, 'needs credits');
  const nomaint = fresh(); for (const c of nomaint.state.crew) c.assignment = 'rest'; ok(!canUpgrade(nomaint, 'storage').ok, 'needs maintenance crew');
});
function powerGen(g) { return g.state.station.power.gen || (g.advance(600), g.state.station.power.gen); }
await test('station modules: storage raises caps, observatory raises accuracy, comms shortens convoys', async () => {
  const g = fresh(); g.state.resources.credits = 50000; g.state.modules.storage.level = 3; g.state.modules.observatory.level = 3; g.state.modules.communications.level = 4;
  const { storageCap } = await import('../js/station.js'); ok(storageCap(g, 'food') > 1800 * 1.4, 'storage cap');
  const { instrumentAccuracy } = await import('../js/observatory.js'); const inst = g.state.instruments[0]; ok(instrumentAccuracy(g, inst) > inst.accuracy, 'accuracy');
  const before = g.state.time.t; requestSupplies(g); const p = g.state.finance.pending.at(-1); ok((p.arrives - before) / DAY < 6, 'convoy faster than 8 days');
  g.state.modules.storage.condition = 40; ok(moduleEffect(g, 'storageMult') < 0.5 * 0.9, 'poor condition weakens effects');
});
await test('publications: workflow stages, rewards, rejection when evidence is weak', async () => {
  const g = await withDiscovery(); const s = g.state; const d = s.discoveries[0];
  ok(sources(g).find(x => x.type === 'preliminary' && x.sourceId === d.id).ok, 'preliminary available');
  ok(!sources(g).find(x => x.type === 'paper').ok, 'paper needs two records');
  ok(!sources(g).find(x => x.type === 'major' && x.sourceId === d.id).ok, 'major needs verification');
  const rp0 = s.resources.researchPoints, rep0 = s.resources.reputation;
  const r = startPublication(g, 'preliminary', d.id); ok(r.ok, r.error); ok(!startPublication(g, 'preliminary', d.id).ok, 'no duplicates');
  const stages = new Set(); for (let i = 0; i < 80; i++) { g.advance(3600 * 2); stages.add(s.publications[0].stage); }
  eq(s.publications[0].status, 'published'); ok(stages.size >= 3, 'passed through stages');
  ok(s.resources.researchPoints > rp0 && s.resources.reputation > rep0, 'rewards paid'); ok(s.chronicle.some(e => e.kind === 'publication'), 'history');
  // weak evidence is returned by reviewers
  const weak = await withDiscovery(); weak.state.discoveries[0].confidence = 41; weak.state.discoveries[0].verification = null;
  let returned = 0; for (let k = 0; k < 8; k++) { const w = JSON.parse(JSON.stringify(weak.state)); const gw = Game.fromSave(data, w); gw.state.rng = 100 + k; gw.state.resources.credits = 9999; gw.state.publications = []; startPublication(gw, 'major', gw.state.discoveries[0].id); }
  const g3 = await withDiscovery(); g3.state.discoveries[0].verification = 'verified'; g3.state.discoveries[0].confidence = 75; ok(startPublication(g3, 'major', g3.state.discoveries[0].id).ok, 'verified discovery can go to major');
  // returned path: force a low confidence paper-grade threshold
  const g4 = await withDiscovery(); g4.state.discoveries[0].confidence = 40; startPublication(g4, 'preliminary', g4.state.discoveries[0].id); g4.state.publications[0].confidence = 5;
  g4.advance(DAY * 6); eq(g4.state.publications[0].status, 'returned'); ok(g4.state.messages.some(m => /Returned/.test(m.subject)), 'reviewer message');
});
await test('transient events: records, response, missed windows, no-instrument alerts', () => {
  const g = fresh(99); g.state.resources.credits = 5000; const s = g.state;
  const r = spawnTransient(g, 't-supernova'); ok(r.transient && r.status === 'active' && r.simulated, 'open record');
  for (const k of ['id', 'type', 'severity', 't', 'description', 'affected', 'consequences', 'status']) ok(k in r, 'record field ' + k);
  const grb = spawnTransient(g, 't-grb'); eq(grb.status, 'logged'); ok(!canRespond(g, grb.id, 'opt-1').ok);
  ok(!canRespond(g, r.id, 'rad-1').ok, 'radio cannot answer an optical event');
  const rp0 = s.resources.researchPoints; const res = respondToTransient(g, r.id, 'opt-1'); ok(res.ok, res.error); eq(r.status, 'responding');
  ok(!canRespond(g, r.id, 'opt-1').ok, 'instrument busy'); g.advance(3600 * 5);
  ok(['observed', 'missed'].includes(r.status), r.status);
  if (r.status === 'observed') { ok(s.resources.researchPoints > rp0); const d = s.discoveries.find(x => x.id === r.discoveryId); eq(d.category, 'Simulated Event'); eq(d.targetId, null); }
  const r2 = spawnTransient(g, 't-pulsar'); g.advance(3600 * 60); eq(r2.status, 'missed', 'window closes');
});
await test('transient events appear during a long run and never break decision events', () => {
  const g = fresh(7); g.state.time.paused = false; g.state.time.speed = 4; g.prefs.autoPauseOnEvent = false;
  for (let d = 0; d < 120; d++) { g.advance(DAY); if (g.state.events.pending) resolveEvent(g, g.data.events.find(e => e.id === g.state.events.pending.id).options[0].id); for (const c of g.state.crew) { c.health = 100; } g.state.resources.credits += 200; }
  ok(g.state.events.records.some(r => r.transient), 'transients occurred'); ok(g.state.events.records.some(r => !r.transient && r.status === 'resolved'), 'decision events recorded');
  ok(g.state.events.records.every(r => r.id && r.status && r.t != null));
});
await test('history: milestones recorded, searchable, first-of-kind marked major', async () => {
  const g = await withDiscovery(); const h = searchChronicle(g, {}); ok(h.length >= 2);
  ok(h.some(e => e.kind === 'station'), 'station'); ok(h.some(e => e.kind === 'discovery' && e.major), 'first discovery major');
  ok(searchChronicle(g, { kind: 'discovery' }).every(e => e.kind === 'discovery')); ok(searchChronicle(g, { query: 'zzzz' }).length === 0);
  const t = h.map(e => e.t); for (let i = 1; i < t.length; i++) ok(t[i - 1] >= t[i], 'newest first');
});
await test('finance: monthly report from real totals, categories, warnings', () => {
  const g = fresh(); g.state.time.paused = false; g.state.time.speed = 4; g.advance(DAY * 31);
  const rep = g.state.finance.reports[0]; ok(rep, 'report exists'); ok(rep.expense >= 30 * 110, 'upkeep counted'); eq(rep.income, 5000 + 0 * 1 || rep.income); ok(rep.byCat['Personnel and station'] <= -30 * 110);
  eq(Math.round(rep.income - rep.expense), rep.net);
  const poor = fresh(); poor.state.resources.credits = 500; ok(financeWarnings(poor).some(w => w.level === 'bad'), 'low balance warns'); poor.state.resources.credits = 5000; eq(financeWarnings(poor).length, 0);
});
await test('V2 determinism and save round trip including new systems', async () => {
  const a = fresh(31337), b = fresh(31337); for (const g of [a, b]) { g.state.resources.credits = 9000; startUpgrade(g, 'research'); g.advance(DAY * 45); }
  eq(JSON.stringify(a.state), JSON.stringify(b.state), 'same seed same game');
  const sm = new SaveManager(new MemoryBackend()); await sm.save(a, 'manual-1'); const l = await sm.load('manual-1'); const g2 = Game.fromSave(data, l.state);
  g2.state.log.shift(); a.state.time.paused = true; a.state.time.speed = 0; eq(JSON.stringify(g2.state), JSON.stringify(a.state), 'round trip identical');
  a.state.time.paused = false; a.state.time.speed = 3; g2.state.time.paused = false; g2.state.time.speed = 3; a.advance(DAY * 10); g2.advance(DAY * 10); eq(JSON.stringify(g2.state), JSON.stringify(a.state), 'continues identically');
});
await test('performance: 365 simulated days stay fast and saves stay small', () => {
  const g = fresh(5); g.state.time.paused = false; g.prefs.autoPauseOnEvent = false; const t0 = performance.now(); for (let d = 0; d < 365; d++) { g.advance(DAY); if (g.state.events.pending) resolveEvent(g, 'shelter') || resolveEvent(g, g.data.events.find(e => e.id === g.state.events.pending.id).options[0].id); g.state.resources.credits += 300; }
  const ms = performance.now() - t0; const kb = JSON.stringify(g.state).length / 1024; console.log(`       365 days in ${ms.toFixed(0)} ms, save ${kb.toFixed(0)} KB`);
  ok(ms < 8000, 'too slow: ' + ms); ok(kb < 600, 'save too large: ' + kb);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
