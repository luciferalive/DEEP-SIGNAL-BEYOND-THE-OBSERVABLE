import { esc, num, badge, panel, head, empty, select, btn } from '../ui-components.js';
import { searchArchive } from '../discovery-archive.js';
import { getObject } from '../astronomy-database.js';
import { formatDateTime } from '../time-engine.js';

export const title = 'Discovery Archive';
export function render(ui) {
  const g = ui.game, st = ui.s; const rows = searchArchive(g, { query: st.archiveQuery, type: st.archiveType });
  return `${head('10 · Record', 'Discovery Archive', 'The permanent scientific record of everything your programme has observed, analysed and found. Each entry carries a timestamp and its evidence.')}
  <div class="row" style="margin-bottom:1rem"><input id="archive-q" type="search" placeholder="Search the archive…" value="${esc(st.archiveQuery)}" data-input="archive-query" style="min-width:16rem" aria-label="Search the archive">${select('archive-type', [['all', 'All records'], ['discovery', 'Discoveries'], ['observation', 'Observations'], ['anomaly', 'Anomalies'], ['mission report', 'Mission reports'], ['technology', 'Technologies']], st.archiveType, { act: 'archive-type' })}<span class="faint" style="font-size:.78rem">${rows.length} records</span></div>
  <div class="stack">${rows.length ? rows.map(r => r.kind === 'discovery' ? panel(r.title, `<div class="row" style="margin-bottom:.4rem">${badge(r.ref.category === 'Simulated Event' ? 'Simulated event · not real data' : 'Known universe', r.ref.category === 'Simulated Event' ? 'fiction' : 'known')}${badge(r.ref.type)}${badge(`${r.ref.confidenceLabel} confidence · ${r.ref.confidence}%`, r.ref.confidence >= 75 ? 'ok' : r.ref.confidence >= 55 ? '' : 'warn')}${r.ref.sentToEarth ? badge('sent to Earth', 'ok') : ''}${r.ref.verification === 'verified' ? badge('independently verified', 'ok') : r.ref.verification ? badge('verification pending', 'warn') : ''}</div>
      <p class="muted" style="font-size:.86rem">${esc(r.text)}</p><p class="faint mono" style="font-size:.74rem;margin:0 0 .6rem">${formatDateTime(r.t)} · evidence: ${r.ref.evidence.join(', ')} · +${r.ref.rp} RP</p>
      <div class="row">${btn('Send to Earth', 'send-discovery', { id: r.ref.id, cls: 'small', disabled: r.ref.sentToEarth })}${btn('Request verification', 'request-verification', { id: r.ref.id, cls: 'small', disabled: !!r.ref.verification })}${r.ref.targetId ? btn('View object', 'select-and-go', { id: r.ref.targetId, cls: 'small' }) : ''}</div>`) :
      `<div class="panel" style="padding:.6rem 1rem"><div class="row between"><span><span class="badge">${esc(r.kind)}</span> ${esc(r.kind === 'observation' ? 'Observation: ' + (getObject(g.data.db, r.ref.targetId)?.name || '') : r.title)}</span><span class="faint mono" style="font-size:.74rem">${formatDateTime(r.t)}</span></div><div class="faint" style="font-size:.8rem;margin-top:.2rem">${esc(r.text)}</div></div>`).join('') : panel('Archive', empty('No records match. Complete an observation and analysis to create the first entry.'))}</div>`;
}
