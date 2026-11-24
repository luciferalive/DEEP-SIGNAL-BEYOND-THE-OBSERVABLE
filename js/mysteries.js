// V4 The Unknown: persistent mystery engine, evidence, hypotheses, anomaly network, decisions, rare events and unknown civilizations.
// LABELS: the observing methods, instruments and statistics are REAL-STYLE and SIMULATED. Every mystery arc, object and civilization is FICTIONAL.
// Each mystery has a hidden truth drawn when it starts. Evidence is noisy and can conflict. The player concludes; being wrong has consequences.
import { DAY } from './constants.js';
import { addCredits, spend } from './finance.js';
import { schedule, onSchedule } from './scheduler.js';
import { record } from './chronicle.js';
import { logTransmission } from './comms-network.js';
import { analysedCount } from './research-engine.js';
import { offerContract } from './earth.js';
import { civIndex, TIERS } from './civilization.js';

export const STAGES = ['DETECTION', 'VERIFICATION', 'CHARACTERIZATION', 'PATTERN ANALYSIS', 'SOURCE INVESTIGATION', 'HYPOTHESIS', 'CONCLUSION'];
export const CAUSES = { natural: 'Natural phenomenon', interference: 'Known interference', instrumental: 'Instrument artifact', unknown: 'Unknown source', artificial: 'Artificial origin (fictional)' };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const arcOf = (game, id) => game.data.mysteryArcs.find(a => a.id === id);
export const ms = game => game.state.mysteries;
export const getMystery = (game, id) => ms(game).list.find(m => m.id === id);
export const tierRank = name => TIERS.findIndex(t => t[1] === name);

function drawTruth(game, weights) {
  const e = Object.entries(weights); let r = game.rand() * e.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of e) { r -= w; if (r <= 0) return k; } return e[0][0];
}
export const doneCount = m => Object.values(m.clues).filter(c => c.status === 'done').length;
export function stageOf(m) {
  if (m.conclusion && m.status !== 'active') return 'CONCLUSION';
  const n = doneCount(m); return n >= 5 ? 'HYPOTHESIS' : STAGES[n];
}
export function tally(m) {
  const t = {}; let tot = 0; for (const e of m.evidence) { t[e.points] = (t[e.points] || 0) + e.weight; tot += e.weight; }
  const sorted = Object.entries(t).sort((a, b) => b[1] - a[1]);
  return { totals: t, total: tot, lead: sorted[0]?.[0] || null, share: sorted[0] && tot ? sorted[0][1] / tot : 0, support: c => (tot ? (t[c] || 0) / tot : 0) };
}

// ---- starting mysteries ----
export function arcEligible(game, arc) {
  const s = game.state; const day = s.time.t / DAY;
  if (ms(game).list.some(m => m.arc === arc.id)) return false;
  const u = arc.unlock || {};
  const linked = arc.links.some(l => { const m = ms(game).list.find(x => x.arc === l); return m && doneCount(m) >= 3; });
  if (linked) return true;
  if (day < (u.minDay || 0)) return false;
  if (u.tier && tierRank(civIndex(game).tier) < tierRank(u.tier)) return false;
  if (u.tech && !s.tech.researched[u.tech]) return false;
  return true;
}
export function startMystery(game, arcId, { seeded = false, from = null } = {}) {
  const arc = arcOf(game, arcId); if (!arc || ms(game).list.some(m => m.arc === arcId)) return null;
  const s = game.state; const m = { id: `my-${s.uid++}`, arc: arcId, status: 'active', startedAt: s.time.t, truth: drawTruth(game, arc.truthWeights), evidence: [], hypotheses: [], conclusion: null, published: false, secret: false, bonus: 0, followups: 0, seeded, from, clues: {}, decisionsPosted: [] };
  arc.clues.forEach((c, i) => { m.clues[c.id] = { status: i === 0 ? 'open' : 'locked' }; });
  ms(game).list.push(m);
  game.log(`New investigation opened: ${arc.title} (FICTIONAL storyline).`, 'warn');
  game.addMessage({ from: 'Science Office', subject: `New investigation: ${arc.title}`, body: `${arc.blurb} Open The Unknown to begin. This storyline is fictional; the observing methods are real-style.`, type: 'warn' });
  if (arc.theme === 'signal') logTransmission(game, { from: 'Deep space', to: 'Meridian Station', kind: 'Unusual signal', text: arc.blurb, delayMin: 0 });
  record(game, { kind: 'anomaly', title: `Investigation opened: ${arc.title}`, text: arc.blurb, major: true, ref: m.id });
  return m;
}

