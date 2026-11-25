import { esc, badge, panel, head, empty, select } from '../ui-components.js';
import { searchChronicle, KINDS } from '../chronicle.js';
import { memorySummary } from '../endgame.js';
import { formatDateTime } from '../time-engine.js';

export const title = 'Civilization History';
export function render(ui) {
  const g = ui.game, st = ui.s; const rows = searchChronicle(g, { query: st.histQuery, kind: st.histKind, majorOnly: st.histMajor });
  return `${head('Record of the programme', 'Civilization History', 'A permanent timeline of milestones: establishment, missions, discoveries, technologies, events, anomalies, publications and infrastructure.')}
  ${panel('Universe memory', (() => { const m = memorySummary(g); return `<div class="grid cols-4">${m.ledger.map(([l, n]) => `<div><span class="faint" style="font-size:.74rem">${esc(l)}</span><div class="mono" style="font-size:1.2rem">${n}</div></div>`).join('')}</div><p class="faint" style="font-size:.8rem">${m.years.toFixed(1)} years of history · ${m.entries} entries · ${m.major} milestones. ${m.firsts.map(([l, e]) => esc(l) + ': ' + esc(e.title)).join(' · ')}</p>`; })())}
  <div class="row" style="margin-bottom:1rem"><input id="hist-q" type="search" placeholder="Search history…" value="${esc(st.histQuery)}" data-input="history-query" style="min-width:15rem" aria-label="Search history">${select('hist-kind', [['all', 'All kinds'], ...KINDS.map(k => [k, k[0].toUpperCase() + k.slice(1)])], st.histKind, { act: 'history-kind' })}<label class="check"><input type="checkbox" data-act="history-major" ${st.histMajor ? 'checked' : ''}> Major milestones only</label><span class="faint" style="font-size:.78rem">${rows.length} entries</span></div>
  ${rows.length ? `<div class="stack">${rows.slice(0, 200).map(e => `<div class="panel" style="padding:.6rem 1rem;${e.major ? 'border-left:3px solid var(--amber)' : ''}"><div class="row between"><span>${badge(e.kind)} ${e.major ? '<span class="amber" title="Major milestone">★</span> ' : ''}${esc(e.title)}</span><span class="faint mono" style="font-size:.74rem">${formatDateTime(e.t)}${e.backfilled ? ' · reconstructed from an older save' : ''}</span></div>${e.text ? `<div class="faint" style="font-size:.8rem;margin-top:.2rem">${esc(e.text)}</div>` : ''}</div>`).join('')}</div>` : panel('History', empty('No entries match.'))}`;
}
