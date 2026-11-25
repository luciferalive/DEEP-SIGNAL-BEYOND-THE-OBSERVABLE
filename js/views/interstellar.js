import { esc, num, badge, panel, head, empty, select, btn } from '../ui-components.js';
import { probeTargets, PROBE_COST, cruiseC, MAX_LY, YEAR } from '../interstellar.js';
import { getObject } from '../astronomy-database.js';

export const title = 'Interstellar';
const dateOf = t => new Date(Date.UTC(2189, 0, 1) + t * 1000).toISOString().slice(0, 10);
export function render(ui) {
  const g = ui.game, s = g.state, st = ui.s; const targets = probeTargets(g); const sel = st.probeTarget && targets.some(t => t.id === st.probeTarget) ? st.probeTarget : targets[0]?.id; const t = sel && getObject(g.data.db, sel);
  const unlocked = g.unlocked('class:interstellar');
  const list = s.interstellar.map(p => { const o = getObject(g.data.db, p.targetId); return `<div class="item"><div><b>${esc(o.name)}</b> ${badge(p.status, p.status === 'complete' ? 'ok' : p.status === 'lost' ? 'bad' : 'warn')}<div class="faint mono" style="font-size:.76rem">launched ${dateOf(p.launchedAt)} · arrival ${dateOf(p.arriveAt)} · data ${dateOf(p.dataAt)}</div></div></div>`; }).join('') || empty('No probes launched.');
  return `${head('Civilization', 'Interstellar Precursors', 'Uncrewed probes to the nearest stars. They never return; their data arrives long after arrival.')}
  <p class="notice"><b>SPECULATIVE.</b> The propulsion technology is hypothesis-level and not demonstrated. Cruise speed is assumed to be ${cruiseC(g)} of light speed; flight times are decades. Star distances are real catalogue values. A quarter of probes are lost on the way (simulated risk).</p>
  <div class="grid cols-2">${panel('Launch a probe', !unlocked ? '<p class="muted">Research <b>Interstellar precursor probes</b> in the Technology Tree first.</p>' : `<div class="stack"><label class="field">Target star (within ${MAX_LY} ly) ${select('probe-target', targets.map(x => [x.id, `${x.name} (${x.distance_ly} ly)`]), sel, { act: 'probe-set' })}</label>
    ${t ? `<p class="faint mono" style="font-size:.78rem">Arrival in about ${(t.distance_ly / cruiseC(g)).toFixed(1)} years · data reaches the station ${t.distance_ly} years later · cost ${num(PROBE_COST)} RC</p>` : ''}
    <div class="row">${btn('Launch probe', 'probe-launch', { cls: 'primary', disabled: !t })}</div></div>`)}
  ${panel('Probes', `<div class="list">${list}</div>`)}</div>`;
}