// ---- clues ----
function reqMet(game, arc, clue, m) {
  const st = clue.step; const s = game.state;
  if (st.kind === 'research') { if (!s.tech.researched[st.tech]) return `Needs technology: ${game.data.techById[st.tech]?.name || st.tech}.`;
    for (const [k, n] of Object.entries(st.data || {})) if (analysedCount(game, k) < n) return `Needs ${n} analysed ${k} datasets (you have ${analysedCount(game, k)}).`; }
  return null;
}
export function clueBlock(game, m, cid) {
  const arc = arcOf(game, m.arc); const clue = arc.clues.find(c => c.id === cid); const cs = m.clues[cid]; const s = game.state;
  if (m.status !== 'active') return 'Investigation is closed.'; if (cs.status === 'done') return 'Already done.'; if (cs.status === 'running') return 'In progress.'; if (cs.status === 'locked') return 'Complete the previous step first.';
  const st = clue.step;
  if (st.kind === 'observe') { const inst = s.instruments.find(i => i.kind === st.instrument && i.condition >= 15 && !isBusyInst(game, i)); if (!inst) return `Needs an available ${st.instrument} instrument.`; if (s.resources.credits < st.cost) return `Needs ${st.cost} RC.`; }
  if (st.kind === 'monitor' && s.resources.credits < st.cost) return `Needs ${st.cost} RC.`;
  return reqMet(game, arc, clue, m);
}
export const mysteryBusy = (game, inst) => !!ms(game)?.list.some(m => m.pending?.instrumentId === inst.id && m.pending.until > game.state.time.t);
export const isBusyInst = (game, inst) => mysteryBusy(game, inst) || game.state.observations.some(o => o.instrumentId === inst.id && o.status === 'running') || (game.state.events.responses || []).some(r => r.instrumentId === inst.id);
export function startClue(game, mid, cid) {
  const m = getMystery(game, mid); if (!m) return { ok: false, error: 'Unknown investigation.' };
  const why = clueBlock(game, m, cid); if (why) return { ok: false, error: why };
  const arc = arcOf(game, m.arc); const clue = arc.clues.find(c => c.id === cid); const st = clue.step; const s = game.state; const cs = m.clues[cid];
  if (m.pending && st.kind !== 'mission') return { ok: false, error: 'Another step of this investigation is already running.' };
  cs.status = 'running'; cs.startedAt = s.time.t;
  if (st.kind === 'observe') { const inst = s.instruments.find(i => i.kind === st.instrument && i.condition >= 15 && !isBusyInst(game, i)); spend(game, st.cost, `Investigation: ${clue.title}`); m.pending = { cid, instrumentId: inst.id, until: s.time.t + st.hours * 3600, q: inst.condition / 100 }; schedule(game, m.pending.until, 'mystery-clue', { mid, cid }); }
  else if (st.kind === 'monitor') { spend(game, st.cost, `Investigation: ${clue.title}`); m.pending = { cid, until: s.time.t + st.days * DAY, q: 0.7 }; schedule(game, m.pending.until, 'mystery-clue', { mid, cid }); }
  else if (st.kind === 'research') { m.pending = { cid, until: s.time.t + DAY, q: 0.8 }; schedule(game, m.pending.until, 'mystery-clue', { mid, cid }); }
  // mission: stays running until a matching expedition completes
  return { ok: true };
}
function reliability(game, m, q) {
  const s = game.state; let r = 0.55 + 0.2 * q + (m.bonus || 0) + (s.flags.priorityUntil > s.time.t ? 0.1 : 0) + game.techEffect('accuracy') * 0.5; m.bonus = 0; return clamp(r, 0.25, 0.92);
}
function pushEvidence(game, m, { cid, title, rel, text, kind = 'step' }) {
  const arc = arcOf(game, m.arc); const alts = Object.keys(CAUSES).filter(k => k !== m.truth); let points = m.truth;
  if (game.rand() > rel) points = alts[Math.floor(game.rand() * alts.length)];
  const clue = arc.clues.find(c => c.id === cid) || arc.clues[0];
  const ev = { t: game.state.time.t, cid, kind, title, weight: Math.round(rel * 100) / 100, points, text: text || clue.points[points] };
  m.evidence.push(ev); return ev;
}
function finishClue(game, m, cid, rel) {
  const arc = arcOf(game, m.arc); const clue = arc.clues.find(c => c.id === cid); const cs = m.clues[cid]; if (cs.status === 'done') return;
  m.pending = null; cs.status = 'done'; cs.doneAt = game.state.time.t; pushEvidence(game, m, { cid, title: clue.title, rel });
  const i = arc.clues.findIndex(c => c.id === cid); const nxt = arc.clues[i + 1]; if (nxt && m.clues[nxt.id].status === 'locked') m.clues[nxt.id].status = 'open';
  game.log(`${arc.title}: ${clue.title} complete.`, 'info');
  const stg = stageOf(m); const n = doneCount(m);
  if (n >= 3) revealObject(game, m);
  for (const d of game.data.decisionDefs) if (d.stage === STAGES[n] && !m.decisionsPosted.includes(d.id) && n < 5) { postDecision(game, m, d); }
  if (cid === 'characterise' || cid === 'source') propagateLinks(game, m);
  if (n === 5) game.log(`${arc.title}: all steps are done. You can now conclude the investigation.`, 'good');
  return stg;
}
onSchedule('mystery-clue', (game, { mid, cid }) => { const m = getMystery(game, mid); if (!m || m.status !== 'active' || m.clues[cid]?.status !== 'running') return; finishClue(game, m, cid, reliability(game, m, m.pending?.q ?? 0.7)); });
export function mysteriesOnExpedition(game, ex) {
  for (const m of ms(game).list) { if (m.status !== 'active') continue; const arc = arcOf(game, m.arc);
    for (const clue of arc.clues) { const cs = m.clues[clue.id]; if (clue.step.kind === 'mission' && cs.status === 'running' && ex.type === clue.step.expType && (ex.finishedAt ?? game.state.time.t) >= cs.startedAt) finishClue(game, m, clue.id, reliability(game, m, 0.75)); } }
}

