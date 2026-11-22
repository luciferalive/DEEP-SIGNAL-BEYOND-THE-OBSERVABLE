// Earth Mission Control: messages, missions, funding offers, supply convoys, reports and verification requests.
import { DAY } from './constants.js';
import { getObject } from './astronomy-database.js';
import { addCredits, spend, deliverSupplies } from './finance.js';

export function addMessage(game, msg) {
  const s = game.state;
  const m = { id: `msg-${s.uid++}`, t: s.time.t, read: false, status: 'open', fictional: true, ...msg };
  s.messages.unshift(m); if (s.messages.length > 120) s.messages.length = 120;
  return m;
}

export function offerMission(game, missionId) {
  const s = game.state; const def = game.data.missionById[missionId];
  if (!def || s.missions.offered.includes(missionId) || s.missions.active.some(m => m.id === missionId) || s.missions.completed.some(m => m.id === missionId)) return null;
  s.missions.offered.push(missionId);
  const m = addMessage(game, { from: def.issuer, subject: `Mission assignment: ${def.title}`, body: def.briefing, type: 'mission-offer', missionId, rewards: def.rewards });
  game.log(`New mission offered: ${def.title}.`, 'info');
  return m;
}

export function acceptMission(game, missionId) {
  const s = game.state; const def = game.data.missionById[missionId];
  if (!s.missions.offered.includes(missionId)) return { ok: false, error: 'This mission is not on offer.' };
  s.missions.offered = s.missions.offered.filter(x => x !== missionId);
  s.missions.active.push({ id: missionId, acceptedAt: s.time.t, status: 'active' });
  for (const m of s.messages) if (m.missionId === missionId && m.status === 'open') m.status = 'accepted';
  game.log(`Mission accepted: ${def.title}.`, 'good');
  return { ok: true };
}
export function declineMission(game, missionId) {
  const s = game.state;
  if (!s.missions.offered.includes(missionId)) return { ok: false, error: 'This mission is not on offer.' };
  s.missions.offered = s.missions.offered.filter(x => x !== missionId); s.missions.declined.push(missionId);
  for (const m of s.messages) if (m.missionId === missionId && m.status === 'open') m.status = 'declined';
  game.log(`Mission declined: ${game.data.missionById[missionId].title}.`, 'info');
  return { ok: true };
}

// Objective evaluation is derived from the current state, so it can never get out of step with it.
export function objectiveDone(game, mission, objective, acceptedAt) {
  const s = game.state;
  switch (objective.type) {
    case 'observe': return s.datasets.some(d => d.targetId === objective.target && d.t >= acceptedAt && (!objective.kind || d.kind === objective.kind) && d.quality >= (objective.minQuality ?? 0) && d.hours >= (objective.minHours ?? 0));
    case 'analyse': return s.discoveries.some(d => d.targetId === objective.target && d.t >= acceptedAt);
    case 'research': return !!s.tech.researched[objective.tech] && s.tech.researched[objective.tech] >= acceptedAt;
    case 'send': return s.discoveries.some(d => d.targetId === objective.target && d.sentToEarth && d.t >= acceptedAt);
    default: return false;
  }
}
export const missionProgress = (game, active) => {
  const def = game.data.missionById[active.id] || game.state.customMissions?.find(c => c.id === active.id);
  const objectives = def.objectives.map(o => ({ ...o, done: objectiveDone(game, def, o, active.acceptedAt) }));
  return { def, objectives, done: objectives.filter(o => o.done).length, total: objectives.length };
};

export function evaluateMissions(game) {
  for (const a of game.state.missions.active) {
    if (a.status !== 'active') continue;
    const p = missionProgress(game, a);
    if (p.done === p.total) {
      a.status = 'report-ready';
      game.log(`Mission objectives complete: ${p.def.title}. Submit your report from Mission Control.`, 'good');
      addMessage(game, { from: 'Meridian Station Operations', subject: `Objectives complete: ${p.def.title}`, body: 'All objectives are complete. Submit the mission report to Earth to receive your rewards.', type: 'info', fictional: false, missionId: p.def.id });
    }
  }
}

export function submitReport(game, missionId) {
  const s = game.state; const a = s.missions.active.find(m => m.id === missionId);
  if (!a || a.status !== 'report-ready') return { ok: false, error: 'This mission has no completed report to submit.' };
  const def = game.data.missionById[missionId] || (s.customMissions || []).find(c => c.id === missionId);
  const r = def.rewards;
  if (r.credits) addCredits(game, r.credits, `Mission reward: ${def.title}`, 'income');
  s.resources.researchPoints += r.researchPoints || 0; s.resources.reputation += r.reputation || 0;
  s.missions.active = s.missions.active.filter(m => m.id !== missionId);
  s.missions.completed.push({ id: missionId, acceptedAt: a.acceptedAt, completedAt: s.time.t });
  game.log(`Mission report submitted: ${def.title}. +${r.credits || 0} RC, +${r.researchPoints || 0} RP, +${r.reputation || 0} reputation.`, 'good');
  addMessage(game, { from: def.issuer || 'Earth Mission Control', subject: `Report received: ${def.title}`, body: 'Thank you. Your report has been received and archived. Rewards have been credited.', type: 'info' });
  for (const next of def.next || []) offerMission(game, next);
  return { ok: true };
}

