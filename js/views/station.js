import { esc, num, pct, tone, bar, badge, panel, head, btn } from '../ui-components.js';
import { defOf, capacityText, upgradeCost, upgradeDays, powerKw, canUpgrade } from '../station-modules.js';

export const title = 'Station Infrastructure';
export function render(ui) {
  const g = ui.game, s = g.state, max = g.data.modules.maxLevel;
  return `${head('14 · Infrastructure', 'Station Infrastructure', 'Ten modules shape what the station can do. Upgrades cost credits, need a maintenance engineer and take days. Condition wears slowly and weakens a module’s bonus until it is serviced.')}
  <div class="grid cols-3">${g.data.modules.modules.map(d => { const m = s.modules[d.id]; const can = canUpgrade(g, d.id); const cost = upgradeCost(g, d.id);
    return panel(d.name, `<div class="row" style="margin-bottom:.4rem">${badge('Level ' + m.level + ' / ' + max, m.level >= max ? 'ok' : 'known')}${m.upgrade ? badge('upgrading', 'warn') : ''}</div>
    <p class="muted" style="font-size:.84rem">${esc(d.description)}</p>
    <div class="meter"><div class="top"><b>Condition</b><span class="mono">${pct(m.condition)}</span></div>${bar(m.condition, 100, tone(m.condition, 60, 35))}</div>
    <dl class="kv" style="margin:.6rem 0"><dt>Current bonus</dt><dd>${esc(capacityText(g, d.id))}</dd><dt>Extra power</dt><dd class="mono">${powerKw(g, d.id).toFixed(1)} kW</dd>${m.level < max ? `<dt>Next level</dt><dd class="mono">${cost} RC · ${upgradeDays(g, d.id)} days</dd>` : ''}</dl>
    ${m.upgrade ? `<div class="meter"><div class="top"><b>Upgrade to level ${m.upgrade.toLevel}</b><span class="mono">${Math.max(0, m.upgrade.daysLeft).toFixed(1)} d left</span></div>${bar(m.upgrade.total - m.upgrade.daysLeft, m.upgrade.total, 'amber')}</div>` : ''}
    <div class="row">${m.level < max && !m.upgrade ? btn('Upgrade', 'module-upgrade', { id: d.id, cls: 'small primary', disabled: !can.ok, title: can.ok ? '' : can.error }) : ''}${btn('Service (60 RC)', 'module-service', { id: d.id, cls: 'small', disabled: m.condition >= 99 })}</div>${!can.ok && m.level < max && !m.upgrade ? `<p class="faint" style="font-size:.74rem;margin:.4rem 0 0">${esc(can.error)}</p>` : ''}`); }).join('')}</div>`;
}