// ---- objects, network ----
export function revealObject(game, m) {
  const arc = arcOf(game, m.arc); const L = ms(game).objects; if (L.some(o => o.id === `fx-${arc.id}`)) return;
  const o = arc.object; L.push({ distance_err_ly: null, distance_note: 'FICTIONAL value', distance_au: null, redshift: null, spectral_type: null, mass: null, radius: null, temperature_k: null, luminosity_lsun: null, parent: null, id: `fx-${arc.id}`, designation: o.designation, name: o.name, classification: o.classification, group: 'unknown', category: 'fictional', ra_deg: o.ra_deg, dec_deg: o.dec_deg, distance_ly: o.distance_ly, characteristics: o.characteristics, discovery: `Detected during the investigation ${arc.title}`, references: [], source: 'FICTIONAL storyline object', last_verified: null, mystery: m.id, extra: [] });
  game.log(`New catalogue entry (FICTIONAL): ${o.name}.`, 'info');
}
export const fictionalObjects = game => ms(game).objects;
export function propagateLinks(game, m) {
  const arc = arcOf(game, m.arc);
  for (const lid of arc.links) { const o = ms(game).list.find(x => x.arc === lid); if (!o || o.status !== 'active' || o.crossRef?.includes(m.arc)) continue;
    (o.crossRef ||= []).push(m.arc); const oa = arcOf(game, o.arc); const shared = arc.tags.filter(t => oa.tags.includes(t)).join(', ') || 'the same region of sky';
    pushEvidence(game, o, { cid: oa.clues[0].id, kind: 'link', title: `Cross-reference: ${arc.title}`, rel: 0.5, text: `Shared characteristics with ${arc.title} (${shared}) bear on this case.` });
    game.log(`A link was found between ${arc.title} and ${oa.title}.`, 'good'); }
}
export function networkLinks(game) {
  const L = []; const seen = new Set();
  for (const a of game.data.mysteryArcs) for (const l of a.links) { const k = [a.id, l].sort().join('|'); if (seen.has(k)) continue; seen.add(k); const ma = ms(game).list.find(m => m.arc === a.id), mb = ms(game).list.find(m => m.arc === l); if (ma && mb) L.push({ a: a.id, b: l, live: !!(ma.crossRef?.includes(l) || mb.crossRef?.includes(a.id)) }); }
  return L;
}