// Player-created survey objective from the Universe Explorer ("create mission destination").
export function createSurvey(game, targetId, kind) {
  const s = game.state; const obj = getObject(game.data.db, targetId);
  if (!obj) return { ok: false, error: 'Unknown object.' };
  s.customMissions = s.customMissions || [];
  const id = `survey-${targetId}-${kind}`;
  if (s.customMissions.some(c => c.id === id) && (s.missions.active.some(m => m.id === id))) return { ok: false, error: 'You already have a survey of this object in progress.' };
  if (!s.customMissions.some(c => c.id === id)) s.customMissions.push({ id, title: `Survey: ${obj.name}`, issuer: 'Meridian Station (self-directed)', fictional: false, briefing: `Self-directed survey of ${obj.name}.`, objectives: [{ id: 'o1', type: 'observe', target: targetId, kind, minQuality: 0.4, text: `Observe ${obj.name} with the ${kind} instrument.` }, { id: 'o2', type: 'analyse', target: targetId, text: `Analyse the ${obj.name} data.` }], rewards: { credits: 0, researchPoints: 6, reputation: 0 }, next: [] });
  s.missions.active = s.missions.active.filter(m => m.id !== id);
  s.missions.active.push({ id, acceptedAt: s.time.t, status: 'active' });
  game.log(`Survey objective created: ${obj.name}.`, 'info');
  return { ok: true };
}

export const SUPPLY_COST = 600;
export function requestSupplies(game) {
  const s = game.state; const day = Math.floor(s.time.t / DAY);
  if (day - s.finance.lastSupplyRequestDay < 20) return { ok: false, error: `Earth will accept another request in ${20 - (day - s.finance.lastSupplyRequestDay)} days.` };
  if (!spend(game, SUPPLY_COST, 'Emergency supply request')) return { ok: false, error: `An emergency convoy costs ${SUPPLY_COST} RC.` };
  s.finance.lastSupplyRequestDay = day;
  s.finance.pending = s.finance.pending || [];
  s.finance.pending.push({ arrives: s.time.t + 8 * DAY, goods: { oxygen: 120, water: 500, food: 350 }, label: 'Emergency supply convoy' });
  game.log('Emergency supply convoy requested. Arrival in 8 days.', 'info');
  addMessage(game, { from: 'Earth Logistics Office', subject: 'Request received', body: 'Emergency convoy approved. Estimated arrival: 8 days.', type: 'info' });
  return { ok: true };
}

export function sendDiscovery(game, id) {
  const s = game.state; const d = s.discoveries.find(x => x.id === id);
  if (!d) return { ok: false, error: 'Unknown discovery.' };
  if (d.sentToEarth) return { ok: false, error: 'Already sent to Earth.' };
  d.sentToEarth = true; d.sentAt = s.time.t;
  s.finance.pending = s.finance.pending || [];
  s.finance.pending.push({ arrives: s.time.t + 2 * DAY, reward: { credits: 120 + Math.round(d.quality * 200), reputation: 1 }, label: `Earth's acknowledgement: ${d.title}` });
  game.log(`Discovery sent to Earth: ${d.title}.`, 'info');
  return { ok: true };
}
export function requestVerification(game, id) {
  const s = game.state; const d = s.discoveries.find(x => x.id === id);
  if (!d) return { ok: false, error: 'Unknown discovery.' };
  if (d.verification) return { ok: false, error: 'Verification was already requested.' };
  d.verification = 'requested';
  s.finance.pending = s.finance.pending || [];
  s.finance.pending.push({ arrives: s.time.t + 5 * DAY, verify: id, label: `Verification: ${d.title}` });
  game.log(`Scientific verification requested for ${d.title}. Reply expected in 5 days.`, 'info');
  return { ok: true };
}

export function missionControlTick(game) {
  const s = game.state; const t = s.time.t; const day = Math.floor(t / DAY);
  evaluateMissions(game);
  const pending = s.finance.pending || [];
  const due = pending.filter(p => p.arrives <= t);
  if (due.length) {
    s.finance.pending = pending.filter(p => p.arrives > t);
    for (const p of due) {
      if (p.goods) deliverSupplies(game, p.goods, p.label);
      if (p.reward) { if (p.reward.credits) addCredits(game, p.reward.credits, p.label, 'income'); s.resources.reputation += p.reward.reputation || 0; game.log(`${p.label}: +${p.reward.credits} RC, +${p.reward.reputation} reputation.`, 'good'); addMessage(game, { from: 'Earth Mission Control', subject: p.label, body: 'Earth acknowledges your discovery report and has credited a research bonus.', type: 'info' }); }
      if (p.verify) { const d = s.discoveries.find(x => x.id === p.verify); if (d) { d.verification = 'verified'; d.confidence = Math.min(98, d.confidence + 12); d.confidenceLabel = d.confidence >= 75 ? 'High' : d.confidence >= 55 ? 'Moderate' : 'Low'; game.log(`Verification received: ${d.title} is now ${d.confidenceLabel} confidence (${d.confidence}%).`, 'good'); addMessage(game, { from: 'Independent Review Panel', subject: `Verification: ${d.title}`, body: `The panel independently reviewed your analysis and raised its confidence to ${d.confidence}%.`, type: 'info' }); } }
    }
  }
  // Funding offers every 45 days
  if (day >= (s.flags.nextFundingOffer ?? 20)) {
    s.flags.nextFundingOffer = day + 45;
    addMessage(game, { from: 'Earth Funding Office', subject: 'Supplementary funding offer', body: 'The Funding Office can release a supplementary grant for the programme if you accept the offer.', type: 'funding-offer', credits: 1500 + 100 * s.resources.reputation });
    game.log('A supplementary funding offer has arrived.', 'info');
  }
}
export function respondToFunding(game, msgId, accept) {
  const m = game.state.messages.find(x => x.id === msgId);
  if (!m || m.type !== 'funding-offer' || m.status !== 'open') return { ok: false, error: 'No open offer.' };
  m.status = accept ? 'accepted' : 'declined';
  if (accept) { addCredits(game, m.credits, 'Supplementary grant', 'income'); game.log(`Funding accepted: +${m.credits} RC.`, 'good'); }
  return { ok: true };
}
