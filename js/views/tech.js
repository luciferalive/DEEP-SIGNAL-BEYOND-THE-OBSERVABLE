import { esc, badge, panel, head, btn, bar } from '../ui-components.js';
import { canStartTech } from '../research-engine.js';

export const title = 'Technology Tree';
const STATUS_TONE = { established: 'ok', hypothesis: 'warn', speculative: 'bad', fictional: 'bad' };
const COLW = 190, ROWH = 54, NW = 164, NH = 38, PADL = 110;

function layout(techs) {
  const byId = Object.fromEntries(techs.map(t => [t.id, t])); const depth = {};
  const dep = id => depth[id] ?? (depth[id] = byId[id].requires.length ? 1 + Math.max(...byId[id].requires.map(dep)) : 0);
  techs.forEach(t => dep(t.id));
  const branches = [...new Set(techs.map(t => t.branch))]; const pos = {}; let row = 0; const bands = [];
  for (const b of branches) {
    const start = row; const used = {};
    for (const t of techs.filter(x => x.branch === b).sort((x, y) => depth[x.id] - depth[y.id])) { const d = depth[t.id]; const r = used[d] = (used[d] ?? start - 1) + 1; pos[t.id] = { x: PADL + d * COLW, y: 8 + r * ROWH, d }; row = Math.max(row, r + 1); }
    bands.push({ b, y0: 8 + start * ROWH - 6, y1: 8 + row * ROWH - 10 }); }
  return { pos, bands, width: PADL + (Math.max(...Object.values(depth)) + 1) * COLW, height: 8 + row * ROWH };
}

export function render(ui) {
  const g = ui.game, s = g.state; const techs = g.data.technologies.active; const L = layout(techs);
  const sel = techs.find(t => t.id === ui.s.tech) || null;
  const state = t => s.tech.researched[t.id] ? 'done' : s.tech.active?.id === t.id ? 'active' : canStartTech(g, t.id).ok ? 'ready' : 'locked';
  const fill = { done: 'var(--ok,#4f8f6a)', active: 'var(--amber,#d3a85f)', ready: 'var(--accent,#6fa7a3)', locked: 'var(--panel-2,#26303a)' };
  const lines = techs.flatMap(t => t.requires.map(r => { const a = L.pos[r], b = L.pos[t.id]; return `<path d="M${a.x + NW} ${a.y + NH / 2} C${a.x + NW + 22} ${a.y + NH / 2} ${b.x - 22} ${b.y + NH / 2} ${b.x} ${b.y + NH / 2}" fill="none" stroke="currentColor" stroke-opacity=".35"/>`; }));
  const nodes = techs.map(t => { const p = L.pos[t.id]; const st = state(t); const nm = t.name.length > 24 ? t.name.slice(0, 23) + '…' : t.name;
    return `<g data-act="tech-select" data-id="${esc(t.id)}" tabindex="0" role="button" aria-label="${esc(t.name)} (${st})" style="cursor:pointer"><rect x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="6" fill="${fill[st]}" fill-opacity="${st === 'locked' ? 1 : .8}" stroke="${sel?.id === t.id ? '#fff' : 'currentColor'}" stroke-opacity="${sel?.id === t.id ? 1 : .3}" stroke-width="${sel?.id === t.id ? 2 : 1}" stroke-dasharray="${t.status === 'established' ? '' : '4 3'}"/><text x="${p.x + 8}" y="${p.y + 16}" font-size="11" fill="currentColor">${esc(nm)}</text><text x="${p.x + 8}" y="${p.y + 31}" font-size="9.5" fill="currentColor" opacity=".7">${t.costRP} RP · ${t.days} d · ${esc(t.status)}</text></g>`; });
  const bands = L.bands.map(b => `<text x="6" y="${(b.y0 + b.y1) / 2 + 4}" font-size="11" fill="currentColor" opacity=".8">${esc(b.b)}</text><line x1="0" x2="${L.width}" y1="${b.y1 + 2}" y2="${b.y1 + 2}" stroke="currentColor" stroke-opacity=".12"/>`);
  let detail = '<p class="faint">Select a technology in the tree to see what it does, what it needs and its limitations.</p>';
  if (sel) { const c = canStartTech(g, sel.id); const done = !!s.tech.researched[sel.id]; const act = s.tech.active?.id === sel.id;
    detail = `<div class="row" style="margin-bottom:.4rem"><b>${esc(sel.name)}</b>${badge(sel.branch)}${badge(sel.status, STATUS_TONE[sel.status])}${done ? badge('researched', 'ok') : act ? badge('in progress', 'warn') : ''}</div>
    <p class="muted" style="font-size:.86rem">${esc(sel.description)}</p><p style="font-size:.84rem"><b>Effect:</b> ${esc(sel.effectText)}</p><p class="faint" style="font-size:.8rem"><b>Limitation:</b> ${esc(sel.limitation)}</p>
    <p class="faint mono" style="font-size:.76rem">${sel.costRP} RP · ${sel.costCredits} RC · ${sel.days} days${sel.requires.length ? ' · requires ' + esc(sel.requires.map(r => g.data.techById[r].name).join(', ')) : ''}${Object.keys(sel.data || {}).length ? ' · data: ' + Object.entries(sel.data).map(([k, n]) => `${n} analysed ${k}`).join(', ') : ''}</p>
    ${act ? bar(s.tech.active.progress, sel.days, 'amber') : ''}${!done && !act ? `<div class="row">${btn('Start research', 'tech-start', { id: sel.id, cls: 'small primary', disabled: !c.ok })}${!c.ok ? `<span class="faint" style="font-size:.78rem">${esc(c.error)}</span>` : ''}</div>` : ''}`; }
  return `${head('Development', 'Technology Tree', 'Established science, hypotheses and speculation are marked. Dashed outlines are not established science. Some technologies need analysed data of a given kind before they can start.')}
  <div class="row" style="margin-bottom:.8rem"><span class="mono">${s.resources.researchPoints} RP</span><span class="mono amber">${Math.round(s.resources.credits).toLocaleString('en-US')} RC</span>${s.tech.active ? badge(`Researching: ${esc(g.data.techById[s.tech.active.id].name)}`, 'warn') : badge('No active research')}<span class="faint" style="font-size:.78rem">Legend: green researched · amber in progress · teal available · grey locked</span></div>
  ${panel('Selected technology', detail)}
  <div class="panel" style="overflow-x:auto;margin-top:1rem"><svg viewBox="0 0 ${L.width} ${L.height}" width="${L.width}" height="${L.height}" style="color:var(--text,#cfd8e0);min-width:${L.width}px" role="img" aria-label="Technology tree">${bands.join('')}${lines.join('')}${nodes.join('')}</svg></div>
  <h3 style="margin:1.4rem 0 .6rem">Roadmap</h3><div class="grid cols-3">${g.data.technologies.planned.map(p => `<div class="roadmap"><b>${esc(p.branch)}</b> · version ${esc(p.version)}<br>${p.items.map(esc).join(' · ')}<br><span class="faint">Not yet researchable.</span></div>`).join('')}</div>`;
}
