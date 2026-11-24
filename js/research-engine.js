import { rpMult } from './earth.js';
// Research laboratory: dataset analysis and technology projects.
import { DAY } from './constants.js';
import { getObject } from './astronomy-database.js';
import { workRates } from './crew-management.js';
import { spend } from './finance.js';
import { recordDiscovery } from './discovery-archive.js';
import { record } from './chronicle.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const REQUIRED_WORK = { solar: 30, star: 40, nebula: 44, galaxy: 56, compact: 56, exoplanet: 40 };
const RP_BASE = { solar: 4, smallbody: 6, star: 8, cluster: 9, nebula: 10, galaxy: 14, compact: 16, exoplanet: 12 };
const DATA_KIND = { xray: 'highenergy', gamma: 'highenergy', neutrino: 'highenergy' };
// Analysed datasets by kind (used by technologies that need real data behind them).
export function analysedCount(game, kind) { return game.state.datasets.filter(d => d.status === 'analysed' && (DATA_KIND[d.kind] || d.kind) === kind).length; }

export const analysisRate = game => (workRates(game).research / 4) * (1 + game.techEffect('analysisSpeed') + game.moduleEffect('analysisSpeed'));

export function startAnalysis(game, datasetId) {
  const s = game.state; const ds = s.datasets.find(d => d.id === datasetId);
  if (!ds) return { ok: false, error: 'Unknown dataset.' };
  if (ds.status !== 'raw') return { ok: false, error: 'This dataset has already been analysed or is being analysed.' };
  if (workRates(game).research <= 0) return { ok: false, error: 'Assign at least one healthy crew member to Research and analysis.' };
  if (s.analyses.filter(a => a.status === 'active').length >= 3) return { ok: false, error: 'The laboratory can run at most three analyses at once.' };
  const obj = getObject(game.data.db, ds.targetId);
  const a = { id: `a-${s.uid++}`, datasetId, targetId: ds.targetId, progress: 0, required: REQUIRED_WORK[obj.group] || 40, status: 'active', startedAt: s.time.t };
  s.analyses.unshift(a); ds.status = 'analysing';
  game.log(`Analysis of ${obj.name} data started.`, 'info');
  return { ok: true, analysis: a };
}

export function researchTick(game, dt) {
  const s = game.state; const active = s.analyses.filter(a => a.status === 'active');
  if (active.length) {
    const share = analysisRate(game) / active.length;
    for (const a of active) { a.progress += share * (dt / 3600); if (a.progress >= a.required) completeAnalysis(game, a); }
  }
  if (s.analyses.length > 80) s.analyses.length = 80;
  const t = s.tech.active;
  if (t) {
    const speed = clamp(workRates(game).research / 8, 0, 2) * (1 + game.moduleEffect('analysisSpeed'));
    t.progress += (dt / DAY) * speed;
    if (t.progress >= t.days) completeTech(game, t);
  }
}

function completeAnalysis(game, a) {
  const s = game.state; a.status = 'done'; a.finishedAt = s.time.t;
  const ds = s.datasets.find(d => d.id === a.datasetId); ds.status = 'analysed'; ds.analysedAt = s.time.t; s.stats.analyses += 1;
  const obj = getObject(game.data.db, a.targetId);
  const first = !s.discoveries.some(d => d.targetId === a.targetId);
  const rp = Math.round((RP_BASE[obj.group] || 6) * (0.5 + ds.quality) * (first ? 2 : 1) * rpMult(game));
  s.resources.researchPoints += rp;
  recordDiscovery(game, { ds, obj, first, rp });
}

export function canStartTech(game, techId) {
  const s = game.state; const tech = game.data.techById[techId];
  if (!tech) return { ok: false, error: 'Unknown technology.' };
  if (s.tech.researched[techId]) return { ok: false, error: 'Already researched.' };
  if (s.tech.active) return { ok: false, error: 'A research project is already in progress.' };
  const missing = tech.requires.filter(r => !s.tech.researched[r]);
  if (missing.length) return { ok: false, error: `Requires: ${missing.map(m => game.data.techById[m]?.name || m).join(', ')}.` };
  if (workRates(game).research <= 0) return { ok: false, error: 'Assign at least one healthy crew member to Research and analysis.' };
  for (const [k, n] of Object.entries(tech.data || {})) { const have = analysedCount(game, k); if (have < n) return { ok: false, error: `Needs ${n} analysed ${k} dataset${n > 1 ? 's' : ''} (you have ${have}).` }; }
  if (s.resources.researchPoints < tech.costRP) return { ok: false, error: `Needs ${tech.costRP} research points.` };
  if (s.resources.credits < tech.costCredits) return { ok: false, error: `Needs ${tech.costCredits} RC.` };
  return { ok: true };
}
export function startTech(game, techId) {
  const c = canStartTech(game, techId); if (!c.ok) return c;
  const tech = game.data.techById[techId]; const s = game.state;
  spend(game, tech.costCredits, `Research: ${tech.name}`); s.resources.researchPoints -= tech.costRP;
  s.tech.active = { id: techId, progress: 0, days: tech.days, startedAt: s.time.t };
  game.log(`Research started: ${tech.name}.`, 'info');
  return { ok: true };
}
function completeTech(game, t) {
  const s = game.state; const tech = game.data.techById[t.id];
  s.tech.researched[t.id] = s.time.t; s.tech.active = null;
  game.log(`Research complete: ${tech.name}. ${tech.effectText}.`, 'good');
  record(game, { kind: 'technology', title: `Technology: ${tech.name}`, text: tech.effectText, major: true, ref: t.id });
  game.addMessage({ from: 'Meridian Station Laboratory', subject: `Research complete: ${tech.name}`, body: `${tech.description} Effect: ${tech.effectText}. Limitation: ${tech.limitation}`, type: 'info', fictional: false });
}
