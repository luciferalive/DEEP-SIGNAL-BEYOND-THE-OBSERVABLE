import { esc, num, bar, badge, panel, head, empty, tabs, btn } from '../ui-components.js';
import { missionProgress } from '../mission-control.js';
import { formatDate } from '../time-engine.js';

export const title = 'Mission Control';
const rewardText = r => [r.credits ? `${num(r.credits)} RC` : '', r.researchPoints ? `${r.researchPoints} RP` : '', r.reputation ? `+${r.reputation} reputation` : ''].filter(Boolean).join(' · ') || 'No reward';
export function render(ui) {
  const g = ui.game, s = g.state, tab = ui.s.missionTab;
  const active = s.missions.active.map(a => ({ a, p: missionProgress(g, a) }));
  const body = {
    active: active.length ? active.map(({ a, p }) => panel(p.def.title, `<div class="row" style="margin-bottom:.4rem">${badge(p.def.issuer)}${p.def.fictional ? badge('simulated future organisation', 'fiction') : ''}${a.status === 'report-ready' ? badge('report ready', 'ok') : ''}</div><p class="muted" style="font-size:.86rem">${esc(p.def.briefing)}</p>
      <ul style="list-style:none;padding:0;margin:.4rem 0">${p.objectives.map(o => `<li style="padding:.15rem 0">${o.done ? '<span class="ok">✔</span>' : '<span class="faint">○</span>'} ${esc(o.text)}</li>`).join('')}</ul>${bar(p.done, p.total, 'amber')}
      <div class="row between" style="margin-top:.7rem"><span class="faint" style="font-size:.78rem">Reward: ${rewardText(p.def.rewards)} · accepted ${formatDate(a.acceptedAt)}</span>${btn('Submit mission report', 'submit-report', { id: a.id, cls: 'primary small', disabled: a.status !== 'report-ready' })}</div>`)).join('') : panel('Active missions', empty('No active missions. Check the Offered tab or the Communications inbox.')),
    offered: s.missions.offered.length ? s.missions.offered.map(id => { const d = g.data.missionById[id]; return panel(d.title, `<div class="row" style="margin-bottom:.4rem">${badge(d.issuer)}${badge('simulated future message', 'fiction')}</div><p class="muted" style="font-size:.86rem">${esc(d.briefing)}</p><ul style="margin:.3rem 0 .6rem;padding-left:1.1rem">${d.objectives.map(o => `<li>${esc(o.text)}</li>`).join('')}</ul><div class="row between"><span class="faint" style="font-size:.78rem">Reward: ${rewardText(d.rewards)}</span><span class="row">${btn('Decline', 'mission-decline', { id, cls: 'small' })}${btn('Accept mission', 'mission-accept', { id, cls: 'small primary' })}</span></div>`); }).join('') : panel('Offered missions', empty('No missions are waiting for a decision.')),
    completed: s.missions.completed.length ? panel('Completed missions', `<div class="list">${[...s.missions.completed].reverse().map(c => `<div class="item"><span>${esc((g.data.missionById[c.id] || s.customMissions?.find(x => x.id === c.id))?.title)}</span><span class="faint mono" style="font-size:.76rem">${formatDate(c.completedAt)}</span></div>`).join('')}</div>`) : panel('Completed missions', empty('Nothing completed yet.'))
  }[tab];
  return `${head('Operations', 'Mission Control', 'Assignments from Earth and self-directed surveys. Every objective is checked automatically against your observations, analyses and research. Messages from Earth organisations are simulated future communications, not real events.')}
  ${tabs([['active', `Active (${active.length})`], ['offered', `Offered (${s.missions.offered.length})`], ['completed', `Completed (${s.missions.completed.length})`]], tab, 'mission-tab')}
  <div class="grid cols-2">${body}</div>
  ${tab === 'active' ? '<p class="faint" style="font-size:.78rem;margin-top:1rem">Tip: create your own survey objectives from the Universe Explorer.</p>' : ''}`;
}
