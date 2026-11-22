import { esc, num, badge, panel, head, empty, select, btn } from '../ui-components.js';
import { formatDateTime, formatDate } from '../time-engine.js';
import { SUPPLY_COST } from '../mission-control.js';
import { DAY } from '../constants.js';

export const title = 'Communications';
export function render(ui) {
  const g = ui.game, s = g.state; const unsent = s.discoveries.filter(d => !d.sentToEarth); const unver = s.discoveries.filter(d => !d.verification);
  const pending = s.finance.pending || []; const day = Math.floor(s.time.t / DAY); const wait = 20 - (day - s.finance.lastSupplyRequestDay);
  const msgs = s.messages.map(m => `<details class="msg ${m.read ? '' : 'unread'}" data-key="msg-${m.id}" ${ui.isOpen('msg-' + m.id) ? 'open' : ''}><summary data-act="read" data-id="${m.id}"><span class="row between"><span>${m.read ? '' : '<span class="amber">●</span> '}${esc(m.subject)} <span class="faint" style="font-size:.76rem">· ${esc(m.from)}</span></span><span class="faint mono" style="font-size:.72rem">${formatDateTime(m.t)}</span></span></summary>
    <div style="padding:.2rem .4rem .8rem">${m.fictional ? '<div class="notice fiction">Simulated future communication. Not a real message or event.</div>' : ''}<p class="muted">${esc(m.body)}</p>
    ${m.type === 'mission-offer' ? (m.status === 'open' && s.missions.offered.includes(m.missionId) ? `<div class="row">${btn('Accept mission', 'mission-accept', { id: m.missionId, cls: 'small primary' })}${btn('Decline', 'mission-decline', { id: m.missionId, cls: 'small' })}</div>` : badge(m.status)) : ''}
    ${m.type === 'funding-offer' ? (m.status === 'open' ? `<div class="row"><span class="mono amber">${num(m.credits)} RC</span>${btn('Accept', 'funding-accept', { id: m.id, cls: 'small primary' })}${btn('Decline', 'funding-decline', { id: m.id, cls: 'small' })}</div>` : badge(m.status)) : ''}</div></details>`).join('');
  const reports = s.missions.active.filter(a => a.status === 'report-ready');
  return `${head('12 · Earth link', 'Communications', 'Transmissions from Earth Mission Control and its partners, plus your own requests and reports. Messages from agencies are simulated future communications.')}
  <div class="grid cols-main"><section class="panel"><h3>Inbox <span class="tag">${s.messages.filter(m => !m.read).length} unread ${btn('Mark all read', 'read-all', { cls: 'small' })}</span></h3>${msgs || empty('No messages.')}</section>
  <div class="stack">
    ${panel('Send to Earth', `<div class="stack">
      <div class="row">${select('send-disc', unsent.length ? unsent.map(d => [d.id, d.title]) : [['', 'No unsent discoveries', true]], ui.s.sendDisc || unsent[0]?.id || '')}${btn('Send discovery', 'send-selected', { cls: 'small primary', disabled: !unsent.length })}</div>
      <div class="row">${select('ver-disc', unver.length ? unver.map(d => [d.id, d.title]) : [['', 'Nothing to verify', true]], ui.s.verDisc || unver[0]?.id || '')}${btn('Request verification', 'verify-selected', { cls: 'small', disabled: !unver.length })}</div>
      <div class="row">${select('report-sel', reports.length ? reports.map(a => [a.id, g.data.missionById[a.id]?.title || s.customMissions?.find(c => c.id === a.id)?.title]) : [['', 'No reports ready', true]], ui.s.reportSel || reports[0]?.id || '')}${btn('Submit mission report', 'report-selected', { cls: 'small primary', disabled: !reports.length })}</div></div>`)}
    ${panel('Request resources', `<p class="muted" style="font-size:.84rem">Ask Earth for an emergency convoy: oxygen 120 kg, water 500 L, food 350 kg. It arrives in 8 days. Limited to one request every 20 days.</p>${btn(`Request convoy (${SUPPLY_COST} RC)`, 'request-supplies', { cls: 'small', disabled: wait > 0 })}${wait > 0 ? `<span class="faint" style="font-size:.78rem"> available in ${wait} days</span>` : ''}`)}
    ${panel('In transit', pending.length ? `<div class="list">${pending.map(p => `<div class="item"><span>${esc(p.label)}</span><span class="faint mono" style="font-size:.74rem">arrives ${formatDate(p.arrives)}</span></div>`).join('')}</div>` : empty('Nothing in transit.'))}
  </div></div>`;
}
