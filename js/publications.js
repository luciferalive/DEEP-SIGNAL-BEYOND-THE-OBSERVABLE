// Scientific publications: DATA COLLECTION → ANALYSIS → VALIDATION → PUBLICATION. Validation can fail; evidence quality matters.
import { DAY } from './constants.js';
import { workRates } from './crew-management.js';
import { spend } from './finance.js';
import { record } from './chronicle.js';
import { getObject } from './astronomy-database.js';

export const STAGES = ['Data collection', 'Analysis', 'Validation', 'Publication'];
export const TYPES = {
  preliminary: { label: 'Preliminary report', days: [0.5, 1, 1.5, 1], cost: 40, threshold: 40, reward: { rp: 5, rep: 0.5, credits: 0 } },
  mission: { label: 'Mission report', days: [0.5, 1.5, 2, 1], cost: 80, threshold: 40, reward: { rp: 8, rep: 1, credits: 100 } },
  paper: { label: 'Scientific paper', days: [1, 4, 5, 2], cost: 200, threshold: 62, reward: { rp: 15, rep: 2, credits: 250 } },
  anomaly: { label: 'Anomaly report', days: [0.5, 2, 2, 1], cost: 100, threshold: 45, reward: { rp: 6, rep: 1, credits: 80 } },
  major: { label: 'Major discovery', days: [2, 8, 8, 2], cost: 400, threshold: 72, reward: { rp: 30, rep: 5, credits: 800 } }
};
const used = (s, type, src) => s.publications.some(p => p.type === type && p.sourceId === src && p.status !== 'returned');

// Every possible publication, with whether it can start now and why not.
export function sources(game) {
  const s = game.state; const out = [];
  const nm = id => getObject(game.data.db, id)?.name || id;
  for (const d of s.discoveries) {
    out.push({ type: 'preliminary', sourceId: d.id, label: d.title, confidence: d.confidence, ok: !used(s, 'preliminary', d.id) && d.confidence >= 40, reason: used(s, 'preliminary', d.id) ? 'Already written.' : 'Confidence below 40%.' });
    const verified = d.verification === 'verified' && d.confidence >= 70;
    out.push({ type: 'major', sourceId: d.id, label: d.title, confidence: d.confidence, ok: !used(s, 'major', d.id) && verified, reason: used(s, 'major', d.id) ? 'Already written.' : 'Needs independent verification and confidence of 70% or more.' });
  }
  const byTarget = {}; for (const d of s.discoveries) if (d.targetId) (byTarget[d.targetId] ||= []).push(d);
  for (const [tid, list] of Object.entries(byTarget)) { const avg = list.reduce((a, d) => a + d.confidence, 0) / list.length; out.push({ type: 'paper', sourceId: tid, label: `${nm(tid)} (${list.length} records)`, confidence: Math.round(avg), ok: !used(s, 'paper', tid) && list.length >= 2 && avg >= 60, reason: used(s, 'paper', tid) ? 'Already written.' : list.length < 2 ? 'Needs at least two analysed records of this target.' : 'Average confidence below 60%.' }); }
  for (const a of s.anomalies.filter(x => x.status === 'resolved')) out.push({ type: 'anomaly', sourceId: a.id, label: a.title, confidence: 70, ok: !used(s, 'anomaly', a.id), reason: 'Already written.' });
  for (const m of s.missions.completed) out.push({ type: 'mission', sourceId: m.id, label: game.data.missionById[m.id]?.title || m.id, confidence: 75, ok: !used(s, 'mission', m.id), reason: 'Already written.' });
  return out;
}
export function startPublication(game, type, sourceId) {
  const s = game.state; const T = TYPES[type]; const src = sources(game).find(x => x.type === type && x.sourceId === sourceId);
  if (!T || !src) return { ok: false, error: 'Unknown publication.' };
  if (!src.ok) return { ok: false, error: src.reason };
  if (workRates(game).research <= 0) return { ok: false, error: 'Assign at least one healthy crew member to Research and analysis.' };
  if (!spend(game, T.cost, `Publication: ${T.label}`)) return { ok: false, error: `This publication costs ${T.cost} RC.` };
  const authors = s.crew.filter(c => c.assignment === 'research' && c.health >= 25).map(c => c.name);
  s.publications.unshift({ id: `pub-${s.uid++}`, type, sourceId, title: `${T.label}: ${src.label}`, stage: 0, progress: 0, status: 'active', startedAt: s.time.t, confidence: src.confidence, authors, note: '' });
  game.log(`Publication started: ${T.label}, ${src.label}.`, 'info');
  return { ok: true };
}
export function publicationsTick(game, dt) {
  const s = game.state; const speed = Math.min(2, Math.max(0.25, workRates(game).research / 8)) * (1 + game.moduleEffect('analysisSpeed'));
  for (const p of s.publications) {
    if (p.status !== 'active') continue; const T = TYPES[p.type];
    p.progress += (dt / DAY) * speed;
    while (p.status === 'active' && p.progress >= T.days[p.stage]) {
      p.progress -= T.days[p.stage];
      if (p.stage === 2) { // validation: peer review outcome
        const score = p.confidence + (game.rand() - 0.5) * 20 + game.moduleEffect('analysisSpeed') * 10;
        if (score < T.threshold) { p.status = 'returned'; p.finishedAt = s.time.t; p.note = 'Reviewers asked for more or better data before publication. Collect follow-up observations and try again.'; game.log(`Publication returned by reviewers: ${p.title}.`, 'warn'); game.addMessage({ from: 'Peer Review Panel', subject: `Returned: ${p.title}`, body: p.note, type: 'info' }); break; }
      }
      if (p.stage === 3) { publish(game, p); break; }
      p.stage += 1;
    }
  }
  if (s.publications.length > 100) s.publications.length = 100;
}
function publish(game, p) {
  const s = game.state; const T = TYPES[p.type]; p.status = 'published'; p.finishedAt = s.time.t;
  s.resources.researchPoints += T.reward.rp; s.resources.reputation += T.reward.rep;
  if (T.reward.credits) { s.resources.credits += T.reward.credits; s.finance.ledger.unshift({ t: s.time.t, amount: T.reward.credits, label: `Publication reward: ${T.label}`, kind: 'income', balance: s.resources.credits }); }
  game.log(`Published: ${p.title} (+${T.reward.rp} RP, +${T.reward.rep} reputation).`, 'good');
  record(game, { kind: 'publication', title: `Published: ${p.title}`, major: p.type === 'major' || p.type === 'paper', ref: p.id, text: `Authors: ${p.authors.join(', ') || 'none recorded'}.` });
  game.addMessage({ from: 'Scientific Journal Office', subject: `Published: ${p.title}`, body: `Your ${T.label.toLowerCase()} has passed validation and is published. Reputation +${T.reward.rep}.`, type: 'info' });
}
