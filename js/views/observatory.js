import { esc, num, pct, tone, bar, badge, panel, head, empty, select, btn } from '../ui-components.js';
import { canObserve, estimateQuality, observationCost, instrumentAccuracy, EXPOSURE_HOURS, SERVICE_COST } from '../observatory.js';
import { GROUPS, getObject, distanceLy } from '../astronomy-database.js';
import { formatDuration, formatDate } from '../time-engine.js';
import { workRates } from '../crew-management.js';

export const title = 'Observatory';
function planner(ui) {
  const g = ui.game, s = g.state, st = ui.s;
  const inst = s.instruments.find(i => i.id === st.obsInstrument) || s.instruments[0];
  const obj = getObject(g.data.db, st.obsTarget);
  const can = canObserve(g, inst, obj); const hours = st.obsHours;
  const q = can.ok ? estimateQuality(g, inst, obj, hours) : null; const cost = observationCost(inst, hours);
  const busy = g.isInstrumentBusy(inst); const ops = workRates(g).operations > 0;
  const paused = s.events.pauseObsUntil > s.time.t;
  const reason = !can.ok ? can.reason : !ops ? 'Assign at least one crew member to Observatory operations.' : busy ? `${inst.name} is already observing.` : paused ? `Observations suspended for ${formatDuration(s.events.pauseObsUntil - s.time.t)}.` : s.resources.credits < cost ? `Needs ${cost} RC.` : s.station.brownout ? 'Brownout: not enough power.' : '';
  const groups = {};
  for (const o of g.data.db.list) { if (o.group === 'exoplanet') continue; (groups[o.group] = groups[o.group] || []).push(o); }
  return panel('Observation planner', `<div class="grid cols-2" style="gap:.8rem">
    <label class="field">Instrument ${select('obs-instrument', s.instruments.map(i => [i.id, i.name]), inst.id, { act: 'obs-set' })}</label>
    <label class="field">Exposure ${select('obs-hours', EXPOSURE_HOURS.map(h => [h, `${h} hours`]), hours, { act: 'obs-set' })}</label>
    <label class="field" style="grid-column:1/-1">Target <select id="obs-target" data-act="obs-set">${Object.entries(groups).map(([k, list]) => `<optgroup label="${esc(GROUPS[k])}">${list.map(o => { const c = canObserve(g, inst, o); return `<option value="${esc(o.id)}"${o.id === st.obsTarget ? ' selected' : ''}>${esc(o.name)}${c.ok ? '' : ' (not observable)'}</option>`; }).join('')}</optgroup>`).join('')}</select></label>
  </div>
  <div class="grid cols-3" style="margin:.9rem 0">
    <div class="tile"><span class="label">Expected quality</span><span class="value">${q == null ? '—' : pct(q * 100)}</span><span class="sub">± 8% random variation</span></div>
    <div class="tile"><span class="label">Cost</span><span class="value amber">${cost} RC</span><span class="sub">${inst.powerKw} kW while observing</span></div>
    <div class="tile"><span class="label">Target distance</span><span class="value" style="font-size:1rem">${obj ? (distanceLy(obj) == null ? 'n/a' : obj.group === 'solar' ? obj.distance_au.toFixed(2) + ' AU' : distanceLy(obj) === 0 ? 'inside galaxy' : num(distanceLy(obj), distanceLy(obj) < 100 ? 2 : 0) + ' ly') : '—'}</span><span class="sub">${can.maxDistance ? 'Range limit ' + num(can.maxDistance) + ' ly' : can.ok ? 'No range limit' : ''}</span></div>
  </div>
  <div class="row">${btn('Start observation', 'obs-start', { cls: 'primary', disabled: !!reason })}${reason ? `<span class="warn" style="font-size:.82rem">${esc(reason)}</span>` : '<span class="ok" style="font-size:.82rem">Ready</span>'}</div>
  <p class="faint" style="font-size:.76rem;margin-top:.7rem">Longer exposures and nearer targets give better data. Weak or interrupted observations produce incomplete data. Some signals turn out to be instrumental artefacts, so unusual results are checked in Anomaly Investigation.</p>`);
}
export function render(ui) {
  const g = ui.game, s = g.state; const running = s.observations.filter(o => o.status === 'running'); const recent = s.observations.filter(o => o.status !== 'running').slice(0, 8);
  const raw = s.datasets.filter(d => d.status === 'raw');
  return `${head('Instruments', 'Observatory', 'Point your instruments at real objects. Raw data must be analysed in the Research Laboratory before it counts as a result.')}
  <div class="grid cols-main"><div class="stack">${planner(ui)}
    ${panel('Running observations', running.length ? running.map(o => { const inst = s.instruments.find(i => i.id === o.instrumentId); const done = (s.time.t - o.start) / (o.end - o.start); return `<div class="meter" style="margin-bottom:.6rem"><div class="top"><span>${esc(getObject(g.data.db, o.targetId).name)} <span class="faint">· ${esc(inst.name)}</span>${o.interrupted ? ' ' + badge('disturbed', 'warn') : ''}</span><span class="mono">${formatDuration(o.end - s.time.t)} left</span></div>${bar(done * 100, 100, 'info')}</div>`; }).join('') : empty('No observations running.'))}
    ${panel('Recent results', recent.length ? `<div class="table-wrap"><table><tr><th>Target</th><th>Date</th><th class="num">Hours</th><th class="num">Quality</th><th>Result</th></tr>${recent.map(o => `<tr><td>${esc(getObject(g.data.db, o.targetId).name)}${o.anomalyId ? ' <span class="faint">(follow-up)</span>' : ''}</td><td class="mono">${formatDate(o.end)}</td><td class="num">${o.hours}</td><td class="num">${o.quality != null ? pct(o.quality * 100) : '—'}</td><td>${o.status === 'failed' ? badge('failed', 'bad') : o.quality < 0.5 ? badge('incomplete', 'warn') : badge('complete', 'ok')}</td></tr>`).join('')}</table></div>` : empty('No finished observations yet.'))}
    ${panel('Raw data awaiting analysis', raw.length ? `<div class="list">${raw.map(d => `<div class="item"><div>${esc(getObject(g.data.db, d.targetId).name)} <span class="faint">· ${d.hours} h · ${d.sizeGB} GB · quality ${pct(d.quality * 100)}${d.partial ? ' · incomplete' : ''}</span></div>${btn('Analyse', 'analyse', { id: d.id, cls: 'small primary' })}</div>`).join('')}</div>` : empty('No raw data. Finish an observation first.'))}
  </div>
  <div class="stack">${s.instruments.map(i => { const busy = g.isInstrumentBusy(i); return panel(i.name, `<div class="row" style="margin-bottom:.4rem">${badge(i.band)}${badge(`level ${i.level}/${i.maxLevel}`)}${busy ? badge('observing', 'ok') : badge('standby')}</div><p class="muted" style="font-size:.82rem">${esc(i.description)}</p>
    <div class="stack"><div class="meter"><div class="top"><b>Condition</b><span class="mono">${pct(i.condition)}</span></div>${bar(i.condition, 100, tone(i.condition, 50, 25))}</div></div>
    <dl class="kv" style="margin-top:.6rem"><dt>Accuracy</dt><dd class="mono">${instrumentAccuracy(g, i).toFixed(2)} <span class="faint">(base ${i.accuracy.toFixed(2)})</span></dd><dt>Power</dt><dd class="mono">${i.powerKw} kW active / ${i.standbyKw} kW standby</dd><dt>Operating cost</dt><dd class="mono">${i.operatingCostPerHour} RC per hour</dd><dt>Purchase cost</dt><dd class="mono">${i.purchaseCost ? i.purchaseCost + ' RC' : 'Included with the station'}</dd><dt>Detects</dt><dd>${i.capabilities.map(c => `${esc(GROUPS[c.group])}${c.maxDistanceLy ? ` (≤ ${num(c.maxDistanceLy)} ly)` : ' (any)'}`).join('<br>')}</dd><dt>Limitations</dt><dd>${esc(i.limitations)}</dd><dt>Maintenance</dt><dd>Condition falls with use. Service every ~${i.maintenanceHours} observing hours.</dd><dt>Upgrades</dt><dd>${i.level >= i.maxLevel ? 'Fully upgraded for this version. Research Adaptive Optics / Cryogenic Receiver in the Technology Tree for accuracy gains.' : ''}</dd></dl>
    ${btn(`Service instrument (${SERVICE_COST} RC)`, 'service-instrument', { id: i.id, cls: 'small', disabled: busy })}`); }).join('')}
    ${panel('Instrument catalogue', g.data.instruments.active.filter(c => !s.instruments.some(i => i.id === c.id)).map(c => { const open = !c.unlock || g.unlocked(c.unlock); return `<div class="item"><div><b>${esc(c.name)}</b> ${badge(c.band || c.kind)}<div class="faint" style="font-size:.78rem">${esc(c.description || '')}${open ? '' : ' Requires technology: ' + esc(c.unlock)}</div></div>${btn(`Buy (${c.purchaseCost} RC)`, 'buy-instrument', { id: c.id, cls: 'small', disabled: !open || s.resources.credits < c.purchaseCost })}</div>`; }).join('') || '<p class="faint">All instruments owned.</p>')}</div></div>`;
}
