import { esc, badge, panel, head, empty, btn } from '../ui-components.js';
import { formatDateTime, formatDuration } from '../time-engine.js';

export const title = 'Cosmic Events';
export function eventBanner(ui) {
  const g = ui.game, p = g.state.events.pending; if (!p) return '';
  const def = g.data.events.find(e => e.id === p.id);
  return `<div class="alert" role="alert"><h3>${esc(def.title)} <span class="faint" style="font-weight:400;font-size:.74rem">· decision needed (default action in ${formatDuration(86400 - (g.state.time.t - p.t))})</span></h3><p style="margin:0">${esc(def.text)}</p><div class="opts">${def.options.map(o => `<button class="btn" data-act="event-choose" data-id="${o.id}">${esc(o.label)}<small>${esc(o.hint)}</small></button>`).join('')}</div></div>`;
}
export function render(ui) {
  const g = ui.game, s = g.state;
  return `${head('09 · Space weather and incidents', 'Cosmic Events', 'Random events affect the station and its instruments. Some need a decision; if you do nothing for a day the default action is taken. The simulation pauses automatically when an event arrives (change this in Settings).')}
  ${eventBanner(ui)}
  <div class="grid cols-2">
    ${panel('Current conditions', `<dl class="kv"><dt>Solar activity</dt><dd>${s.events.solarFactor ? `<span class="warn">Particle storm in progress</span> (solar output ×${s.events.solarFactor})` : '<span class="ok">Quiet</span>'}</dd><dt>Observations</dt><dd>${s.events.pauseObsUntil > s.time.t ? `<span class="warn">Suspended for ${formatDuration(s.events.pauseObsUntil - s.time.t)}</span>` : '<span class="ok">Normal</span>'}</dd><dt>Pending decision</dt><dd>${s.events.pending ? '<span class="warn">Yes, see above</span>' : 'None'}</dd></dl>`)}
    ${panel('Event types in this version', `<ul style="margin:0;padding-left:1.1rem;font-size:.86rem" class="muted">${g.data.events.map(e => `<li>${esc(e.title)}</li>`).join('')}</ul><p class="faint" style="font-size:.76rem;margin:.6rem 0 0">Supernova discoveries, gamma-ray bursts, gravitational-wave detections and other astronomical events arrive in version 0.7.</p>`)}
  </div>
  ${panel('Event history', s.events.history.length ? `<div class="list">${s.events.history.map(h => `<div class="item"><div><b>${esc(h.title)}</b><div class="faint" style="font-size:.76rem">${esc(h.choice)}${h.auto ? ' (default action)' : ''}</div></div><span class="faint mono" style="font-size:.74rem">${formatDateTime(h.t)}</span></div>`).join('')}</div>` : empty('No events yet.'), { cls: '' }).replace('<section class="panel ', '<section style="margin-top:1rem" class="panel ')}`;
}
