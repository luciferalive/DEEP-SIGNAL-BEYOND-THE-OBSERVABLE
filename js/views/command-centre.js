import { esc, num, pct, days, tone, bar, meter, badge, panel, head, tile, empty, chart, btn } from '../ui-components.js';
import { formatDate, formatClock, dayNumber } from '../time-engine.js';
import { powerBudget, daysRemaining, batteryCap } from '../station.js';
import { crewSummary } from '../crew-management.js';
import { missionProgress } from '../mission-control.js';
import { getObject } from '../astronomy-database.js';
import { unresolvedCount } from '../anomaly-engine.js';
import { shipCondition } from '../spacecraft.js';

export const title = 'Command Centre';
export function render(ui) {
  const g = ui.game, s = g.state, r = s.resources; const p = powerBudget(g); const dr = daysRemaining(g); const cs = crewSummary(g); const cap = batteryCap(g);
  const ship = s.spacecraft[0];
  const history = (k, label, unit, min = 0, max = null) => chart(s.history[k], { unit, label, min, max, formatDate: t => `${formatDate(t)} ${formatClock(t).slice(0, 5)}` });
  const feed = s.log.slice(0, 14).map(l => `<div class="${l.level}"><time>[${formatClock(l.t).slice(0, 5)}]</time><span>${esc(l.text)}</span></div>`).join('');
  const unread = s.messages.filter(m => !m.read);
  const active = s.missions.active.map(a => missionProgress(g, a));
  const objectives = active.flatMap(p => p.objectives.filter(o => !o.done).map(o => `<li>${esc(o.text)} <span class="faint">(${esc(p.def.title)})</span></li>`));
  const analyses = s.analyses.filter(a => a.status === 'active'); const raw = s.datasets.filter(d => d.status === 'raw');
  const running = s.observations.filter(o => o.status === 'running');
  return `${head('Operations', 'Command Centre', `Station overview for ${esc(s.station.name)}. Every figure here updates as the simulation advances.`)}
  <div class="panel" style="margin-bottom:1rem"><div class="grid cols-4">
    ${tile('Date and time', `<span class="mono">${formatDate(s.time.t)}</span>`, `${formatClock(s.time.t)} · mission day ${dayNumber(s.time.t)}`)}
    ${tile('Location', `<span style="font-size:.95rem;font-family:var(--sans)">${esc(s.location.split(' (')[0])}</span>`, esc((s.location.match(/\((.*)\)/) || [])[1] || ''))}
    ${tile('Active spacecraft', `<span style="font-size:.95rem;font-family:var(--sans)">${esc(ship.name)}</span>`, `${esc(ship.status)} · condition ${pct(shipCondition(ship))}`)}
    ${tile('Station condition', `<span class="${tone(s.station.condition, 60, 35)}">${pct(s.station.condition)}</span>`, s.station.brownout ? '<span class="bad">BROWNOUT</span>' : 'All systems nominal')}
  </div></div>
  <div class="grid cols-main">
    <div class="stack">
      ${panel('Reserves', `<div class="grid cols-2">
        <div class="stack">${meter('Power (battery)', `${num(s.station.battery)} / ${num(cap)} kWh`, s.station.battery, cap, tone((s.station.battery / cap) * 100, 25, 10), `Generation ${num(p.gen, 1)} kW · load ${num(p.load, 1)} kW · net ${p.net >= 0 ? '+' : ''}${num(p.net, 1)} kW`)}${history('power', 'Battery', 'kWh', 0, cap)}</div>
        <div class="stack">${meter('Oxygen', `${num(r.oxygen)} kg`, r.oxygen, 1200, tone(dr.oxygen, 60, 20), `${days(dr.oxygen)} remaining at current use`)}${history('oxygen', 'Oxygen', 'kg', 0, 1200)}</div>
        <div class="stack">${meter('Food', `${num(r.food)} kg`, r.food, 1800, tone(dr.food, 60, 20), `${days(dr.food)} remaining`)}${history('food', 'Food', 'kg', 0, 1800)}</div>
        <div class="stack">${meter('Water', `${num(r.water)} L`, r.water, 6000, tone(dr.water, 60, 20), `${days(dr.water)} remaining`)}${history('water', 'Water', 'L', 0, 6000)}</div>
      </div>`, { tag: `<span class="mono muted">${num(s.stats.daysElapsed)} days elapsed</span>` })}
      ${panel('Activity feed', `<div class="feed" aria-live="off">${feed || empty('No activity yet.')}</div>`)}
    </div>
    <div class="stack">
      ${panel('Programme', `<div class="grid cols-2">
        ${tile('Research credits', `<span class="amber">${num(r.credits)} RC</span>`, 'Spendable funds')}
        ${tile('Research points', `${num(r.researchPoints)} RP`, 'For technology')}
        ${tile('Reputation', num(r.reputation), 'Raises grants')}
        ${tile('Observations', num(s.stats.observations), `${running.length} running`)}
      </div>`)}
      ${panel('Crew status', `<div class="stack">${meter('Health', pct(cs.health), cs.health, 100, tone(cs.health, 60, 35))}${meter('Morale', pct(cs.morale), cs.morale, 100, tone(cs.morale, 50, 30))}${meter('Fatigue', pct(cs.fatigue), cs.fatigue, 100, cs.fatigue > 70 ? 'bad' : cs.fatigue > 45 ? 'warn' : 'info')}<div class="faint" style="font-size:.76rem">${cs.count} crew${cs.incapacitated ? ` · <span class="bad">${cs.incapacitated} incapacitated</span>` : ''}</div></div>`, { tag: btn('Manage', 'goto', { id: 'crew', cls: 'small' }) })}
      ${panel('Current objectives', objectives.length ? `<ul style="margin:0;padding-left:1.1rem">${objectives.join('')}</ul>` : empty(s.missions.offered.length ? 'You have missions waiting for a decision in Mission Control.' : 'No active objectives.'), { tag: btn('Mission Control', 'goto', { id: 'missions', cls: 'small' }) })}
      ${panel('Mission progress', active.length ? active.map(p => `<div class="meter" style="margin-bottom:.5rem"><div class="top"><span>${esc(p.def.title)}</span><span class="mono">${p.done}/${p.total}</span></div>${bar(p.done, p.total, 'amber')}</div>`).join('') : empty('No missions in progress.'))}
    </div>
  </div>
  <div class="grid cols-3" style="margin-top:1rem">
    ${panel('Incoming transmissions', unread.length ? `<div class="list">${unread.slice(0, 3).map(m => `<div class="item"><div><b>${esc(m.subject)}</b><div class="faint" style="font-size:.74rem">${esc(m.from)}</div></div></div>`).join('')}</div>` : empty('No unread transmissions.'), { tag: btn('Open', 'goto', { id: 'comms', cls: 'small' }) })}
    ${panel('Active discoveries', `${analyses.length ? analyses.map(a => `<div class="meter" style="margin-bottom:.4rem"><div class="top"><span>${esc(getObject(g.data.db, a.targetId)?.name)}</span><span class="mono">${Math.round((a.progress / a.required) * 100)}%</span></div>${bar(a.progress, a.required, 'info')}</div>`).join('') : ''}${raw.length ? `<p class="muted" style="font-size:.84rem">${raw.length} dataset${raw.length > 1 ? 's' : ''} awaiting analysis.</p>` : ''}${!analyses.length && !raw.length ? empty('Nothing under analysis.') : ''}`, { tag: btn('Laboratory', 'goto', { id: 'lab', cls: 'small' }) })}
    ${panel('Unresolved anomalies', unresolvedCount(g) ? `<div class="list">${s.anomalies.filter(a => a.status === 'unresolved').slice(0, 3).map(a => `<div class="item"><div>${esc(a.title)}<div class="faint" style="font-size:.74rem">${esc(getObject(g.data.db, a.targetId)?.name)}</div></div></div>`).join('')}</div>` : empty('No unresolved anomalies.'), { tag: btn('Investigate', 'goto', { id: 'anomalies', cls: 'small' }) })}
  </div>`;
}
