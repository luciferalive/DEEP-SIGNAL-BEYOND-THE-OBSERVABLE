import { esc, num, pct, bar, badge, panel, head, empty, btn, tile } from '../ui-components.js';
import { getObject } from '../astronomy-database.js';
import { analysisRate } from '../research-engine.js';
import { workRates } from '../crew-management.js';
import { formatDuration, formatDate } from '../time-engine.js';

export const title = 'Research Laboratory';
export function render(ui) {
  const g = ui.game, s = g.state; const rates = workRates(g); const rate = analysisRate(g);
  const active = s.analyses.filter(a => a.status === 'active'); const raw = s.datasets.filter(d => d.status === 'raw'); const done = s.analyses.filter(a => a.status === 'done').slice(0, 6);
  const staff = s.crew.filter(c => c.assignment === 'research' && c.health >= 25);
  const tech = s.tech.active;
  return `${head('04 · Science', 'Research Laboratory', 'Analyse observation data into scientific results and earn research points to spend in the Technology Tree.')}
  <div class="panel" style="margin-bottom:1rem"><div class="grid cols-4">
    ${tile('Research points', `${num(s.resources.researchPoints)} RP`, 'Spent on technologies')}
    ${tile('Laboratory staff', String(staff.length), staff.length ? esc(staff.map(c => c.name.split(' ').slice(-1)[0]).join(', ')) : '<span class="warn">Assign crew to Research</span>')}
    ${tile('Analysis throughput', `${rate.toFixed(1)} work-h/h`, `Pipeline bonus +${Math.round(g.techEffect('analysisSpeed') * 100)}%`)}
    ${tile('Analyses completed', num(s.stats.analyses), `${num(s.discoveries.length)} records archived`)}
  </div></div>
  <div class="grid cols-2">
    ${panel('Analysis queue', `${active.length ? active.map(a => `<div class="meter" style="margin-bottom:.7rem"><div class="top"><span>${esc(getObject(g.data.db, a.targetId).name)}</span><span class="mono">${pct((a.progress / a.required) * 100)} · ${rate > 0 ? formatDuration(((a.required - a.progress) / (rate / active.length)) * 3600) + ' left' : 'stalled'}</span></div>${bar(a.progress, a.required, 'info')}</div>`).join('') : empty('Nothing is being analysed.')}${active.length >= 3 ? '<p class="warn" style="font-size:.8rem">The laboratory is full (3 analyses).</p>' : ''}`)}
    ${panel('Raw datasets', raw.length ? `<div class="list">${raw.map(d => `<div class="item"><div>${esc(getObject(g.data.db, d.targetId).name)}<div class="faint" style="font-size:.74rem">${d.hours} h ${d.kind} · ${d.sizeGB} GB · quality ${pct(d.quality * 100)}${d.partial ? ' · incomplete (confidence will be capped)' : ''}</div></div>${btn('Start analysis', 'analyse', { id: d.id, cls: 'small primary', disabled: rates.research <= 0 || active.length >= 3 })}</div>`).join('')}</div>` : empty('No raw datasets. Observe something first.'))}
  </div>
  <div class="grid cols-2" style="margin-top:1rem">
    ${panel('Research project', tech ? (() => { const t = g.data.techById[tech.id]; return `<b>${esc(t.name)}</b><p class="muted" style="font-size:.84rem">${esc(t.description)}</p><div class="meter"><div class="top"><b>Progress</b><span class="mono">${pct((tech.progress / tech.days) * 100)}</span></div>${bar(tech.progress, tech.days, 'amber')}</div><p class="faint" style="font-size:.76rem">Effect on completion: ${esc(t.effectText)}</p>`; })() : `${empty('No technology project is running.')}${btn('Open Technology Tree', 'goto', { id: 'tech', cls: 'small' })}`)}
    ${panel('Recent analyses', done.length ? `<div class="list">${done.map(a => `<div class="item"><span>${esc(getObject(g.data.db, a.targetId).name)}</span><span class="faint mono" style="font-size:.74rem">${formatDate(a.finishedAt)}</span></div>`).join('')}</div>` : empty('No finished analyses yet.'))}
  </div>`;
}
