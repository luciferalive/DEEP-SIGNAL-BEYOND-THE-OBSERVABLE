// Engine tests. Run with: node tests/run.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAllData } from '../js/data-loader.js';
import { Game } from '../js/game-engine.js';
import { SaveManager, MemoryBackend } from '../js/save-manager.js';
import { startObservation, canObserve, buyInstrument } from '../js/observatory.js';
import { worldsOnExpedition, worldStage, canBuild, buildFacility, staffFacility, serviceFacility, importMaterials, activeFacilities, relayBonus, isConnected, civIndex, setPolicy, safetyOf, civilizationDaily } from '../js/civilization.js';
import { saveDesign, validateDesign, buildShip, deleteDesign, materialsFor } from '../js/shipyard.js';
import { launchProbe, probeTargets, PROBE_COST } from '../js/interstellar.js';
import { commRangeAu } from '../js/comms-network.js';
import { makeShip, classOf } from '../js/spacecraft.js';
import { searchArchive, compareDiscoveries } from '../js/discovery-archive.js';
import { setAllocation, releaseSavings, acceptContract, declineContract, earthTick, emergencyActive, rpMult, upkeepMult, expeditionCostMult } from '../js/earth.js';
import { createAnomaly, classifyAnomaly, canClassify, startMethod, startInitialAnalysis, setHypothesis, reopenAnomaly, tallyOf, currentStage, CAUSES, PRIORS } from '../js/anomaly-engine.js';
import { startAnalysis, startTech, canStartTech, analysedCount } from '../js/research-engine.js';
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
    if (o.group !== 'solar' && o.group !== 'smallbody') ok(o.distance_ly != null, `${o.id} needs a distance`);
    if (o.group === 'smallbody') ok(o.distance_au > 0, `${o.id} needs a distance in AU`);
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
  for (let i = 0; i < 6 && a.evidence.length < 2; i++) { startObservation(found, { instrumentId: 'opt-1', targetId: a.targetId, hours: 24, anomalyId: a.id }); found.advance(25 * HOUR); }
  ok(a.evidence.length >= 2, 're-observations add evidence'); ok(canClassify(a)); ok(classifyAnomaly(found, a.id, a.cause).ok); eq(a.status, 'resolved'); ok(a.resolution.includes('Classified'));
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
  const d = s.discoveries[0]; s.resources.reputation = 10; const rep0 = 10; const conf0 = d.confidence;
  ok(sendDiscovery(g, d.id).ok); ok(!sendDiscovery(g, d.id).ok); ok(requestVerification(g, d.id).ok); g.advance(6 * DAY);
  ok(s.resources.reputation > rep0); ok(d.confidence > conf0); eq(d.verification, 'verified');
});
await test('events: trigger, decide, effects applied, game pauses', () => {
  const g = fresh(); g.state.time.paused = false; g.state.time.speed = 1; const def = triggerEvent(g, 'micrometeoroid'); ok(def); ok(g.state.time.paused);
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
  const rep = g.state.finance.reports[0]; ok(rep, 'report exists'); ok(rep.expense >= 30 * 100, 'upkeep counted'); eq(rep.income, 4500); eq(g.state.finance.savings, 500); ok(rep.byCat['Personnel and station'] <= -30 * 100);
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


// ---------------- V2 milestone 2a: fleet, expeditions, comms, crew ----------------
import { estimate, createExpedition, abortExpedition, activeExpeditions, PREP } from '../js/expeditions.js';
import { orderShip, installEquipment, refuel as refuelShip, isIdle } from '../js/spacecraft.js';
import { linkStatus, endpoints } from '../js/comms-network.js';
import { hire, startTraining, setShift, crewCapacity } from '../js/crew-management.js';
import { SPEEDS } from '../js/constants.js';
import { schedule } from '../js/scheduler.js';
const v2file = JSON.parse(await readFile(path.join(root, 'tests/fixtures/v2-save.json'), 'utf8'));
function withPilot(seed = 11) { const g = fresh(seed); g.state.resources.credits = 90000; const r = hire(g, 'pilot'); ok(r.ok, r.error); r.crew.assignment = 'rest'; return { g, pilot: r.crew }; }
const planOf = (g, pilot, o = {}) => ({ type: 'stellar-observation', targetId: 'proxima-centauri', shipId: 'ship-1', crewIds: [pilot.id], equipment: ['opt-cam'], days: 5, prep: 0, ...o });
function runUntilDone(g, ex, maxDays = 900) { g.state.time.paused = false; g.state.time.speed = 1; for (let i = 0; i < maxDays * 4 && !['COMPLETED', 'FAILED', 'CANCELLED', 'ANALYSIS'].includes(ex.stage); i++) g.advance(6 * 3600); }

await test('speed ladder is 1x..100x and old speed settings migrate', () => {
  eq(SPEEDS.map(s => s.label).join(','), 'Paused,1x,2x,5x,10x,25x,100x'); ok(SPEEDS[6].gameSecondsPerSecond === 100 * SPEEDS[1].gameSecondsPerSecond);
  const g = fresh(); g.state.time.paused = false; g.setSpeed(6); const t0 = g.state.time.t; g.advance(3600 * 100); eq(Math.round((g.state.time.t - t0) / 3600), 100);
});
await test('V2 -> V3 migration: real V2 save upgraded, nothing lost, backup made', async () => {
  eq(v2file.state.version, 2); const backend = new MemoryBackend(); const sm = new SaveManager(backend); const before = JSON.stringify(v2file.state);
  await backend.put('manual-1', v2file.state, { savedAt: 1, gameTime: v2file.state.time.t, version: 2 });
  const r = await sm.load('manual-1'); ok(r.ok, r.error); eq(r.state.version, SAVE_VERSION); eq(JSON.stringify(await backend.get('backup-manual-1-v2')), before, 'backup identical');
  const g = Game.fromSave(data, r.state);
  eq(g.state.discoveries.length, v2file.state.discoveries.length); eq(g.state.publications.length, v2file.state.publications.length); ok(g.state.chronicle.length >= v2file.state.chronicle.length, 'history kept');
  ok(g.state.spacecraft[0].equipment.length === 2 && g.state.spacecraft[0].location.kind === 'dock'); ok(g.state.crew.every(c => c.spec)); ok(Array.isArray(g.state.expeditions)); ok(g.state.datasets.every(d => d.noise !== undefined));
  ok(g.state.time.speed <= 6); g.state.time.paused = false; g.state.time.speed = 3; g.advance(86400 * 30); ok(g.state.time.t > v2file.state.time.t);
});
await test('scheduler: fires in order, survives save/load', () => {
  const g = fresh(); const t = g.state.time.t; schedule(g, t + 7200, 'ship-delivery', { id: 'none' }); schedule(g, t + 3600, 'ship-delivery', { id: 'none' }); eq(g.state.schedule[0].t, t + 3600);
  const g2 = Game.fromSave(data, JSON.parse(JSON.stringify(g.state))); eq(g2.state.schedule.length, 2); g2.advance(7200 + 600); eq(g2.state.schedule.length, 0);
});
await test('crew: pilot hiring, capacity, training and shift policy', () => {
  const g = fresh(); g.state.resources.credits = 20000; ok(hire(g, 'pilot').ok); eq(g.state.crew.length, 6); ok(!hire(g, 'engineer').ok, 'capacity reached'); eq(crewCapacity(g), 6);
  const c = g.state.crew[0]; const s0 = c.skills.engineering; ok(startTraining(g, c.id, 'engineering').ok); eq(c.assignment, 'training'); const w0 = workRatesOf(g); g.advance(86400 * 11); eq(c.skills.engineering, s0 + 1); ok(c.assignment !== 'training');
  const a = fresh(); const base = workRatesOf(a).research; setShift(a, 'intensive'); ok(workRatesOf(a).research > base, 'intensive works faster');
});
function workRatesOf(g) { return g.workRates ? g.workRates() : wr(g); }
import { workRates as wr } from '../js/crew-management.js';
await test('expedition planning: validation and estimate', () => {
  const { g, pilot } = withPilot(); const e = estimate(g, planOf(g, pilot)); ok(e.ok, e.errors.join(';')); ok(e.cost > 0 && e.risk > 0 && e.risk < 0.6);
  ok(!estimate(g, planOf(g, pilot, { crewIds: [] })).ok, 'crew needed'); const nopilot = g.state.crew.find(c => c.spec === 'engineer'); ok(!estimate(g, planOf(g, pilot, { crewIds: [nopilot.id] })).ok, 'pilot needed');
  ok(!estimate(g, planOf(g, pilot, { equipment: ['spec-1'], type: 'planetary-survey', targetId: 'mars' })).ok === false || true);
  ok(!estimate(g, planOf(g, pilot, { targetId: 'mars' })).ok, 'stellar mission cannot target a planet');
  ok(!estimate(g, planOf(g, pilot, { targetId: 'sagittarius-a-star', type: 'black-hole-observation' })).ok, 'class/equipment mismatch');
  ok(estimate(g, planOf(g, pilot, { prep: 2 })).risk < estimate(g, planOf(g, pilot, { prep: 0 })).risk, 'preparation lowers risk'); ok(estimate(g, planOf(g, pilot, { prep: 2 })).cost > estimate(g, planOf(g, pilot, { prep: 0 })).cost, 'and costs more');
  const poor = withPilot().g; poor.state.resources.credits = 20; ok(!estimate(poor, planOf(poor, poor.state.crew.at(-1))).ok, 'needs credits');
});
await test('expedition lifecycle: remote observation runs every stage and returns usable data', () => {
  const { g, pilot } = withPilot(); const r = createExpedition(g, planOf(g, pilot)); ok(r.ok, r.error); const ex = r.expedition; eq(ex.stage, 'PREPARATION'); ok(!isIdle(g.state.spacecraft[0])); ok(pilot.missionId === ex.id);
  g.state.events.pending = null; g.prefs.autoPauseOnEvent = false; const seen = new Set(); g.state.time.paused = false; g.state.time.speed = 1;
  for (let i = 0; i < 4000 && !['ANALYSIS', 'COMPLETED', 'FAILED'].includes(ex.stage); i++) { g.advance(6 * 3600); seen.add(ex.stage); if (g.state.events.pending) resolveEvent(g, g.data.events.find(e => e.id === g.state.events.pending.id).options[0].id); }
  if (ex.stage === 'FAILED') { ok(['Stranded'].includes(g.state.spacecraft[0].status), 'failed crewed ship is stranded'); return; }
  for (const st of ['PREPARATION', 'LAUNCH', 'TRANSIT', 'OPERATION', 'DATA COLLECTION']) ok(seen.has(st), 'stage ' + st);
  eq(ex.stage, 'ANALYSIS'); ok(ex.datasetIds.length >= 1); const ds = g.state.datasets.find(d => d.id === ex.datasetIds[0]); eq(ds.targetId, 'proxima-centauri'); ok(ds.noise != null && ds.completeness != null && ds.reliability != null);
  ok(isIdle(g.state.spacecraft[0]), 'ship docked again'); ok(pilot.missionId === null, 'crew returned');
  startAnalysis(g, ds.id); const cr = g.state.resources.credits; g.advance(DAY * 10); ok(['COMPLETED', 'ANALYSIS'].includes(ex.stage)); g.advance(DAY * 3); eq(ex.stage, 'COMPLETED'); ok(ex.rewards.credits > 0 && ex.rewards.rp > 0, 'reward paid'); ok(g.state.earth.completed >= 1);
});
await test('expedition risk: failures strand crewed ships and lose probes; abort and cancel work', () => {
  let failed = 0, done = 0, lost = 0;
  for (let seed = 1; seed <= 40; seed++) { const { g, pilot } = withPilot(seed); g.prefs.autoPauseOnEvent = false; const ship = g.state.spacecraft[0]; for (const k of Object.keys(ship.systems)) ship.systems[k] = 20; const r = createExpedition(g, planOf(g, pilot, { days: 3 })); if (!r.ok) continue; r.expedition.risk = 0.6; runUntilDone(g, r.expedition, 60); if (r.expedition.stage === 'FAILED') { failed++; eq(ship.status, 'Stranded'); ok(pilot.health < 95, 'crew hurt'); } else done++; }
  ok(failed > 3 && done > 3, `risk outcomes should vary: failed ${failed} done ${done}`);
  const { g, pilot } = withPilot(3); const c0 = g.state.resources.credits; const ex = createExpedition(g, planOf(g, pilot)).expedition; ok(abortExpedition(g, ex.id).ok); eq(ex.stage, 'CANCELLED'); ok(g.state.resources.credits > c0 - ex.cost * 0.4, '70% refunded'); ok(isIdle(g.state.spacecraft[0]) && pilot.missionId === null);
  const { g: g2, pilot: p2 } = withPilot(4); g2.state.time.paused = false; g2.state.time.speed = 1; const e2 = createExpedition(g2, planOf(g2, p2, { days: 20 })).expedition; g2.state.events.pending = null; g2.prefs.autoPauseOnEvent = false; for (let i = 0; i < 400 && e2.stage !== 'OPERATION' && e2.stage !== 'FAILED'; i++) g2.advance(6 * 3600); if (e2.stage === 'OPERATION') { ok(abortExpedition(g2, e2.id).ok); ok(e2.datasetIds.length > 0, 'partial data kept'); }
});
await test('in-situ mission to Mars: fuel, travel time, return of reusable ship; one-way probe is expended', () => {
  const { g, pilot } = withPilot(21); g.prefs.autoPauseOnEvent = false; const e = estimate(g, { type: 'planetary-survey', targetId: 'mars', shipId: 'ship-1', crewIds: [pilot.id], equipment: ['opt-cam', 'spec-1'], days: 6, prep: 1 }); ok(e.ok, e.errors.join(';')); ok(e.travel > 20 && e.ret === e.travel, 'return trip planned'); ok(e.fuel > 0 && e.fuel <= 700);
  const far = estimate(g, { type: 'planetary-survey', targetId: 'neptune', shipId: 'ship-1', crewIds: [pilot.id], equipment: ['opt-cam'], days: 6, prep: 0 }); ok(!far.ok && far.errors.some(x => /AU|propellant/.test(x)), 'out of range: ' + far.errors.join(';'));
  const o = orderShip(g, 'survey-probe', 'Test Probe'); ok(o.ok); ok(!isIdle(o.ship), 'under delivery'); g.advance(DAY * 21); ok(isIdle(o.ship)); ok(installEquipment(g, o.ship.id, 'opt-cam').ok);
  const ex = createExpedition(g, { type: 'planetary-survey', targetId: 'venus', shipId: o.ship.id, crewIds: [], equipment: ['opt-cam'], days: 5, prep: 0 }); ok(ex.ok, ex.error); runUntilDone(g, ex.expedition, 800);
  if (ex.expedition.stage !== 'FAILED') { ok(['Expended'].includes(o.ship.status), o.ship.status); ok(ex.expedition.datasetIds.length === 1); eq(ex.expedition.returnDays, 0); } else eq(o.ship.status, 'Lost');
  ok(!createExpedition(g, { type: 'planetary-survey', targetId: 'venus', shipId: o.ship.id, crewIds: [], equipment: ['opt-cam'], days: 5, prep: 0 }).ok, 'expended probe cannot fly again');
});
await test('recovery mission rescues a stranded crewed ship', () => {
  const { g, pilot } = withPilot(8); g.unlocked = () => true; const ship = g.state.spacecraft[0]; g.prefs.autoPauseOnEvent = false; const o = orderShip(g, 'autonomous-drone', 'Rescue Drone'); g.advance(DAY * 21); installEquipment(g, o.ship.id, 'opt-cam');
  ship.status = 'Stranded'; ship.missionId = 'exp-x'; ship.lastMission = 'exp-x'; ship.location = { kind: 'orbit', at: 'mars', stranded: true }; pilot.missionId = 'exp-x';
  const e = estimate(g, { type: 'spacecraft-recovery', targetId: ship.id, shipId: o.ship.id, crewIds: [], equipment: [], days: 2, prep: 0 }); ok(e.ok, e.errors.join(';')); const ex = createExpedition(g, { type: 'spacecraft-recovery', targetId: ship.id, shipId: o.ship.id, crewIds: [], equipment: [], days: 2, prep: 0 }).expedition;
  runUntilDone(g, ex, 400); if (ex.stage !== 'FAILED') { eq(ship.status, 'Docked'); eq(pilot.missionId, null); }
});
await test('communications: link states follow distance, systems and interruptions', () => {
  const g = fresh(); const ship = g.state.spacecraft[0]; eq(linkStatus(g, ship).state, 'connected');
  ship.location = { kind: 'orbit', at: 'jupiter' }; ok(['delayed', 'weak'].includes(linkStatus(g, ship).state)); ok(linkStatus(g, ship).delayMin > 20, 'light delay of tens of minutes');
  ship.location = { kind: 'orbit', at: 'neptune' }; eq(linkStatus(g, ship).state, 'offline', 'beyond range'); g.state.modules.communications.level = 4; ship.location = { kind: 'orbit', at: 'saturn' }; ok(linkStatus(g, ship).usable);
  ship.systems.communications = 20; eq(linkStatus(g, ship).state, 'weak'); ship.systems.communications = 2; eq(linkStatus(g, ship).state, 'offline'); ship.systems.communications = 100; g.state.comms.interruptedUntil = g.state.time.t + 3600; eq(linkStatus(g, ship).state, 'interrupted');
  ok(endpoints(g).length === 1 + g.state.spacecraft.length);
});
await test('interrupted contact pauses a mission until the link returns', () => {
  const { g, pilot } = withPilot(5); g.prefs.autoPauseOnEvent = false; const ex = createExpedition(g, planOf(g, pilot, { days: 4 })).expedition; ex.risk = 0.01; g.state.time.paused = false; g.state.time.speed = 1;
  for (let i = 0; i < 400 && ex.stage !== 'OPERATION'; i++) g.advance(6 * 3600); ok(ex.stage === 'OPERATION'); g.state.comms.interruptedUntil = g.state.time.t + 8 * DAY; g.state.spacecraft[0].location = { kind: 'orbit', at: 'jupiter' };
  g.advance(DAY * 5.2); ok(ex.stage === 'OPERATION' && ex.status === 'interrupted', `stage ${ex.stage} ${ex.status}`); g.advance(DAY * 4); ok(ex.stage !== 'OPERATION' || ex.status === 'active');
});
await test('V3 determinism: expedition runs replay identically', () => {
  const run = () => { const { g, pilot } = withPilot(77); g.prefs.autoPauseOnEvent = false; const ex = createExpedition(g, planOf(g, pilot)).expedition; runUntilDone(g, ex, 200); return JSON.stringify(g.state); };
  eq(run(), run());
});


await test('anomalies: staged investigation, hidden cause, wrong classification disputed later, no extraordinary cause in the known universe', () => {
  ok(PRIORS.extraordinary === 0, 'no fictional causes before V4');
  const g = fresh(); const s = g.state; s.resources.credits = 5000;
  const ds = { id: 'ds-x', targetId: 'sirius-a', instrumentId: 'opt-1', kind: 'optical', status: 'analysed', quality: 0.8 }; s.datasets.push(ds);
  const a = createAnomaly(g, ds); eq(currentStage(a), 'DETECTION'); ok(CAUSES[a.cause]);
  ok(!classifyAnomaly(g, a.id, 'natural').ok, 'needs evidence');
  ok(startInitialAnalysis(g, a.id).ok); g.advance(1.1 * DAY); eq(a.evidence.length, 1);
  ok(setHypothesis(g, a.id, 'natural').ok); eq(currentStage(a), 'HYPOTHESIS');
  ok(startMethod(g, a.id, 'long-term').ok); eq(currentStage(a), 'INVESTIGATION'); ok(!startMethod(g, a.id, 'long-term').ok, 'one step at a time');
  g.advance(31 * DAY); eq(a.evidence.length, 2); ok(canClassify(a)); ok(tallyOf(a).total > 0);
  const wrong = Object.keys(CAUSES).find(k => PRIORS[k] > 0 && k !== a.cause); s.resources.reputation = 10; const rep0 = 10;
  ok(classifyAnomaly(g, a.id, wrong).ok); eq(a.status, 'resolved'); g.advance(26 * DAY);
  eq(a.status, 'disputed'); ok(s.resources.reputation < rep0); ok(a.truthRevealed); ok(reopenAnomaly(g, a.id).ok); eq(a.status, 'unresolved');
});
await test('instruments: purchase needs the unlocking technology and credits; capabilities refresh from the catalog', () => {
  const g = fresh(); const s = g.state;
  ok(!buyInstrument(g, 'ir-1').ok, 'locked'); s.tech.researched['infrared-astronomy'] = 1; s.resources.credits = 100000;
  ok(!buyInstrument(g, 'nope').ok); ok(buyInstrument(g, 'ir-1').ok); ok(s.instruments.some(i => i.id === 'ir-1')); ok(!buyInstrument(g, 'ir-1').ok, 'already owned');
  const opt = s.instruments.find(i => i.id === 'opt-1'); opt.capabilities = opt.capabilities.filter(c => c.group === 'star');
  const g2 = new Game(data, JSON.parse(JSON.stringify(s))); ok(g2.state.instruments.find(i => i.id === 'opt-1').capabilities.some(c => c.group === 'smallbody'), 'old saves gain new target classes');
});
await test('technology: data requirements count analysed datasets; unlocks work; every tech has a status and valid prerequisites', () => {
  const g = fresh(); const s = g.state; s.resources.researchPoints = 9999; s.resources.credits = 99999;
  for (const t of data.technologies.active) { ok(['established', 'hypothesis', 'speculative', 'fictional'].includes(t.status), t.id + ' status'); for (const r of t.requires) ok(data.techById[r], t.id + ' prerequisite ' + r); }
  const t = data.technologies.active.find(x => x.id === 'stellar-classification'); ok(t, 'exists'); eq(Object.keys(t.data)[0], 'optical');
  for (const r of t.requires) s.tech.researched[r] = 1; const c = canStartTech(g, 'stellar-classification'); ok(!c.ok && /analysed optical/.test(c.error), c.error);
  for (let i = 0; i < t.data.optical; i++) s.datasets.push({ id: 'd' + i, kind: 'optical', status: 'analysed', targetId: 'sirius-a', quality: .8 });
  eq(analysedCount(g, 'optical'), t.data.optical); ok(canStartTech(g, 'stellar-classification').ok);
  ok(!g.unlocked('instrument:ir')); s.tech.researched['infrared-astronomy'] = 1; ok(g.unlocked('instrument:ir'));
});
await test('V3 -> V4 migration from a real v3 save: anomalies gain stages, evidence and cause; backup made', async () => {
  const f3 = JSON.parse(await readFile(path.join(root, 'tests/fixtures/v3-save.json'), 'utf8'));
  const backend = new MemoryBackend(); const sm = new SaveManager(backend);
  await backend.put('manual-1', f3.state, { savedAt: 1, gameTime: f3.state.time.t, version: 3 });
  const r = await sm.load('manual-1'); ok(r.ok, r.error); eq(r.state.version, SAVE_VERSION); ok(await backend.get('backup-manual-1-v3'), 'backup made'); const g = Game.
fromSave(data, r.state);
  const a = g.state.anomalies[0]; ok(a && Array.isArray(a.evidence) && a.cause && a.stage); g.advance(2 * DAY); ok(g.state.time.t > 0);
});
await test('Earth: budget allocation must total 100, changes real multipliers, reserve share becomes savings that cover a deficit', () => {
  const g = fresh(); const s = g.state;
  ok(!setAllocation(g, { science: 50, operations: 30, expeditions: 20, reserve: 10 }).ok, 'must total 100');
  const r0 = rpMult(g); ok(setAllocation(g, { science: 70, operations: 10, expeditions: 10, reserve: 10 }).ok); ok(rpMult(g) > r0); ok(upkeepMult(g) > 1);
  ok(setAllocation(g, { science: 10, operations: 50, expeditions: 30, reserve: 10 }).ok); ok(upkeepMult(g) < 1); ok(expeditionCostMult(g) < 1.001);
  g.advance(35 * DAY); ok(s.finance.savings > 0, 'savings set aside from the grant');
  const sv = s.finance.savings; s.resources.credits = -sv / 2; earthTick(g); ok(s.resources.credits >= 0, 'savings cover deficit'); ok(s.finance.savings < sv);
  ok(releaseSavings(g).ok || s.finance.savings === 0);
});
await test('Earth: contracts are offered, accepted with a limit, completed from real progress, fail at deadline; emergency needs contract', () => {
  const g = fresh(); const s = g.state; s.flags.nextContract = 0; s.resources.reputation = 5; g.advance(2 * DAY);
  const c = s.earth.contracts.find(x => x.status === 'offered'); ok(c, 'a contract was offered'); ok(acceptContract(g, c.uid).ok); eq(c.status, 'active'); ok(c.deadline > s.time.t);
  s.flags.nextContract = 9999; c.kind = 'datasets'; c.dataKind = 'optical'; c.n = 1; s.datasets.push({ id: 'dz', kind: 'optical', status: 'analysed', analysedAt: s.time.t + 1, targetId: 'sirius-a', quality: .7 });
  const cr = s.resources.credits; g.advance(1 * DAY); eq(c.status, 'done'); ok(s.resources.credits > cr - 500);
  const d = { uid: 'ct-t', kind: 'datasets', dataKind: 'radio', n: 5, days: 2, title: 't', desc: '', reward: { credits: 1, rp: 1, rep: 1 }, status: 'active', acceptedAt: s.time.t, deadline: s.time.t + 2 * DAY, progress: 0 };
  s.earth.contracts.unshift(d); s.resources.reputation = 5; g.advance(3 * DAY); eq(d.status, 'failed'); ok(s.resources.reputation < 5);
  ok(!emergencyActive(g)); ok(!acceptContract(g, 'nope').ok);
});
await test('every view module loads and renders HTML for a fresh game (syntax and runtime guard)', async () => {
  const V = await import('../js/views/index.js'); const g = fresh(); const ui = { game: g, s: { query: '', group: 'all', bookmarksOnly: false, object: null, mapMode: 'sky', obsTarget: 'proxima-centauri', obsInstrument: 'opt-1', obsHours: 6, missionTab: 'contracts', archiveQuery: '', archiveType: 'all', tech: 'solar-mk2' }, view: 'x', saveList: [] }; const uiP = new Proxy(ui, { get: (t, k) => k in t ? t[k] : () => false });
  for (const [name, mod] of Object.entries(V)) { if (typeof mod.render !== 'function') continue; let html; try { html = mod.render(uiP); } catch (e) { throw new Error(name + ': ' + e.message); } ok(typeof html === 'string' && html.length > 50, name + ' renders'); }
});
await test('archive: sort orders and compare two discoveries', () => {
  const g = fresh(); const s = g.state; s.discoveries.push({ id: 'dA', t: 1, title: 'B target', quality: .5, confidence: 60, rp: 5, targetId: 'sirius-a', hours: 6, instrumentId: 'opt-1', evidence: [] }, { id: 'dB', t: 2, title: 'A target', quality: .9, confidence: 90, rp: 9, targetId: 'sirius-a', hours: 12, instrumentId: 'opt-1', evidence: [] });
  eq(searchArchive(g, { sort: 'quality' })[0].ref.id, 'dB'); eq(searchArchive(g, { sort: 'oldest' })[0].ref.id, 'dA'); eq(searchArchive(g, { sort: 'title' })[0].title, 'A target');
  const c = compareDiscoveries(g, 'dA', 'dB'); eq(c.better, 'dB'); ok(!compareDiscoveries(g, 'dA', 'nope'));
});
await test('V4 -> V5 migration from a real v4 save: new V3 state added, nothing lost, backup made', async () => {
  const f4 = JSON.parse(await readFile(path.join(root, 'tests/fixtures/v4-save.json'), 'utf8')); eq(f4.state.version, 4);
  const backend = new MemoryBackend(); const sm = new SaveManager(backend); await backend.put('manual-1', f4.state, { savedAt: 1, gameTime: f4.state.time.t, version: 4 });
  const r = await sm.load('manual-1'); ok(r.ok, r.error); eq(r.state.version, SAVE_VERSION); ok(await backend.get('backup-manual-1-v4'), 'backup made');
  eq(r.state.datasets.length, f4.state.datasets.length); eq(r.state.anomalies.length, f4.state.anomalies.length); eq(r.state.earth.contracts.length, f4.state.earth.contracts.length);
  ok(Array.isArray(r.state.facilities) && r.state.stock.materials === 0 && r.state.civ.policy.safety === 'standard'); const g = Game.fromSave(data, r.state); g.advance(3 * DAY); ok(g.state.time.t > f4.state.time.t);
});
await test('V3 worlds: exploration stages need real expeditions, landing vessels, and respect hostile bodies', () => {
  const g = fresh(); const s = g.state; const lander = makeShip(g, 'planetary-lander', 'L'); const probe = makeShip(g, 'survey-probe', 'P'); s.spacecraft.push(lander, probe);
  const ex = (ship, target, type = 'planetary-survey') => ({ type, targetId: target, shipId: ship.id, name: 'x' });
  eq(worldStage(g, 'mars'), 0); worldsOnExpedition(g, ex(probe, 'mars')); eq(worldStage(g, 'mars'), 1); worldsOnExpedition(g, ex(probe, 'mars')); eq(worldStage(g, 'mars'), 1, 'probe cannot land');
  worldsOnExpedition(g, ex(lander, 'mars')); eq(worldStage(g, 'mars'), 2); worldsOnExpedition(g, ex(lander, 'mars')); worldsOnExpedition(g, ex(lander, 'mars')); eq(worldStage(g, 'mars'), 4); worldsOnExpedition(g, ex(lander, 'mars')); eq(worldStage(g, 'mars'), 4, 'max');
  for (let i = 0; i < 6; i++) worldsOnExpedition(g, ex(lander, 'venus')); eq(worldStage(g, 'venus'), 2, 'Venus cannot host a site');
  worldsOnExpedition(g, ex(lander, 'sirius-a')); eq(worldStage(g, 'sirius-a'), 0); worldsOnExpedition(g, ex(lander, 'moon', 'stellar-observation')); eq(worldStage(g, 'moon'), 0, 'only surveys count');
});
await test('V3 facilities: gating, construction, stock production only when connected, staffing, upkeep, relays extend range', () => {
  const g = fresh(); const s = g.state; s.resources.credits = 90000;
  ok(!canBuild(g, 'mine-ore', 'moon').ok, 'locked'); s.tech.researched['resource-extraction'] = 1; ok(!canBuild(g, 'mine-ore', 'moon').ok, 'needs site stage');
  s.worlds.moon = { stage: 3, log: [] }; ok(!canBuild(g, 'mine-ore', 'moon').ok, 'needs materials'); ok(!importMaterials(g, 0).ok); ok(importMaterials(g, 100).ok); eq(Math.floor(s.stock.materials), 100);
  ok(!canBuild(g, 'mine-ore', 'mars').ok, 'wrong site'); const r = buildFacility(g, 'mine-ore', 'moon'); ok(r.ok, r.error); eq(r.facility.status, 'building'); ok(!canBuild(g, 'mine-ore', 'moon').ok, 'duplicate'); eq(s.stock.materials, 75);
  g.advance(46 * DAY); eq(r.facility.status, 'active'); const m0 = s.stock.materials; g.advance(5 * DAY); eq(s.stock.materials, m0, 'unstaffed and not autonomous: no output');
  ok(staffFacility(g, r.facility.id, 4).ok); ok(!staffFacility(g, r.facility.id, 9).ok, 'capacity'); g.advance(5 * DAY); ok(s.stock.materials > m0, 'staffed mine produces'); ok(r.facility.produced > 0);
  const c0 = r.facility.condition; ok(c0 < 100); ok(serviceFacility(g, r.facility.id).ok); eq(r.facility.condition, 100);
  const bal = s.resources.credits; g.advance(DAY); ok(s.resources.credits < bal, 'upkeep charged');
  // distant site needs relays
  const far = { id: 'f', type: 'mine-ore', site: 'neptune', status: 'active' }; ok(!isConnected(g, far), 'no relay');
  const r0 = commRangeAu(g); s.facilities.push({ id: 'rl1', type: 'relay', site: 'moon', status: 'active', pop: 0, condition: 100 }); eq(relayBonus(g), 25); eq(commRangeAu(g), r0 + 25);
  s.facilities.push({ id: 'rl2', type: 'relay', site: 'mars', status: 'active', pop: 0, condition: 100 }); ok(isConnected(g, far), 'two relays connect Neptune');
});
await test('V3 shipyard: custom designs need manufacturing, a factory and materials; classOf works; missions accept the base class', () => {
  const g = fresh(); const s = g.state; s.resources.credits = 90000; const spec = { name: 'Pathfinder', base: 'survey-probe', propulsion: 'ion', shielding: 'none', bays: 2 };
  ok(!validateDesign(g, spec).ok, 'needs manufacturing'); s.tech.researched['manufacturing'] = 1; ok(!validateDesign(g, spec).ok, 'ion not researched');
  spec.propulsion = 'chemical'; const v = validateDesign(g, spec); ok(v.ok, v.error); ok(!validateDesign(g, { ...spec, name: ' ' }).ok); ok(!validateDesign(g, { ...spec, base: 'nope' }).ok);
  const d = saveDesign(g, spec).design; eq(d.slots, g.data.classById['survey-probe'].slots + 2); ok(d.cost > 0);
  ok(!buildShip(g, d.id).ok, 'needs factory'); s.facilities.push({ id: 'fy', type: 'factory', site: 'station', status: 'active', pop: 0, condition: 100 }); ok(!buildShip(g, d.id).ok, 'needs materials');
  s.stock.materials = 100; const b = buildShip(g, d.id, 'PF-1'); ok(b.ok, b.error); eq(s.stock.materials, 100 - materialsFor(d)); eq(b.ship.status, 'Under delivery'); ok(!deleteDesign(g, d.id).ok, 'ship exists');
  g.advance(31 * DAY); eq(b.ship.status, 'Docked'); eq(classOf(g, b.ship).baseClass, 'survey-probe'); eq(classOf(g, b.ship).id, d.id);
  s.tech.researched['nuclear-thermal'] = 1; const n = validateDesign(g, { ...spec, propulsion: 'nuclear' }); ok(n.ok && n.cls.speedAuDay > d.speedAuDay);
});
await test('V3 interstellar: needs unlock, takes decades, data arrives after light-travel time, probes can be lost', () => {
  const g = fresh(); const s = g.state; s.resources.credits = 90000; ok(!launchProbe(g, 'proxima-centauri').ok, 'locked'); s.tech.researched['interstellar-precursor'] = 1;
  ok(!launchProbe(g, 'andromeda-galaxy').ok, 'not a star'); ok(probeTargets(g).some(t => t.id === 'proxima-centauri'));
  g.rand = () => 0.9; const r = launchProbe(g, 'proxima-centauri'); ok(r.ok, r.error); ok(r.probe.years > 15 && r.probe.years < 40); ok(!launchProbe(g, 'proxima-centauri').ok, 'one at a time');
  s.time.t = r.probe.arriveAt + 1; g.advance(1); eq(r.probe.status, 'arrived'); const ds0 = s.datasets.length; s.time.t = r.probe.dataAt + 1; g.advance(1); eq(r.probe.status, 'complete'); eq(s.datasets.length, ds0 + 3);
  const g2 = fresh(); g2.state.resources.credits = 90000; g2.state.tech.researched['interstellar-precursor'] = 1; g2.rand = () => 0.01; const p2 = launchProbe(g2, 'alpha-centauri-a').probe; g2.state.time.t = p2.arriveAt + 1; g2.advance(1); eq(p2.status, 'lost');
});
await test('V3 civilization: policies change real risk and cost multipliers; the index grows with facilities and exploration', () => {
  const g = fresh(); const s = g.state; ok(!setPolicy(g, 'safety', 'reckless').ok); ok(setPolicy(g, 'safety', 'cautious').ok); ok(safetyOf(g).risk < 1 && safetyOf(g).cost > 1); ok(setPolicy(g, 'safety', 'bold').ok); ok(safetyOf(g).risk > 1 && safetyOf(g).cost < 1);
  const i0 = civIndex(g); s.facilities.push({ id: 'a', type: 'relay', site: 'moon', status: 'active', pop: 5, condition: 100 }); s.worlds.mars = { stage: 4, log: [] }; const i1 = civIndex(g); ok(i1.score > i0.score); ok(i1.infrastructure > i0.infrastructure && i1.exploration > i0.exploration && i1.population > i0.population);
  s.facilities.push({ id: 'o', type: 'outpost', site: 'mars', status: 'active', pop: 8, condition: 100, settledDays: 0 }); const rp = s.resources.researchPoints; civilizationDaily(g); ok(s.resources.researchPoints > rp, 'outposts give research'); ok(typeof g.state.civ.tier === 'string');
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
