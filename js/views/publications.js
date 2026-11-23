import { esc, badge, panel, head, empty, select, btn, bar } from '../ui-components.js';
import { TYPES, STAGES, sources } from '../publications.js';
import { formatDate } from '../time-engine.js';

export const title = 'Scientific Publications';
export function render(ui) {
  const g = ui.game, s = g.state; const all = sources(g); const st = ui.s;
  const open = all.filter(x => x.ok);
  const key = x => `${x.type}|${x.sourceId}`;
  const sel = open.find(x => key(x) === st.pubSel) || open[0];
  const blocked = all.filter(x => !x.ok && x.reason !== 'Already written.');
  const active = s.publications.filter(p => p.status === 'active'), done = s.publications.filter(p => p.status !== 'active');
  return `${head('Publication', 'Scientific Publications', 'Turn evidence into published work. Each paper passes four stages, and peer review can return it if the evidence is too weak. Published work raises reputation and pays research points and credits.')}
  <div class="grid cols-2">
    ${panel('Start a publication', open.length ? `<div class="stack"><label class="field">Source ${select('pub-sel', open.map(x => [key(x), `${TYPES[x.type].label} · ${x.label}`]), sel ? key(sel) : '', { act: 'pub-select' })}</label>
      ${sel ? `<dl class="kv"><dt>Evidence confidence</dt><dd class="mono">${sel.confidence}%</dd><dt>Cost</dt><dd class="mono">${TYPES[sel.type].cost} RC</dd><dt>Duration</dt><dd class="mono">about ${TYPES[sel.type].days.reduce((a, b) => a + b, 0)} days with full research staffing</dd><dt>Review threshold</dt><dd class="mono">${TYPES[sel.type].threshold}</dd><dt>Reward</dt><dd class="mono">+${TYPES[sel.type].reward.rp} RP · +${TYPES[sel.type].reward.rep} reputation${TYPES[sel.type].reward.credits ? ' · +' + TYPES[sel.type].reward.credits + ' RC' : ''}</dd></dl>
      ${btn('Start publication', 'pub-start', { id: key(sel), cls: 'primary' })}` : ''}</div>` : empty('Nothing is ready to publish yet. Analyse an observation first.'))}
    ${panel('Requirements', `<ul class="muted" style="margin:0;padding-left:1.1rem;font-size:.84rem"><li>Preliminary report: any analysed record with 40%+ confidence.</li><li>Mission report: a completed mission.</li><li>Anomaly report: a resolved anomaly.</li><li>Scientific paper: two or more analysed records of one target, average confidence 60%+.</li><li>Major discovery: an independently verified record with 70%+ confidence.</li></ul>${blocked.length ? `<p class="faint" style="font-size:.76rem;margin:.7rem 0 0">Not yet possible: ${blocked.slice(0, 4).map(x => esc(TYPES[x.type].label + ' (' + x.label + '): ' + x.reason)).join('; ')}</p>` : ''}`)}
  </div>
  <h3 style="margin:1.4rem 0 .6rem">In progress</h3>
  <div class="grid cols-2">${active.length ? active.map(p => panel(p.title, `<div class="stack">${STAGES.map((n, i) => `<div class="row between" style="font-size:.82rem"><span class="${i < p.stage ? 'ok' : i === p.stage ? 'amber' : 'faint'}">${i < p.stage ? '✓' : i === p.stage ? '▸' : '·'} ${n}</span>${i === p.stage ? `<span class="mono faint">${(p.progress).toFixed(1)} / ${TYPES[p.type].days[i]} d</span>` : ''}</div>`).join('')}${bar(p.progress, TYPES[p.type].days[p.stage], 'amber')}<span class="faint" style="font-size:.74rem">Authors: ${esc(p.authors.join(', ') || 'none')}</span></div>`)).join('') : panel('Active', empty('No publications in progress.'))}</div>
  <h3 style="margin:1.4rem 0 .6rem">Record</h3>
  ${done.length ? `<div class="stack">${done.map(p => `<div class="panel" style="padding:.6rem 1rem"><div class="row between"><span>${badge(p.status, p.status === 'published' ? 'ok' : 'warn')} ${esc(p.title)}</span><span class="faint mono" style="font-size:.74rem">${formatDate(p.finishedAt)}</span></div>${p.note ? `<div class="faint" style="font-size:.8rem;margin-top:.3rem">${esc(p.note)}</div>` : `<div class="faint" style="font-size:.78rem;margin-top:.3rem">Authors: ${esc(p.authors.join(', ') || 'none')}</div>`}</div>`).join('')}</div>` : panel('Record', empty('Nothing published yet.'))}`;
}
