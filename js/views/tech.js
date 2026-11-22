import { esc, pct, bar, badge, panel, head, btn } from '../ui-components.js';
import { canStartTech } from '../research-engine.js';

export const title = 'Technology Tree';
export function render(ui) {
  const g = ui.game, s = g.state; const t = g.data.technologies;
  const branches = [...new Set(t.active.map(x => x.branch))];
  return `${head('08 · Development', 'Technology Tree', 'Spend research points and credits to unlock technologies. Each one changes how the station performs; limitations are listed. Only technologies that work in this version are shown as researchable.')}
  <div class="row" style="margin-bottom:1rem"><span class="mono">${s.resources.researchPoints} RP</span><span class="mono amber">${Math.round(s.resources.credits).toLocaleString('en-US')} RC</span>${s.tech.active ? badge(`Researching: ${g.data.techById[s.tech.active.id].name}`, 'warn') : badge('Laboratory free', 'ok')}</div>
  ${branches.map(b => `<h3 style="margin:1.2rem 0 .6rem">${esc(b)}</h3><div class="grid cols-3">${t.active.filter(x => x.branch === b).map(x => {
    const done = !!s.tech.researched[x.id]; const act = s.tech.active?.id === x.id; const c = canStartTech(g, x.id);
    return panel(x.name, `<div class="row" style="margin-bottom:.4rem">${done ? badge('researched', 'ok') : act ? badge('in progress', 'warn') : c.ok ? badge('available', 'known') : badge('locked')}</div><p class="muted" style="font-size:.84rem">${esc(x.description)}</p><p style="font-size:.84rem"><b>Effect:</b> ${esc(x.effectText)}<br><span class="muted"><b>Limitation:</b> ${esc(x.limitation)}</span></p>
    <p class="faint mono" style="font-size:.76rem">${x.costRP} RP · ${x.costCredits} RC · ${x.days} days${x.requires.length ? ' · requires ' + esc(x.requires.map(r => g.data.techById[r].name).join(', ')) : ''}</p>
    ${act ? bar(s.tech.active.progress, x.days, 'amber') : ''}${!done && !act ? `<div class="row">${btn('Start research', 'tech-start', { id: x.id, cls: 'small primary', disabled: !c.ok })}${!c.ok ? `<span class="faint" style="font-size:.74rem">${esc(c.error)}</span>` : ''}</div>` : ''}`);
  }).join('')}</div>`).join('')}
  <h3 style="margin:1.6rem 0 .6rem">Roadmap</h3><div class="grid cols-3">${t.planned.map(p => `<div class="roadmap"><b>${esc(p.branch)}</b> · version ${esc(p.version)}<br>${p.items.map(esc).join(' · ')}<br><span class="faint">Not yet researchable.</span></div>`).join('')}</div>`;
}
