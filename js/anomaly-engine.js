import { startMystery } from './mysteries.js';
// Anomaly investigation (V2). An unusual feature in raw data goes through stages:
// DETECTION -> INITIAL ANALYSIS -> HYPOTHESIS -> INVESTIGATION -> EVIDENCE COLLECTION -> CLASSIFICATION.
// Every anomaly has a hidden true cause drawn when it is created. Evidence is noisy; the player classifies and may be wrong,
// in which case a later review can dispute the result. Known-universe anomalies are never extraordinary (see FICTIONAL tier in V4).
import { record } from './chronicle.js';
import { getObject } from './astronomy-database.js';
import { pick } from './rng.js';
import { schedule, onSchedule } from './scheduler.js';
import { spend } from './finance.js';
import { DAY } from './constants.js';

export const STAGES = ['DETECTION', 'INITIAL ANALYSIS', 'HYPOTHESIS', 'INVESTIGATION', 'EVIDENCE COLLECTION', 'CLASSIFICATION'];
export const CAUSES = {
  'instrument-error': 'Instrument error or artefact',
  natural: 'Natural phenomenon',
  'known-object': 'Known object in the field',
  'new-discovery': 'New discovery',
  unresolved: 'Cannot be resolved with current data',
  extraordinary: 'Extraordinary source (FICTIONAL)'
};
// Prior weights of the hidden cause. "extraordinary" is zero in the known universe.
export const PRIORS = { 'instrument-error': 0.42, natural: 0.28, 'known-object': 0.16, 'new-discovery': 0.06, unresolved: 0.08, extraordinary: 0.03 };
export const METHODS = {
  optical: { label: 'Optical re-observation', kind: 'optical', days: 0, cost: 0, instrument: true },
  radio: { label: 'Radio re-observation', kind: 'radio', days: 0, cost: 0, instrument: true },
  infrared: { label: 'Infrared observation', kind: 'infrared', days: 0, cost: 0, instrument: true },
  spectral: { label: 'Spectral analysis', kind: 'spectral', days: 0, cost: 0, instrument: true },
  'long-term': { label: 'Long-term monitoring (30 days)', days: 30, cost: 260, reliab: 0.78 },
  comparison: { label: 'Archive comparison (3 days)', days: 3, cost: 60, reliab: 0.58 },
  mission: { label: 'Remote mission', mission: true }
};
const SIGNATURES = {
  optical: [['Transient bright pixel cluster near the target', 'A cosmic-ray hit on the detector produced a short-lived bright cluster.'], ['Faint periodic brightness modulation', 'The modulation tracks the mirror segment actuator cycle and was not reproduced.'], ['Unexpected narrow absorption feature', 'A calibration lamp line contaminated one exposure.']],
  radio: [['Narrow-band radio spike', 'The spike matches interference from station electronics and was not reproduced.'], ['Slow baseline drift resembling a periodic source', 'Receiver gain drift while the cryocooler cycled.'], ['Short broadband burst', 'Terrestrial interference scattered into a sidelobe.']]
};
const NATURAL_NOTES = ['a real but ordinary variability of the source', 'a passing small body in the field', 'a known flare process'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function drawCause(game) {
  const entries = Object.entries(PRIORS).filter(([, w]) => w > 0); let r = game.rand() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; } return entries[0][0];
}
const stageOf = a => a.classification ? 'CLASSIFICATION' : a.evidence.length >= 2 ? (a.evidence.length >= 3 ? 'CLASSIFICATION' : 'EVIDENCE COLLECTION')
  : a.pending ? 'INVESTIGATION' : a.hypothesis ? 'HYPOTHESIS' : a.evidence.length ? 'INITIAL ANALYSIS' : 'DETECTION';
export const currentStage = a => a.stage || stageOf(a);
export const canClassify = a => a.status === 'unresolved' && a.evidence.length >= 2;