// ---- follow-ups and hypotheses ----
export const FOLLOWUP = { observation: { label: 'Additional observation', cost: 200, days: 5, rel: 0.55, fail: 0 }, experiment: { label: 'Experiment', cost: 500, days: 10, rel: 0.8, fail: 0.1 } };
export function requestFollowup(game, mid, kind) {
  const m = getMystery(game, mid); const f = FOLLOWUP[kind]; if (!m || !f) return { ok: false, error: 'Unknown request.' };
  if (m.status !== 'active') return { ok: false, error: 'Investigation is closed.' }; if (!m.evidence.length) return { ok: false, error: 'Collect initial evidence first.' };
  if (m.pending) return { ok: false, error: 'A step is already running.' }; if (m.followups >= 6) return { ok: false, error: 'No further follow-ups are practical.' };
  if (!spend(game, f.cost, `Investigation ${f.label.toLowerCase()}`)) return { ok: false, error: `Needs ${f.cost} RC.` };
  m.followups++; m.pending = { cid: 'followup', kind, until: game.state.time.t + f.days * DAY }; schedule(game, m.pending.until, 'mystery-followup', { mid, kind }); return { ok: true };
}
onSchedule('mystery-followup', (game, { mid, kind }) => {
  const m = getMystery(game, mid); if (!m || m.status !== 'active') return; const f = FOLLOWUP[kind]; m.pending = null;
  if (game.rand() < f.fail) { game.log(`The ${f.label.toLowerCase()} failed: the sample was spoiled.`, 'bad'); return; }
  pushEvidence(game, m, { cid: 'detect', kind: 'followup', title: f.label, rel: reliability(game, m, f.rel) }); game.log(`${f.label} added evidence to ${arcOf(game, m.arc).title}.`, 'info');
});
export function proposeHypothesis(game, mid, cause, confidence) {
  const m = getMystery(game, mid); if (!m || m.status !== 'active') return { ok: false, error: 'Investigation is closed.' };
  if (!CAUSES[cause]) return { ok: false, error: 'Unknown explanation.' }; confidence = Math.round(+confidence); if (!(confidence >= 1 && confidence <= 99)) return { ok: false, error: 'Confidence must be 1 to 99.' };
  if (m.evidence.length < 2) return { ok: false, error: 'A hypothesis needs at least two pieces of evidence.' };
  const sup = Math.round(tally(m).support(cause) * 100) / 100; const ex = m.hypotheses.find(h => h.cause === cause);
  if (ex) { ex.confidence = confidence; ex.support = sup; ex.revised = (ex.revised || 0) + 1; ex.t = game.state.time.t; } else m.hypotheses.push({ cause, confidence, support: sup, t: game.state.time.t, revised: 0 });
  return { ok: true };
}
export function withdrawHypothesis(game, mid, cause) { const m = getMystery(game, mid); if (!m) return { ok: false, error: 'Unknown.' }; m.hypotheses = m.hypotheses.filter(h => h.cause !== cause); return { ok: true }; }

