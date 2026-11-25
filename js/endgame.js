// V5.8 Endgame, V5.9 Continuous universe and V5.7 Universe memory.
// There is no final boss: civilization-scale achievements mark eras, and the simulation keeps producing mysteries, contracts and research.
import { DAY } from './constants.js';
import { spend } from './finance.js';
import { record } from './chronicle.js';
import { offerContract } from './earth.js';
import { ms, startMystery, arcEligible } from './mysteries.js';
import { surveyedIds, explorationRadiusLy } from './galaxy.js';
import { activeFacilities } from './civilization.js';

// ---- achievements ----
const FRONTIER_TECHS = ['quantum-gravity', 'spacetime-topology', 'exotic-matter', 'advanced-cosmological-models', 'extreme-gravity', 'wormhole-theory', 'spacetime-engineering', 'unified-cosmology', 'antimatter-research', 'spacetime-drive-concept'];
export const METRICS = {
  sectors: g => surveyedIds(g).length, radius: g => explorationRadiusLy(g), colonies: g => g.state.colonies.filter(c => c.status === 'active').length,
  netsystems: g => { const A = g.state.colonies.filter(c => c.status === 'active'); return new Set(A.map(c => c.systemId)).size >= 2 && A.some(c => c.type === 'station') ? 2 : new Set(A.map(c => c.systemId)).size; },
  autonomous: g => (g.unlocked('ops:fleets') ? activeFacilities(g).filter(f => !f.pop && g.data.facilityById[f.type].staffCap).length + activeFacilities(g, 'relay').length : 0),
  solved: g => ms(g).list.filter(m => m.status === 'concluded' && m.conclusion?.cause === m.truth).length,
  frontier: g => FRONTIER_TECHS.filter(t => g.state.tech.researched[t]).length,
  replies: g => ms(g).civs.reduce((a, c) => a + c.contacts.filter(x => x.status === 'replied').length, 0),
  decode: g => Math.max(0, ...ms(g).civs.map(c => c.decode?.progress || 0)),
  edge: g => ms(g).list.filter(m => m.arc === 'the-edge' && m.status === 'concluded' && m.conclusion?.cause === m.truth).length
};
export const ERAS = [[0, 'Frontier Programme'], [2, 'Deep Space Society'], [4, 'Interstellar Network'], [7, 'Beyond the Observable'], [10, 'Beyond the Observable (complete)']];
export const achievementProgress = g => g.data.achievementDefs.map(a => ({ ...a, value: Math.min(a.target, METRICS[a.metric](g)), done: g.state.achievements.done[a.id] != null }));
export const eraOf = g => { const n = Object.keys(g.state.achievements.done).length; return [...ERAS].reverse().find(([m]) => n >= m)[1]; };
function achievementsTick(g) {
  const s = g.state;
  for (const a of g.data.achievementDefs) { if (s.achievements.done[a.id] != null) continue; if (METRICS[a.metric](g) < a.target) continue;
    s.achievements.done[a.id] = s.time.t; s.resources.reputation += a.reward.rep; s.resources.researchPoints += a.reward.rp;
    g.log(`Achievement: ${a.title}. +${a.reward.rep} reputation, +${a.reward.rp} RP. The universe keeps going.`, 'good'); g.addMessage({ from: 'Earth Mission Control', subject: `Achievement: ${a.title}`, body: `${a.text} (${a.label})`, type: 'good' });
    record(g, { kind: 'civilization', title: `Achievement: ${a.title}`, text: a.text, major: true, ref: a.id }); }
  const era = eraOf(g); if (s.achievements.era !== era) { if (s.achievements.era) record(g, { kind: 'civilization', title: `A new era: ${era}`, text: 'Civilization-scale achievements mark a new era.', major: true }); s.achievements.era = era; }
}