export function createAnomaly(game, ds) {
  const s = game.state; const obj = getObject(game.data.db, ds.targetId);
  const cause = drawCause(game);
  const [title, truth] = pick(() => game.rand(), SIGNATURES[ds.kind] || SIGNATURES.optical);
  const a = { id: `an-${s.uid++}`, t: s.time.t, targetId: ds.targetId, datasetId: ds.id, instrumentId: ds.instrumentId, kind: ds.kind, title, status: 'unresolved', stage: 'DETECTION',
    confidence: 'Unverified', truth, cause, evidence: [], hypothesis: null, pending: null, classification: null, resolution: null, category: 'Known Universe' };
  s.anomalies.unshift(a);
  game.log(`Anomaly flagged in ${obj.name} data: ${title}. Open Anomaly Investigation to analyse it.`, 'warn');
  return a;
}

// Noisy evidence: points at the true cause with probability `reliab`, otherwise at a random plausible alternative.
export function addEvidence(game, a, method, reliab) {
  const alts = Object.entries(PRIORS).filter(([k, w]) => w > 0 && k !== a.cause);
  let points = a.cause;
  if (game.rand() > clamp(reliab, 0.2, 0.95)) { const [k] = pick(() => game.rand(), alts); points = k; }
  const ev = { t: game.state.time.t, method, weight: Math.round(clamp(reliab, 0.2, 0.95) * 100) / 100, points };
  a.evidence.push(ev); a.stage = stageOf(a);
  const tally = tallyOf(a); a.confidence = tally.lead ? `${CAUSES[tally.lead]} (${Math.round(tally.share * 100)}%)` : 'Unverified';
  return ev;
}
export function tallyOf(a) {
  const t = {}; let tot = 0; for (const e of a.evidence) { t[e.points] = (t[e.points] || 0) + e.weight; tot += e.weight; }
  const sorted = Object.entries(t).sort((x, y) => y[1] - x[1]);
  return { totals: t, total: tot, lead: sorted[0]?.[0] || null, share: sorted[0] && tot ? sorted[0][1] / tot : 0 };
}

// A re-observation completed with quality q (called by the observatory).
export function resolveAnomaly(game, anomalyId, quality) {
  const a = game.state.anomalies.find(x => x.id === anomalyId); if (!a || a.status !== 'unresolved') return;
  a.pending = null;
  if (quality < 0.4) { game.log('Follow-up data quality was too low to add evidence. Try a longer exposure.', 'warn'); a.stage = stageOf(a); return; }
  addEvidence(game, a, 'Re-observation', 0.45 + 0.5 * quality);
  game.log(`Evidence added to "${a.title}" (${a.evidence.length} item${a.evidence.length > 1 ? 's' : ''}).`, 'info');
}

export function startInitialAnalysis(game, id) {
  const a = game.state.anomalies.find(x => x.id === id); if (!a || a.status !== 'unresolved') return { ok: false, error: 'Unknown or closed anomaly.' };
  if (a.evidence.length || a.pending) return { ok: false, error: 'Initial analysis is already done or running.' };
  if (!spend(game, 30, `Initial analysis: ${a.title}`)) return { ok: false, error: 'Initial analysis costs 30 RC.' };
  a.pending = { method: 'initial', until: game.state.time.t + DAY }; a.stage = 'INITIAL ANALYSIS';
  schedule(game, a.pending.until, 'anomaly-method', { id, method: 'initial' }); return { ok: true };
}
export function setHypothesis(game, id, cause) {
  const a = game.state.anomalies.find(x => x.id === id); if (!a || a.status !== 'unresolved') return { ok: false, error: 'Closed anomaly.' };
  if (!CAUSES[cause] || PRIORS[cause] === 0) return { ok: false, error: 'Not a valid hypothesis here.' };
  a.hypothesis = cause; a.stage = stageOf(a); return { ok: true };
}
// Non-instrument methods run on the scheduler.
export function startMethod(game, id, method) {
  const a = game.state.anomalies.find(x => x.id === id); const m = METHODS[method];
  if (!a || a.status !== 'unresolved') return { ok: false, error: 'Unknown or closed anomaly.' };
  if (!m || m.instrument || m.mission) return { ok: false, error: 'Unsupported method.' };
  if (a.pending) return { ok: false, error: 'An investigation step is already running.' };
  if (method === 'comparison' && !game.state.datasets.some(d => d.targetId === a.targetId && d.id !== a.datasetId && d.status === 'analysed')) return { ok: false, error: 'Archive comparison needs an earlier analysed dataset of the same object.' };
  if (!spend(game, m.cost, `Anomaly method: ${m.label}`)) return { ok: false, error: `${m.label} costs ${m.cost} RC.` };
  a.pending = { method, until: game.state.time.t + m.days * DAY }; a.stage = 'INVESTIGATION';
  schedule(game, a.pending.until, 'anomaly-method', { id, method }); return { ok: true };
}
onSchedule('anomaly-method', (game, { id, method }) => {
  const a = game.state.anomalies.find(x => x.id === id); if (!a || a.status !== 'unresolved') return;
  a.pending = null;
  addEvidence(game, a, method === 'initial' ? 'Initial analysis' : METHODS[method].label, method === 'initial' ? 0.5 : METHODS[method].reliab);
  game.log(`${method === 'initial' ? 'Initial analysis' : METHODS[method].label} finished for "${a.title}".`, 'info');
});