// ---- conclusion ----
export const confirmedArtificial = m => tally(m).support('artificial') >= 0.55 && m.evidence.length >= 6;
export function conclude(game, mid, cause) {
  const m = getMystery(game, mid); const s = game.state; if (!m || m.status !== 'active') return { ok: false, error: 'Investigation is closed.' };
  if (doneCount(m) < 5) return { ok: false, error: 'Finish all investigation steps first.' }; const h = m.hypotheses.find(x => x.cause === cause);
  if (!h) return { ok: false, error: 'State a hypothesis for that explanation first.' }; if (h.confidence < 40) return { ok: false, error: 'Confidence below 40%: gather more evidence or revise.' };
  const arc = arcOf(game, m.arc); const correct = cause === m.truth; const conf = h.confidence / 100; const art = cause === 'artificial'; const strong = art && confirmedArtificial(m);
  m.conclusion = { cause, confidence: h.confidence, t: s.time.t, label: art ? (strong ? 'Confirmed fictional intelligence' : 'Artificial origin candidate') : CAUSES[cause] };
  m.status = 'concluded'; m.concludedAt = s.time.t;
  if (correct) {
    const rp = 60 + 10 * m.evidence.length; const rep = 1 + Math.round(3 * conf); s.resources.researchPoints += rp; s.resources.reputation += rep;
    game.log(`${arc.title} concluded: ${m.conclusion.label}. +${rp} RP, +${rep} reputation.`, 'good');
    if (art && strong) createCivilization(game, m);
    for (const l of arc.links) { const o = ms(game).list.find(x => x.arc === l); if (o && o.status === 'active') pushEvidence(game, o, { cid: arcOf(game, o.arc).clues[0].id, kind: 'link', title: `Conclusion of ${arc.title}`, rel: 0.6, text: `The conclusion of ${arc.title} (${m.conclusion.label.toLowerCase()}) constrains this case.` }); }
    if (art && strong && !m.decisionsPosted.includes('reveal-or-secrecy')) { const d = game.data.decisionDefs.find(x => x.id === 'reveal-or-secrecy'); if (d) postDecision(game, m, d); }
  } else {
    const loss = 1 + Math.round(2 * conf); s.resources.reputation = Math.max(0, s.resources.reputation - loss); m.status = 'disputed';
    game.log(`${arc.title}: your conclusion (${m.conclusion.label}) is disputed by reviewers. Reputation -${loss}. Review in 40 days.`, 'bad'); schedule(game, s.time.t + 40 * DAY, 'mystery-review', { mid });
  }
  if (m.published && !correct) { s.resources.reputation = Math.max(0, s.resources.reputation - 3); game.log('Your preliminary publication has to be retracted. Reputation -3.', 'bad'); }
  record(game, { kind: 'anomaly', title: `${arc.title}: ${m.conclusion.label}${correct ? '' : ' (disputed)'}`, text: correct ? 'The investigation reached a conclusion.' : 'Reviewers disagree with the conclusion.', major: correct && art, ref: m.id });
  return { ok: true, correct };
}
onSchedule('mystery-review', (game, { mid }) => { const m = getMystery(game, mid); if (!m || m.status !== 'disputed') return; m.reviewNote = `Reviewers found a different cause: ${CAUSES[m.truth].toLowerCase()}.`; game.log(`Review of ${arcOf(game, m.arc).title}: the true cause was ${CAUSES[m.truth].toLowerCase()}.`, 'warn'); });
export function reopenMystery(game, mid) {
  const m = getMystery(game, mid); if (!m || m.status !== 'disputed') return { ok: false, error: 'Only disputed cases can be re-opened.' };
  m.status = 'active'; m.conclusion = null; m.reviewNote = null; m.hypotheses = []; return { ok: true };
}

