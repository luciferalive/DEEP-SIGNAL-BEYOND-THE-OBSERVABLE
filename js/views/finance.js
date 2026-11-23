import { esc, num, panel, head, tile, empty, chart } from '../ui-components.js';
import { formatDate, formatClock } from '../time-engine.js';
import { BASE, DAY } from '../constants.js';
import { financeWarnings, CATEGORIES } from '../finance.js';
import { badge, btn } from '../ui-components.js';

export const title = 'Financial Management';
export function render(ui) {
  const g = ui.game, s = g.state; const day = Math.floor(s.time.t / DAY);
  const nextGrant = s.finance.lastGrantDay + BASE.grantEveryDays; const grant = Math.round(BASE.monthlyGrant * (1 + 0.04 * s.resources.reputation));
  const recent = s.finance.ledger.filter(l => l.t > s.time.t - 30 * DAY); const inc = recent.filter(l => l.amount > 0).reduce((a, l) => a + l.amount, 0); const exp = recent.filter(l => l.amount < 0).reduce((a, l) => a - l.amount, 0);
  const runway = BASE.upkeepPerDay > 0 ? s.resources.credits / BASE.upkeepPerDay : Infinity;
  return `${head('Funding', 'Financial Management', 'Research credits (RC) pay for running the station, observations, repairs and research. Grants and mission rewards bring money in.')}
  ${financeWarnings(g).map(w => `<div class="alert" role="alert" style="margin-bottom:.6rem"><h3 style="margin:0">${w.level === 'bad' ? 'Financial warning' : 'Notice'}</h3><p style="margin:0">${esc(w.text)}</p></div>`).join('')}
  <div class="panel" style="margin-bottom:1rem"><div class="grid cols-4">
    ${tile('Balance', `<span class="amber">${num(s.resources.credits)} RC</span>`, `${runway < 30 ? '<span class="warn">' : ''}${num(runway)} days of upkeep${runway < 30 ? '</span>' : ''}`)}
    ${tile('Daily upkeep', `${BASE.upkeepPerDay} RC`, 'Station and crew')}
    ${tile('Next grant', formatDate((nextGrant) * DAY), `${num(grant)} RC · reputation ${s.resources.reputation}`)}
    ${tile('Last 30 days', `<span class="ok">+${num(inc)}</span> / <span class="bad">−${num(exp)}</span>`, 'income / spending')}
  </div></div>
  <div class="grid cols-2">${panel('Balance history', chart(s.history.credits, { unit: 'RC', label: 'Credits', formatDate: t => `${formatDate(t)} ${formatClock(t).slice(0, 5)}` }))}
  ${panel('How funding works', `<ul class="muted" style="margin:0;padding-left:1.1rem;font-size:.86rem"><li>Upkeep is charged every day.</li><li>A grant arrives every ${BASE.grantEveryDays} days and grows with your scientific reputation.</li><li>Missions pay credits, research points and reputation.</li><li>Sending discoveries to Earth pays a small bonus.</li><li>Supplementary funding offers arrive in Communications.</li><li>Observations cost credits per hour of exposure.</li></ul>`)}</div>
  <div class="grid cols-2" style="margin-top:1rem">${panel('Monthly reports', s.finance.reports.length ? `<div class="table-wrap"><table><tr><th>Closed</th><th class="num">Income</th><th class="num">Spending</th><th class="num">Net</th></tr>${s.finance.reports.slice(0, 12).map(r => `<tr><td class="mono">${formatDate(r.t)}</td><td class="num ok">+${num(r.income)}</td><td class="num bad">−${num(r.expense)}</td><td class="num ${r.net >= 0 ? 'ok' : 'bad'}">${r.net >= 0 ? '+' : ''}${num(r.net)}</td></tr>`).join('')}</table></div><details style="margin-top:.6rem" data-key="fin-cat" ${ui.isOpen('fin-cat') ? 'open' : ''}><summary class="muted" style="cursor:pointer;font-size:.82rem">Latest month by category</summary><table>${Object.entries(s.finance.reports[0].byCat).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num ${v >= 0 ? 'ok' : 'bad'}">${v >= 0 ? '+' : ''}${num(v)}</td></tr>`).join('')}</table></details>` : empty('The first report closes with the first monthly grant.'))}
  ${panel('Emergency reserve', `<p class="muted" style="font-size:.84rem">Set a balance you do not want to fall below. You are warned when the balance drops under it.</p><div class="row"><input id="reserve-in" type="number" min="0" max="5000" step="50" value="${s.finance.reserve}" style="width:7rem" aria-label="Emergency reserve in RC"><span class="mono faint">RC</span>${btn('Set reserve', 'set-reserve', { cls: 'small' })}</div><p class="faint" style="font-size:.76rem;margin:.6rem 0 0">Budget allocation between departments is not implemented yet.</p>`)}</div>
  ${panel('Ledger', s.finance.ledger.length ? `<div class="table-wrap"><table><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th class="num">Balance</th></tr>${s.finance.ledger.slice(0, 40).map(l => `<tr><td class="mono">${formatDate(l.t)}</td><td>${esc(l.label)}</td><td class="num ${l.amount >= 0 ? 'ok' : 'bad'}">${l.amount >= 0 ? '+' : ''}${num(l.amount, 0)}</td><td class="num">${num(l.balance, 0)}</td></tr>`).join('')}</table></div>` : empty('No transactions yet. Start the simulation.'), { cls: '' }).replace('<section class="panel ', '<section style="margin-top:1rem" class="panel ')}`;
}