// The player classifies the anomaly. A wrong call is disputed after a review period.
export function classifyAnomaly(game, id, cause) {
  const s = game.state; const a = s.anomalies.find(x => x.id === id);
  if (!a || a.status !== 'unresolved') return { ok: false, error: 'Unknown or already classified.' };
  if (!canClassify(a)) return { ok: false, error: 'Collect at least two pieces of evidence before classifying.' };
  if (!CAUSES[cause] || PRIORS[cause] === 0) return { ok: false, error: 'Choose a classification.' };
  const correct = cause === a.cause; a.classification = cause; a.status = 'resolved'; a.stage = 'CLASSIFICATION'; a.resolvedAt = s.time.t;
  a.resolution = `Classified as: ${CAUSES[cause]}, judged from ${a.evidence.length} pieces of evidence.`;
  a.truthRevealed = false;
  if (a.cause === 'unresolved' && cause !== 'unresolved') a.resolution += ' Reviewers have not yet accepted this.';
  record(game, { kind: 'anomaly', title: `Anomaly classified: ${a.title}`, text: CAUSES[cause], ref: a.id });
  if (correct) {
    a.confirmed = true; const rp = cause === 'new-discovery' ? 25 : cause === 'unresolved' ? 4 : 8; s.resources.researchPoints += rp;
    if (cause === 'new-discovery') s.resources.reputation += 3;
    game.log(`Anomaly "${a.title}" classified (${CAUSES[cause]}). +${rp} RP.`, 'good');
    schedule(game, s.time.t + 20 * DAY, 'anomaly-review', { id });
  } else {
    game.log(`Anomaly "${a.title}" classified as ${CAUSES[cause]}. Independent review is pending.`, 'info');
    schedule(game, s.time.t + 25 * DAY, 'anomaly-review', { id });
  }
  return { ok: true };
}
onSchedule('anomaly-review', (game, { id }) => {
  const s = game.state; const a = s.anomalies.find(x => x.id === id); if (!a) return;
  a.truthRevealed = true;
  if (a.cause === 'extraordinary' && !a.seededMystery) { a.seededMystery = true; const free = game.data.mysteryArcs.filter(x => !game.state.mysteries.list.some(m => m.arc === x.id)); if (free.length) startMystery(game, free[Math.floor(game.rand() * free.length)].id, { seeded: true, from: a.id }); }
  if (a.classification === a.cause) { a.reviewed = 'upheld'; game.log(`Review upheld your classification of "${a.title}".`, 'good'); return; }
  a.status = 'disputed'; a.reviewed = 'disputed'; s.resources.reputation = Math.max(0, s.resources.reputation - 2);
  a.resolution += ` Later review disagreed: the cause was ${CAUSES[a.cause].toLowerCase()}. Reputation -2. You may re-open the case with new evidence.`;
  game.log(`Review disputed your classification of "${a.title}". Reputation -2.`, 'bad');
  record(game, { kind: 'anomaly', title: `Classification disputed: ${a.title}`, text: `Reviewers found: ${CAUSES[a.cause]}.`, ref: a.id });
});
export function reopenAnomaly(game, id) {
  const a = game.state.anomalies.find(x => x.id === id); if (!a || a.status !== 'disputed') return { ok: false, error: 'Only disputed cases can be re-opened.' };
  a.status = 'unresolved'; a.classification = null; a.reviewed = null; a.stage = stageOf(a); return { ok: true };
}
export const unresolvedCount = game => game.state.anomalies.filter(a => a.status === 'unresolved').length;
