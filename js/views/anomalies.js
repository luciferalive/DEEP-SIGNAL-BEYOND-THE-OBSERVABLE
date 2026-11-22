import { esc, badge, panel, head, empty, select, btn } from '../ui-components.js';
import { getObject } from '../astronomy-database.js';
import { formatDateTime } from '../time-engine.js';
import { canObserve } from '../observatory.js';

export const title = 'Anomaly Investigation';
export function render(ui) {
  const g = ui.game, s = g.state; const open = s.anomalies.filter(a => a.status === 'unresolved'); const done = s.anomalies.filter(a => a.status !== 'unresolved');
  const card = a => { const obj = getObject(g.data.db, a.targetId); const inst = s.instruments.find(i => i.id === a.instrumentId); const can = canObserve(g, inst, obj);
    return panel(a.title, `<div class="row" style="margin-bottom:.4rem">${badge(obj.name)}${badge(a.status, a.status === 'resolved' ? 'ok' : 'warn')}${badge('Evidence: ' + a.confidence)}${badge('Known universe · instrument data', 'known')}</div>
    <p class="faint mono" style="font-size:.74rem">Flagged ${formatDateTime(a.t)} · ${esc(inst.name)} · dataset ${a.datasetId}</p>
    ${a.status === 'unresolved' ? `<p class="muted" style="font-size:.86rem">An unusual feature appeared in the raw data. It has not been reproduced. A new observation of the same target with the same instrument can show whether it is real.</p><div class="row">${btn('Re-observe 12 h', 'reobserve', { id: a.id, val: 12, cls: 'small primary', disabled: !can.ok })}${btn('Re-observe 24 h', 'reobserve', { id: a.id, val: 24, cls: 'small', disabled: !can.ok })}</div>` : `<p class="muted" style="font-size:.86rem">${esc(a.resolution)}</p>`}`); };
  return `${head('11 · Investigation', 'Anomaly Investigation', 'Unusual signals in your data. Most turn out to be instrument artefacts, which is exactly why a result is checked before it is believed.')}
  <p class="notice">Established science and speculation are kept apart. In this version every anomaly is a real-world style instrumental effect (cosmic-ray hits, interference, drift). Fictional, speculative anomalies such as wormhole candidates arrive in version 0.8 and will be clearly labelled as fiction.</p>
  <div class="grid cols-2">${open.length ? open.map(card).join('') : panel('Unresolved anomalies', empty('None. Long observations occasionally flag unusual features.'))}</div>
  ${done.length ? `<h3 style="margin:1.4rem 0 .6rem">Resolved</h3><div class="grid cols-2">${done.map(card).join('')}</div>` : ''}`;
}
