import { esc, badge, panel, head, empty, btn } from '../ui-components.js';
import { getObject } from '../astronomy-database.js';
import { formatDateTime } from '../time-engine.js';
import { STAGES, CAUSES, PRIORS, METHODS, currentStage, canClassify, tallyOf } from '../anomaly-engine.js';

export const title = 'Anomaly Investigation';
const causeKeys = Object.keys(CAUSES).filter(k => PRIORS[k] > 0);
export function render(ui) {
  const g = ui.game, s = g.state; const open = s.anomalies.filter(a => a.status === 'unresolved'); const done = s.anomalies.filter(a => a.status !== 'unresolved');
  const card = a => {
    const obj = getObject(g.data.db, a.targetId); const inst = s.instruments.find(i => i.id === a.instrumentId); const stage = currentStage(a); const live = a.status === 'unresolved';
    const tally = tallyOf(a);
    const reobs = [...new Set(s.instruments.filter(i => i.capabilities.some(c => c.group === obj.group)).map(i => i.id))];
    const stageBar = `<div class="row" style="gap:.25rem;flex-wrap:wrap;margin:.3rem 0">${STAGES.map(x => `<span class="badge ${x === stage ? 'warn' : ''}" style="opacity:${STAGES.indexOf(x) <= STAGES.indexOf(stage) ? 1 : .45}">${x}</span>`).join('')}</div>`;
    const evid = a.evidence.length ? `<div class="table-wrap"><table><tr><th>Method</th><th class="num">Weight</th><th>Points to</th></tr>${a.evidence.map(e => `<tr><td>${esc(e.method)}</td><td class="num mono">${e.weight}</td><td>${esc(CAUSES[e.points])}</td></tr>`).join('')}</table></div>` : '<p class="faint" style="font-size:.82rem">No evidence yet.</p>';
    let actions = '';
    if (live) {
      actions = `<div class="stack" style="margin-top:.5rem">
        ${!a.evidence.length && !a.pending ? btn('Run initial analysis (30 RC, 1 day)', 'an-initial', { id: a.id, cls: 'small' }) : ''}
        ${a.pending ? `<span class="warn" style="font-size:.84rem">Running: ${esc(a.pending.method)} (until ${formatDateTime(a.pending.until)})</span>` : ''}
        <div class="row"><span class="faint" style="font-size:.8rem">Working hypothesis:</span>${causeKeys.map(k => btn(CAUSES[k], 'an-hypothesis', { id: a.id, val: k, cls: `small ${a.hypothesis === k ? 'primary' : ''}` })).join('')}</div>
        <div class="row"><span class="faint" style="font-size:.8rem">Investigate:</span>${reobs.map(iid => `<button class="btn small" data-act="reobserve" data-id="${esc(a.id)}" data-val="12" data-inst="${esc(iid)}" ${a.pending ? 'disabled' : ''}>Re-observe 12 h (${esc(s.instruments.find(i => i.id === iid).name)})</button>`).join('')}
          ${btn(`${METHODS['long-term'].label} (${METHODS['long-term'].cost} RC)`, 'an-method', { id: a.id, val: 'long-term', cls: 'small', disabled: !!a.pending })}${btn(`${METHODS.comparison.label} (${METHODS.comparison.cost} RC)`, 'an-method', { id: a.id, val: 'comparison', cls: 'small', disabled: !!a.pending })}</div>
        <div class="row"><span class="faint" style="font-size:.8rem">Classify:</span>${causeKeys.map(k => btn(CAUSES[k], 'an-classify', { id: a.id, val: k, cls: 'small', disabled: !canClassify(a) })).join('')}</div>
        ${!canClassify(a) ? '<span class="faint" style="font-size:.76rem">Classification needs at least two pieces of evidence. Evidence is noisy, so more is better.</span>' : ''}</div>`;
    } else if (a.status === 'disputed') actions = `<div class="row">${btn('Re-open case', 'an-reopen', { id: a.id, cls: 'small' })}</div>`;
    return panel(a.title, `<div class="row" style="margin-bottom:.2rem">${badge(obj.name)}${badge(a.status, a.status === 'resolved' ? 'ok' : a.status === 'disputed' ? 'bad' : 'warn')}${badge('Leading: ' + a.confidence)}${badge('Known universe · instrument data', 'known')}</div>${stageBar}
      <p class="faint mono" style="font-size:.74rem">Flagged ${formatDateTime(a.t)} · ${esc(inst?.name || 'expedition data')} · dataset ${esc(a.datasetId)}</p>
      ${evid}${a.resolution ? `<p class="muted" style="font-size:.84rem">${esc(a.resolution)}</p>` : ''}${a.truthRevealed ? `<p class="faint" style="font-size:.8rem">Review: true cause was ${esc(CAUSES[a.cause].toLowerCase())}.</p>` : ''}${actions}`);
  };
  return `${head('Investigation', 'Anomaly Investigation', 'Unusual signals in your data. Collect noisy evidence, form a hypothesis, then classify. A wrong call can be disputed by later review.')}
  <p class="notice">Real, simulated and fictional content are kept apart. Here every anomaly is a known-universe effect (artefact, natural source, known object, rare new find). Speculative or fictional anomalies arrive in a later version and will be labelled.</p>
  <div class="grid cols-2">${open.length ? open.map(card).join('') : panel('Open anomalies', empty('None. Long observations occasionally flag unusual features.'))}</div>
  ${done.length ? `<h3 style="margin:1.4rem 0 .6rem">Closed</h3><div class="grid cols-2">${done.map(card).join('')}</div>` : ''}`;
}
