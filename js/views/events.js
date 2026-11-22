import { esc, badge, panel, head, empty, btn } from '../ui-components.js';
import { activeTransients, canRespond, RESPONSE_HOURS } from '../cosmic-events.js';
import { formatDateTime, formatDuration } from '../time-engine.js';

export const title = 'Cosmic Events';
export function eventBanner(ui) {
  const g = ui.game, p = g.state.events.pending; if (!p) return '';
  const def = g.data.events.find(e => e.id === p.id);
  return `<div class="alert" role="alert"><h3>${esc(def.title)} <span class="faint" style="font-weight:400;font-size:.74rem">· decision needed (default action in ${formatDuration(86400 - (g.state.time.t - p.t))})</span></h3><p style="margin:0">${esc(def.text)}</p><div class="opts">${def.options.map(o => `<button class="btn" data-act="event-choose" data-id="${o.id}">${esc(o.label)}<small>${esc(o.hint)}</small></button>`).join('')}</div></div>`;
}
export function render(ui) {
  const g = ui.game, s = g.state; const open = activeTransients(g); const recs = s.events.records;
  const sevTone = { warning: 'warn', notice: 'known', info: '' };
  return `${head('09 · Space weather, alerts and incidents', 'Cosmic Events', 'Every event is logged as a structured record. Station incidents need a decision (the simulation pauses unless you turn that off in Settings). Science alerts are time-limited opportunities you can answer with a matching instrument. All events here are simulated game events, not real observations.')}
  ${eventBanner(ui)}
  <div class="grid cols-2">
    ${panel('Open science opportunities', open.length ? `<div class="stack">${open.map(r => { const insts = s.instruments.filter(i => i.kind === r.kind); const pick = ui.s.respInst[r.id] || insts[0]?.id; const c = pick ? canRespond(g, r.id, pick) : { ok: false, error: 'No instrument.' };
      return `<div class="item" style="display:block"><div class="row between"><b>${esc(r.title)}</b>${badge(r.category)}</div><p class="muted" style="font-size:.82rem;margin:.3rem 0">${esc(r.description)}</p><div class="faint mono" style="font-size:.74rem">Window closes ${formatDateTime(r.expiresAt)} (${formatDuration(Math.max(0, r.expiresAt - s.time.t))} left) · needs ${esc(r.kind)} instrument · ${RESPONSE_HOURS} h response</div>
      <div class="row" style="margin-top:.5rem"><select id="resp-${r.id}" data-act="resp-select" data-id="${r.id}">${insts.map(i => `<option value="${i.id}" ${i.id === pick ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select>${btn(`Respond (${c.cost ?? '…'} RC)`, 'event-respond', { id: r.id, cls: 'small primary', disabled: !c.ok, title: c.ok ? '' : c.error })}</div>${!c.ok ? `<div class="faint" style="font-size:.74rem;margin-top:.3rem">${esc(c.error)}</div>` : ''}</div>`; }).join('')}</div>` : empty('No open alerts. Alerts arrive at random while time runs.'))}
    ${panel('Current conditions', `<dl class="kv"><dt>Solar activity</dt><dd>${s.events.solarFactor ? `<span class="warn">Disturbed</span> (solar output ×${s.events.solarFactor})` : '<span class="ok">Quiet</span>'}</dd><dt>Observations</dt><dd>${s.events.pauseObsUntil > s.time.t ? `<span class="warn">Suspended for ${formatDuration(s.events.pauseObsUntil - s.time.t)}</span>` : '<span class="ok">Normal</span>'}</dd><dt>Pending decision</dt><dd>${s.events.pending ? '<span class="warn">Yes, see above</span>' : 'None'}</dd><dt>Responses under way</dt><dd>${s.events.responses.length}</dd></dl>
      <p class="faint" style="font-size:.76rem;margin:.6rem 0 0">Gamma-ray burst and gravitational-wave alerts can only be logged until the matching instruments exist (planned).</p>`)}
  </div>
  <section class="panel" style="margin-top:1rem"><h3>Event records <span class="tag">${recs.length}</span></h3>${recs.length ? `<div class="table-wrap"><table><tr><th>Time</th><th>Event</th><th>Type</th><th>Severity</th><th>Affected</th><th>Status</th><th>Consequences and resolution</th></tr>${recs.slice(0, 40).map(r => `<tr><td class="mono">${formatDateTime(r.t)}</td><td><b>${esc(r.title)}</b><div class="faint mono" style="font-size:.68rem">${esc(r.id)}</div></td><td>${esc(r.type)}</td><td>${badge(r.severity, sevTone[r.severity] || '')}</td><td>${esc(r.affected.join(', ') || '—')}</td><td>${badge(r.status, ['observed', 'resolved'].includes(r.status) ? 'ok' : r.status === 'missed' ? 'warn' : '')}</td><td style="font-size:.8rem">${esc([r.resolution, ...r.consequences].filter(Boolean).join(' · ') || '—')}</td></tr>`).join('')}</table></div>` : empty('No events yet.')}</section>`;
}
