import { esc, num, badge, panel, head, tile, btn, bar } from '../ui-components.js';
import { achievementProgress, eraOf, ERAS, refineCost } from '../endgame.js';
import { formatDateTime } from '../time-engine.js';

export const title = 'Frontier';
export function render(ui) {
  const g = ui.game, s = g.state; const ap = achievementProgress(g); const done = ap.filter(a => a.done).length; const rc = refineCost(g);
  return `${head('Civilization', 'Frontier and Achievements', 'There is no final boss. Civilization-scale achievements mark eras, and the universe keeps going after each one.')}
  <div class="grid cols-4" style="margin-bottom:1rem">${tile('Era', eraOf(g), `${done} of ${ap.length} achievements`)}${tile('Methods refined', s.refinements || 0, '+2% data yield each')}${tile('Years elapsed', (s.time.t / 86400 / 365.25).toFixed(1), 'in the universe')}${tile('Next era at', (ERAS.find(([m]) => m > done) || ['-'])[0], 'achievements')}</div>
  <div class="grid cols-2">${ap.map(a => panel(a.title, `<div class="row" style="margin-bottom:.3rem">${a.done ? badge('achieved ' + formatDateTime(s.achievements.done[a.id]), 'ok') : badge('in progress', 'warn')}${badge(a.label)}</div><p class="muted" style="font-size:.86rem">${esc(a.text)}</p>${bar(a.value, a.target, a.done ? 'ok' : '')}<p class="faint mono" style="font-size:.76rem">${num(a.value)} / ${num(a.target)} · reward ${a.reward.rep} reputation, ${a.reward.rp} RP</p>`)).join('')}</div>
  ${panel('Continuous improvement', `<p class="muted" style="font-size:.86rem">With 30 technologies researched, methods can be refined indefinitely (up to 25 levels), so research never runs dry. New investigations and contracts also keep arriving.</p><div class="row">${btn(`Refine methods (${rc.rp} RP, ${num(rc.rc)} RC)`, 'refine', { cls: 'small primary' })}</div>`)}`;
}
