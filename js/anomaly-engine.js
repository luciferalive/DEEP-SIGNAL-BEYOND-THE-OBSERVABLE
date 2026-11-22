import { record } from './chronicle.js';
// Anomalies: unusual features in raw data. In 0.1 they are all instrumental artefacts or noise; real anomalies come later.
import { getObject } from './astronomy-database.js';
import { pick } from './rng.js';

const SIGNATURES = {
  optical: [
    ['Transient bright pixel cluster near the target', 'A cosmic-ray hit on the detector produced a short-lived bright cluster.'],
    ['Faint periodic brightness modulation', 'The modulation tracks the mirror segment actuator cycle and was not reproduced.'],
    ['Unexpected narrow absorption feature', 'A calibration lamp line contaminated one exposure.']
  ],
  radio: [
    ['Narrow-band radio spike', 'The spike matches interference from station electronics and was not reproduced.'],
    ['Slow baseline drift resembling a periodic source', 'Receiver gain drift while the cryocooler cycled.'],
    ['Short broadband burst', 'Terrestrial interference scattered into a sidelobe.']
  ]
};

export function createAnomaly(game, ds) {
  const s = game.state; const obj = getObject(game.data.db, ds.targetId);
  const [title, truth] = pick(() => game.rand(), SIGNATURES[ds.kind] || SIGNATURES.optical);
  const a = { id: `an-${s.uid++}`, t: s.time.t, targetId: ds.targetId, datasetId: ds.id, instrumentId: ds.instrumentId, kind: ds.kind, title, status: 'unresolved', confidence: 'Unverified', truth, resolution: null };
  s.anomalies.unshift(a);
  game.log(`Anomaly flagged in ${obj.name} data: ${title}. Re-observe to check it.`, 'warn');
  return a;
}

export function resolveAnomaly(game, anomalyId, quality) {
  const a = game.state.anomalies.find(x => x.id === anomalyId); if (!a || a.status !== 'unresolved') return;
  if (quality >= 0.5) {
    a.status = 'resolved'; a.resolvedAt = game.state.time.t; a.resolution = `Not reproduced in a follow-up observation. Most likely instrumental: ${a.truth}`;
    game.log(`Anomaly "${a.title}" resolved as an instrumental artefact.`, 'info');
    record(game, { kind: 'anomaly', title: `Anomaly resolved: ${a.title}`, text: 'Instrumental artefact.', ref: a.id });
  } else game.log('Follow-up data quality was too low to resolve the anomaly.', 'warn');
}
export const unresolvedCount = game => game.state.anomalies.filter(a => a.status === 'unresolved').length;