// ---- unknown civilizations (FICTIONAL) ----
export function createCivilization(game, m) {
  const arc = arcOf(game, m.arc); const c = arc.civ || { name: `Unknown civilization (${arc.title})`, distanceLy: arc.object.distance_ly, disposition: 'curious', reason: 'An unseen source with a consistent, designed emission.' };
  if (ms(game).civs.some(x => x.mid === m.id)) return; const id = `civ-${game.state.uid++}`;
  ms(game).civs.push({ id, mid: m.id, name: c.name, distanceLy: c.distanceLy, disposition: c.disposition, reason: c.reason, contacts: [], known: { location: true, technology: false, intent: false } });
  game.log(`A fictional civilization has been identified: ${c.name}.`, 'good'); record(game, { kind: 'anomaly', title: `Evidence of an unknown civilization: ${c.name}`, text: c.reason, major: true, ref: id });
}
export const MESSAGES = { greeting: { label: 'Simple greeting', cost: 300 }, mathematics: { label: 'Mathematical sequence', cost: 500 } };
export function transmit(game, civId, kind) {
  const c = ms(game).civs.find(x => x.id === civId); const msg = MESSAGES[kind]; if (!c || !msg) return { ok: false, error: 'Unknown target or message.' };
  if (c.contacts.some(x => x.status === 'sent')) return { ok: false, error: 'A message is still in transit.' };
  if (!spend(game, msg.cost, `Transmission: ${msg.label} to ${c.name}`)) return { ok: false, error: `Needs ${msg.cost} RC.` };
  const years = c.distanceLy; const sentAt = game.state.time.t; const reply = c.disposition !== 'silent' && (c.disposition === 'curious' || kind === 'mathematics');
  const ct = { id: `ct-${game.state.uid++}`, kind, sentAt, replyAt: reply ? sentAt + 2 * years * 365.25 * DAY : null, status: 'sent' }; c.contacts.push(ct);
  logTransmission(game, { from: 'Meridian Station', to: c.name, kind: msg.label, text: `Sent. Round trip would take ${(2 * years).toLocaleString('en-US')} years.`, delayMin: years * 525960 });
  if (reply) schedule(game, ct.replyAt, 'civ-reply', { civId, ctId: ct.id }); return { ok: true, years: 2 * years, expectsReply: reply };
}
onSchedule('civ-reply', (game, { civId, ctId }) => {
  const c = ms(game).civs.find(x => x.id === civId); const ct = c?.contacts.find(x => x.id === ctId); if (!ct) return; ct.status = 'replied'; c.known.technology = true; c.known.intent = true;
  game.state.resources.researchPoints += 200; game.state.resources.reputation += 5; game.log(`A reply has arrived from ${c.name}. +200 RP, +5 reputation.`, 'good');
  record(game, { kind: 'anomaly', title: `Reply received from ${c.name}`, text: 'The first answer to a message sent across the stars.', major: true, ref: c.id });
});

