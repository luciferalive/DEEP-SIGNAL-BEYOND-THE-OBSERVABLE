import { esc, num, badge, panel, head, empty, btn, tabs, bar } from '../ui-components.js';
import { formatDateTime } from '../time-engine.js';
import { STAGES, CAUSES, FOLLOWUP, MESSAGES, ms, arcOf, stageOf, tally, doneCount, clueBlock, networkLinks, confirmedArtificial, defaultOption } from '../mysteries.js';

export const title = 'The Unknown';
const TABS = [['cases', 'Investigations'], ['network', 'Anomaly network'], ['decisions', 'Decisions'], ['civs', 'Civilizations'], ['events', 'Rare events']];
const STEP_TEXT = { observe: s => `Observe with a ${s.instrument} instrument for ${s.hours} h (${s.cost} RC)`, monitor: s => `Monitor for ${s.days} days (${s.cost} RC)`, research: s => `Research ${s.tech} and analyse ${Object.entries(s.data || {}).map(([k, n]) => n + ' ' + k + ' datasets').join(', ')}`, mission: s => `Fly an expedition of type "${s.expType}" (Expeditions)` };

function caseDetail(g, m) {
  const arc = arcOf(g, m.arc); const stage = stageOf(m); const T = tally(m); const live = m.status === 'active';
  const stageBar = `<div class="row" style="gap:.25rem;flex-wrap:wrap;margin:.3rem 0">${STAGES.map((x, i) => `<span class="badge ${x === stage ? 'warn' : ''}" style="opacity:${i <= STAGES.indexOf(stage) ? 1 : .45}">${x}</span>`).join('')}</div>`;
  const clues = arc.clues.map(c => { const cs = m.clues[c.id]; const why = clueBlock(g, m, c.id);
    return `<div class="item"><div><b>${esc(c.title)}</b> ${badge(cs.status, cs.status === 'done' ? 'ok' : cs.status === 'running' ? 'warn' : '')}<div class="faint" style="font-size:.78rem">${esc(STEP_TEXT[c.step.kind](c.step))}</div>${cs.status === 'open' && why ? `<div class="warn" style="font-size:.76rem">${esc(why)}</div>` : ''}</div>
      ${cs.status === 'open' ? btn('Start', 'my-clue', { id: m.id, val: c.id, cls: 'small primary', disabled: !!why }) : ''}</div>`; }).join('');
  const evid = m.evidence.length ? `<div class="table-wrap"><table><tr><th>Evidence</th><th class="num">Weight</th><th>Points to</th></tr>${m.evidence.map(e => `<tr><td>${esc(e.text)}<div class="faint" style="font-size:.72rem">${esc(e.title)} · ${formatDateTime(e.t)}</div></td><td class="num mono">${e.weight}</td><td>${esc(CAUSES[e.points])}</td></tr>`).join('')}</table></div>` : empty('No evidence yet. Start the first step.');
  const hyp = m.hypotheses.map(h => `<div class="item"><div><b>${esc(CAUSES[h.cause])}</b> ${badge(`confidence ${h.confidence}%`)} ${badge(`evidence support ${Math.round(T.support(h.cause) * 100)}%`, T.support(h.cause) * 100 >= h.confidence - 15 ? 'ok' : 'warn')}</div>
      <div class="row">${live && doneCount(m) >= 5 ? btn('Conclude', 'my-conclude', { id: m.id, val: h.cause, cls: 'small primary', disabled: h.confidence < 40 }) : ''}${live ? btn('Withdraw', 'my-withdraw', { id: m.id, val: h.cause, cls: 'small' }) : ''}</div></div>`).join('');
  return panel(arc.title, `<div class="row" style="margin-bottom:.3rem">${badge('FICTIONAL storyline', 'bad')}${badge(m.status, m.status === 'concluded' ? 'ok' : m.status === 'disputed' ? 'bad' : 'warn')}${m.seeded ? badge('seeded by an extraordinary detection') : ''}${m.published ? badge('preliminary report published') : ''}${m.secret ? badge('secret') : ''}</div>
    <p class="muted" style="font-size:.86rem">${esc(arc.blurb)}</p>${stageBar}
    ${m.conclusion ? `<p><b>Conclusion:</b> ${esc(m.conclusion.label)} at ${m.conclusion.confidence}% confidence.${m.reviewNote ? ' <span class="warn">' + esc(m.reviewNote) + '</span>' : ''}</p>` : ''}
    <h4 class="sub">Investigation steps</h4><div class="list">${clues}</div>
    <h4 class="sub">Evidence (noisy and sometimes conflicting)</h4>${evid}
    ${T.lead ? `<p class="faint" style="font-size:.8rem">Weighted evidence currently favours: ${esc(CAUSES[T.lead])} (${Math.round(T.share * 100)}% of weight). ${T.lead === 'artificial' && !confirmedArtificial(m) ? 'Not yet strong enough to confirm an intelligent source (needs 55% of weight and 6+ pieces).' : ''}</p>` : ''}
    ${m.pending ? `<p class="warn" style="font-size:.84rem">Running: ${esc(m.pending.cid)} until ${formatDateTime(m.pending.until)}</p>` : ''}
    ${live ? `<h4 class="sub">Scientific method</h4><div class="row">${Object.entries(FOLLOWUP).map(([k, f]) => btn(`${f.label} (${f.cost} RC, ${f.days} d)`, 'my-followup', { id: m.id, val: k, cls: 'small', disabled: !!m.pending || !m.evidence.length })).join('')}</div>
      <div class="row" style="margin-top:.5rem"><label class="faint" style="font-size:.8rem">Hypothesis <select id="hy-cause">${Object.entries(CAUSES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
      <label class="faint" style="font-size:.8rem">Confidence % <input id="hy-conf" type="number" min="1" max="99" value="50" style="width:4.5rem"></label>${btn('State / revise', 'my-hyp', { id: m.id, cls: 'small' })}</div>` : ''}
    ${m.status === 'disputed' ? btn('Re-open the case', 'my-reopen', { id: m.id, cls: 'small' }) : ''}
    <div class="list" style="margin-top:.5rem">${hyp}</div>`);
}
function network(g) {
  const arcs = g.data.mysteryArcs; const W = 560, H = 320, cx = W / 2, cy = H / 2, R = 120; const pos = {}; arcs.forEach((a, i) => { const ang = i / arcs.length * Math.PI * 2 - Math.PI / 2; pos[a.id] = [cx + R * 1.25 * Math.cos(ang), cy + R * Math.sin(ang)]; });
  const links = networkLinks(g); const started = id => ms(g).list.find(m => m.arc === id);
  const lines = links.map(l => `<line x1="${pos[l.a][0]}" y1="${pos[l.a][1]}" x2="${pos[l.b][0]}" y2="${pos[l.b][1]}" stroke="${l.live ? '#d3a85f' : 'currentColor'}" stroke-opacity="${l.live ? 1 : .3}" stroke-width="${l.live ? 2.5 : 1}" stroke-dasharray="${l.live ? '' : '4 3'}"/>`).join('');
  const nodes = arcs.map(a => { const m = started(a.id); const [x, y] = pos[a.id]; const fill = !m ? '#26303a' : m.status === 'concluded' ? '#4f8f6a' : m.status === 'disputed' ? '#a35454' : '#d3a85f';
    return `<g><circle cx="${x}" cy="${y}" r="${m ? 12 : 7}" fill="${fill}" stroke="currentColor" stroke-opacity=".4"/><text x="${x}" y="${y + 24}" text-anchor="middle" font-size="9.5" fill="currentColor" opacity="${m ? 1 : .5}">${esc(m ? a.title : '? unknown')}</text></g>`; }).join('');
  return panel('Anomaly network', `<p class="muted" style="font-size:.84rem">Investigations share characteristics. Progress in one case can add evidence to another. Gold lines are links already found; dashed lines are possible links between cases you have opened.</p><svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:640px;color:var(--text,#cfd8e0)" role="img" aria-label="Investigation network">${lines}${nodes}</svg><p class="faint" style="font-size:.76rem">${links.length} possible link${links.length === 1 ? '' : 's'}, ${links.filter(l => l.live).length} confirmed. Unopened cases appear as "unknown".</p>`);
}
export function render(ui) {
  const g = ui.game, s = g.state, st = ui.s; const M = ms(g); const tab = st.myTab || 'cases';
  const sel = M.list.find(m => m.id === st.myId) || M.list[0];
  const body = {
    cases: M.list.length ? `<div class="grid cols-main"><div>${panel('Open cases', `<div class="list">${M.list.map(m => `<div class="item"><div><b>${esc(arcOf(g, m.arc).title)}</b><div class="faint" style="font-size:.76rem">${esc(stageOf(m))} · ${m.evidence.length} evidence</div></div>${btn(sel?.id === m.id ? 'Open' : 'View', 'my-select', { id: m.id, cls: 'small' })}</div>`).join('')}</div>`)}</div><div>${sel ? caseDetail(g, sel) : ''}</div></div>` : panel('Investigations', empty('Nothing unexplained yet. Investigations open as your programme grows, from anomalies and from rare cosmic events.')),
    network: network(g),
    decisions: panel('Pending decisions', M.decisions.pending.map(p => { const def = g.data.decisionDefs.find(d => d.id === p.did); const m = M.list.find(x => x.id === p.mid);
      return `<div class="item" style="display:block"><b>${esc(def.title)}</b> ${badge(arcOf(g, m.arc).title)}<p class="muted" style="font-size:.84rem">${esc(def.text)}</p><div class="row">${def.options.map((o, i) => btn(o.label, 'decision-resolve', { id: p.uid, val: i, cls: 'small' })).join('')}</div>${def.options.map(o => `<div class="faint" style="font-size:.76rem">${esc(o.label)}: ${esc(o.note)}</div>`).join('')}<div class="faint" style="font-size:.76rem">Expires ${formatDateTime(p.expiresAt)}: the option "${esc(def.options[defaultOption(def)].label)}" applies by default.</div></div>`; }).join('') || empty('No decision is waiting.')) + (M.decisions.history.length ? panel('Past decisions', `<div class="list">${M.decisions.history.slice(0, 8).map(h => `<div class="item"><span>${esc(g.data.decisionDefs.find(d => d.id === h.did)?.title)}</span>${badge(h.choice + (h.auto ? ' (default)' : ''))}</div>`).join('')}</div>`) : ''),
    civs: M.civs.length ? M.civs.map(c => panel(c.name, `<div class="row" style="margin-bottom:.3rem">${badge('FICTIONAL', 'bad')}${badge(`${num(c.distanceLy)} ly`)}${badge(c.known.intent ? c.disposition : 'disposition unknown')}</div><p class="muted" style="font-size:.86rem">${c.known.technology ? esc(c.reason) : 'Their nature is not yet understood. Only the evidence of a source is known.'}</p>
      <div class="row">${Object.entries(MESSAGES).map(([k, v]) => btn(`${v.label} (${v.cost} RC)`, 'civ-transmit', { id: c.id, val: k, cls: 'small', disabled: c.contacts.some(x => x.status === 'sent') })).join('')}</div>
      <p class="faint mono" style="font-size:.76rem">${c.contacts.length ? c.contacts.map(x => `${x.kind}: ${x.status}${x.replyAt ? ', reply due ' + formatDateTime(x.replyAt) : ', no reply expected'}`).join(' · ') : 'No messages sent. A round trip takes twice the distance in years.'}</p>`)).join('') : panel('Civilizations', empty('No evidence of other civilizations has been confirmed. Strong, repeated, structured evidence is needed.')),
    events: panel('Rare cosmic events', M.rareLog.map(r => { const e = g.data.rareEvents.find(x => x.id === r.id); return `<div class="item"><div><b>${esc(e.title)}</b><div class="faint" style="font-size:.78rem">${esc(e.text)}</div></div>${badge(e.label.split(' ')[0], e.label.startsWith('FICTIONAL') ? 'bad' : 'known')}</div>`; }).join('') || empty('None yet. Rare events occur every few months and may bring contracts or new investigations.'))
  }[tab];
  return `${head('Universe', 'The Unknown', 'Long-running investigations into things that do not fit. Real observing methods, a fictional storyline. Evidence is noisy and the answer is hidden until you commit to a conclusion.')}
  <p class="notice"><b>Real-style</b> methods and instruments; <b>simulated</b> evidence and statistics; <b>fictional</b> objects, civilizations and storylines. Nothing here is a claim about the real universe.</p>
  ${tabs(TABS.map(([id, l]) => [id, id === 'decisions' ? `${l} (${M.decisions.pending.length})` : l]), tab, 'my-tab')}${body}`;
}