// ---- procedural mysteries (continuous universe) ----
export function generateArc(game) {
  const T = game.data.mysteryTemplates; const s = game.state; const M = ms(game); const r = () => game.rand(); const pick = a => a[Math.floor(r() * a.length)];
  const v = pick(T.vocab); let title, tries = 0; do { title = `THE ${pick(T.adjectives)} ${pick(T.nouns)}`.toUpperCase(); tries++; } while (tries < 20 && [...game.data.mysteryArcs, ...M.generated].some(a => a.title === title));
  const n = M.generated.length + 1; const j = () => 0.6 + r() * 0.8; const w = { natural: 0.3 * j(), interference: 0.08 * j(), instrumental: 0.15 * j(), unknown: 0.25 * j(), artificial: 0.12 * j() }; const tot = Object.values(w).reduce((a, b) => a + b, 0); for (const k in w) w[k] = Math.round(w[k] / tot * 100) / 100;
  const steps = { detect: { kind: 'observe', instrument: v.kind1, hours: 12, cost: 80 }, verify: { kind: 'observe', instrument: v.kind2, hours: 24, cost: 160 }, characterise: { kind: 'research', tech: v.tech, data: { [v.data]: 2 } }, pattern: { kind: 'monitor', days: 30, cost: 300 }, source: { kind: 'mission', expType: v.exp } };
  const fill = (t) => t.replace(/\{s\}/g, v.s).replace(/\{n\}/g, v.n).replace(/\{a\}/g, v.a);
  const dist = Math.round(10 + r() * 3000);
  return { id: `gen-${n}`, title, theme: v.theme, blurb: `An unexplained ${v.s} has turned up in survey data.`, truthWeights: w, tags: v.tags, links: [], unlock: {}, generated: true, label: 'FICTIONAL storyline (procedurally generated)',
    object: { name: `GX-${n} (${title.toLowerCase()})`, designation: `GX-${n}`, classification: 'Unexplained feature', group: 'unknown', ra_deg: Math.round(r() * 3600) / 10, dec_deg: Math.round((r() * 160 - 80) * 10) / 10, distance_ly: dist, characteristics: 'FICTIONAL. Generated for a continuing investigation.' }, civ: null,
    clues: T.stages.map(st => ({ id: st, title: T.titles[st], step: steps[st], points: Object.fromEntries(T.truths.map(k => [k, fill(T.clues[st][k])])) })) };
}
export const refineCost = g => ({ rp: 300 + 150 * (g.state.refinements || 0), rc: 1000 + 400 * (g.state.refinements || 0) });
export function refine(game) {
  const s = game.state; if (Object.keys(s.tech.researched).length < 30) return { ok: false, error: 'Needs 30 researched technologies.' }; if ((s.refinements || 0) >= 25) return { ok: false, error: 'Methods cannot be refined further.' };
  const c = refineCost(game); if (s.resources.researchPoints < c.rp) return { ok: false, error: `Needs ${c.rp} research points.` };
  if (!spend(game, c.rc, 'Continuous methods improvement')) return { ok: false, error: `Needs ${c.rc} RC.` };
  s.resources.researchPoints -= c.rp; s.refinements = (s.refinements || 0) + 1; game.log(`Methods refined (level ${s.refinements}): +2% data yield.`, 'good'); return { ok: true };
}
export function continuousDaily(game) {
  const s = game.state; const M = ms(game); const day = Math.floor(s.time.t / DAY); achievementsTick(game);
  const staticDone = game.data.mysteryArcs.every(a => M.list.some(m => m.arc === a.id));
  if (staticDone && M.list.filter(m => m.status === 'active').length < 3 && day >= (s.flags.nextGen ?? 0)) { s.flags.nextGen = day + 60 + Math.floor(game.rand() * 60); const a = generateArc(game); M.generated.push(a); startMystery(game, a.id); }
  if (game.unlocked('galaxy:survey') && day >= (s.flags.nextSectorContract ?? 0)) { s.flags.nextSectorContract = day + 90 + Math.floor(game.rand() * 60); offerContract(game, { id: 'sector', kind: 'sectors', n: 1, days: 70, title: 'Map a new sector', desc: 'Complete the survey of one additional galactic sector.', reward: { credits: 2500, rp: 60, rep: 2 } }); }
}

// ---- universe memory (V5.7) ----
export function memorySummary(game) {
  const s = game.state; const chron = s.chronicle; const first = k => chron.filter(e => e.kind === k).sort((a, b) => a.t - b.t)[0];
  const byKind = {}; for (const e of chron) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  return { years: Math.max(0, (s.time.t / DAY) / 365.25), entries: chron.length, byKind, major: chron.filter(e => e.major).length,
    ledger: [['Celestial discoveries', s.discoveries.length], ['Observations', s.observations.length], ['Missions and expeditions', s.missions.completed.length + s.expeditions.filter(e => e.status === 'COMPLETED').length], ['Civilizations', ms(game).civs.length], ['Stations and facilities', s.facilities.length + 1], ['Settlements and colonies', s.colonies.filter(c => c.status === 'active').length + s.facilities.filter(f => f.type === 'outpost').length],
      ['Publications', (s.publications || []).length], ['Technologies', Object.keys(s.tech.researched).length], ['Anomalies', s.anomalies.length + ms(game).list.length], ['Cosmic events', (s.events.history || []).length + ms(game).rareLog.length], ['Sectors explored', surveyedIds(game).length], ['Milestones', chron.filter(e => e.major).length]],
    firsts: [['mission', 'First mission'], ['discovery', 'First discovery'], ['technology', 'First technology'], ['infrastructure', 'First facility'], ['exploration', 'First sector mapped'], ['civilization', 'First civilization-scale event']].map(([k, l]) => [l, first(k)]).filter(([, e]) => e) };
}