// ---- decisions ----
export function postDecision(game, m, def) {
  const d = ms(game).decisions; m.decisionsPosted.push(def.id); const t = game.state.time.t;
  d.pending.push({ uid: `dc-${game.state.uid++}`, mid: m.id, did: def.id, postedAt: t, expiresAt: t + 20 * DAY });
  game.log(`Decision needed: ${def.title} (${arcOf(game, m.arc).title}).`, 'warn'); game.addMessage({ from: 'Science Office', subject: `Decision: ${def.title}`, body: def.text, type: 'warn' });
}
export function defaultOption(def) { const i = def.options.findIndex(o => !Object.keys(o.effects).length); return i >= 0 ? i : def.options.length - 1; }
export function resolveDecision(game, uid, idx, auto = false) {
  const d = ms(game).decisions; const p = d.pending.find(x => x.uid === uid); if (!p) return { ok: false, error: 'Unknown decision.' };
  const def = game.data.decisionDefs.find(x => x.id === p.did); const opt = def?.options[idx]; if (!opt) return { ok: false, error: 'Choose an option.' };
  const m = getMystery(game, p.mid); const e = opt.effects; const s = game.state;
  if (e.credits < 0 && s.resources.credits < -e.credits) return { ok: false, error: `Needs ${-e.credits} RC.` };
  if (e.credits < 0) spend(game, -e.credits, `Decision: ${def.title}`); else if (e.credits > 0) addCredits(game, e.credits, `Decision: ${def.title}`, 'income');
  if (e.rep) s.resources.reputation = Math.max(0, s.resources.reputation + e.rep); if (e.rp) s.resources.researchPoints += e.rp;
  if (e.priorityDays) s.flags.priorityUntil = s.time.t + e.priorityDays * DAY; if (e.reliabilityBonus && m) m.bonus = (m.bonus || 0) + e.reliabilityBonus;
  if (e.crewStress) for (const c of s.crew) c.morale = Math.max(0, c.morale - e.crewStress);
  if (e.retractionRisk && m) m.published = true;
  if (e.secrecy && m) { m.secret = true; schedule(game, s.time.t + 120 * DAY, 'secret-leak', { mid: m.id }); }
  if (e.experiment && m) { if (game.rand() < 0.3 && m.evidence.length) { const i = m.evidence.reduce((b, x, k, a) => (x.weight > a[b].weight ? k : b), 0); m.evidence.splice(i, 1); game.log('The experiment destroyed the best evidence item without a result.', 'bad'); } else { pushEvidence(game, m, { cid: 'source', kind: 'experiment', title: 'Destructive experiment', rel: 0.9 }); game.log('The experiment produced strong evidence.', 'good'); } }
  d.pending = d.pending.filter(x => x.uid !== uid); d.history.unshift({ uid, mid: p.mid, did: p.did, choice: opt.label, auto, t: s.time.t }); if (d.history.length > 40) d.history.length = 40;
  record(game, { kind: 'anomaly', title: `Decision: ${def.title}`, text: `${opt.label}${auto ? ' (no decision was made in time)' : ''}`, ref: p.mid });
  return { ok: true };
}
onSchedule('secret-leak', (game, { mid }) => { const m = getMystery(game, mid); if (!m || !m.secret) return; if (game.rand() < 0.35) { game.state.resources.reputation = Math.max(0, game.state.resources.reputation - 3); m.secret = false; game.log('The secret leaked. Reputation -3.', 'bad'); } });

// ---- rare events ----
export function rareEvent(game, id) {
  const ev = game.data.rareEvents.find(e => e.id === id); if (!ev) return false; const s = game.state;
  game.log(`${ev.title} [${ev.label}].`, 'warn'); game.addMessage({ from: 'Cosmic Watch', subject: ev.title, body: `${ev.text} (${ev.label})`, type: 'warn' });
  record(game, { kind: 'event', title: ev.title, text: `${ev.label}. ${ev.text}`, major: ev.seedMystery, ref: ev.id });
  if (ev.contract) offerContract(game, { id: ev.id, ...ev.contract });
  if (ev.seedMystery) { const free = game.data.mysteryArcs.filter(a => !ms(game).list.some(m => m.arc === a.id)); if (free.length) startMystery(game, free[Math.floor(game.rand() * free.length)].id, { seeded: true }); }
  s.mysteries.rareLog.unshift({ t: s.time.t, id }); if (s.mysteries.rareLog.length > 20) s.mysteries.rareLog.length = 20; return true;
}
export function mysteriesTick(game) {
  const s = game.state; const M = ms(game); const day = Math.floor(s.time.t / DAY);
  for (const p of [...M.decisions.pending]) if (s.time.t > p.expiresAt) { const def = game.data.decisionDefs.find(x => x.id === p.did); resolveDecision(game, p.uid, defaultOption(def), true); }
  if (day >= (M.nextStart ?? 15) && M.list.filter(m => m.status === 'active').length < 3) {
    const el = game.data.mysteryArcs.filter(a => arcEligible(game, a)); M.nextStart = day + 20 + Math.floor(game.rand() * 20);
    if (el.length) startMystery(game, el[Math.floor(game.rand() * el.length)].id);
  }
  if (day >= (M.nextRare ?? 90)) { M.nextRare = day + 90 + Math.floor(game.rand() * 150);
    const have = new Set(s.instruments.map(i => i.kind)); const pool = game.data.rareEvents.filter(e => !e.needsKind || have.has(e.needsKind));
    const tot = pool.reduce((a, e) => a + e.weight, 0); let r = game.rand() * tot; for (const e of pool) { r -= e.weight; if (r <= 0) { rareEvent(game, e.id); break; } } }
}
