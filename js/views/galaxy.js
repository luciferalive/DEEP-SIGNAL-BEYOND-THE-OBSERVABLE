import { esc, num, badge, panel, head, empty, btn, tile } from '../ui-components.js';
import { RINGS, SECTORS_PER_RING, sectorId, sectorName, mapRangeLy, ringReachable, canSurvey, surveyCost, surveyDays, surveyedIds, explorationRadiusLy, mappedFraction, systemsOf, parseSector } from '../galaxy.js';
import { formatDateTime } from '../time-engine.js';

export const title = 'Galactic Map';
const CX = 260, CY = 260, R0 = 30, DR = 27;
function wedge(ring, az) {
  const r1 = R0 + ring * DR, r2 = r1 + DR - 2; const a1 = (az * 60 - 90) * Math.PI / 180 + 0.02, a2 = ((az + 1) * 60 - 90) * Math.PI / 180 - 0.02; const p = (r, a) => `${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`;
  return `M${p(r1, a1)} L${p(r2, a1)} A${r2} ${r2} 0 0 1 ${p(r2, a2)} L${p(r1, a2)} A${r1} ${r1} 0 0 0 ${p(r1, a1)}Z`;
}
export function render(ui) {
  const g = ui.game, s = g.state, st = ui.s; const sel = st.sector || null; const secs = s.galaxy.sectors;
  const cells = []; for (let r = 0; r < RINGS.length; r++) for (let a = 0; a < SECTORS_PER_RING; a++) { const id = sectorId(r, a); const x = secs[id]; const reach = ringReachable(g, r);
    const fill = x?.status === 'done' ? '#4f8f6a' : x?.status === 'running' ? '#d3a85f' : reach ? '#2b3a46' : '#171d23';
    cells.push(`<path d="${wedge(r, a)}" fill="${fill}" stroke="${sel === id ? '#fff' : 'currentColor'}" stroke-opacity="${sel === id ? 1 : .25}" stroke-width="${sel === id ? 2 : 1}" data-act="sector-select" data-id="${id}" tabindex="0" role="button" aria-label="${esc(sectorName(id))}" style="cursor:pointer"><title>${esc(sectorName(id))}: ${x?.status === 'done' ? 'surveyed' : x?.status === 'running' ? 'survey running' : reach ? 'unexplored' : 'beyond mapping range'}</title></path>`); }
  const svg = `<svg viewBox="0 0 520 520" width="100%" style="max-width:560px;color:var(--text,#cfd8e0)" role="img" aria-label="Galactic sector map"><circle cx="${CX}" cy="${CY}" r="6" fill="#e3c987"><title>Sun</title></circle>${cells.join('')}<text x="${CX + 10}" y="${CY - 6}" font-size="9" fill="currentColor" opacity=".6">Sun</text></svg>`;
  let detail = '<p class="faint">Select a sector. Distances are from the Sun; angular position follows right ascension in six 60° slices.</p>';
  if (sel) { const x = secs[sel]; const p = parseSector(sel); const can = canSurvey(g, sel); const sys = systemsOf(g, sel);
    detail = `<div class="row" style="margin-bottom:.4rem"><b>${esc(sectorName(sel))}</b>${badge(x?.status || (ringReachable(g, p.ring) ? 'unexplored' : 'beyond range'), x?.status === 'done' ? 'ok' : x?.status === 'running' ? 'warn' : '')}</div>
    ${x?.status === 'running' ? `<p class="warn">Survey completes ${formatDateTime(x.doneAt)}.</p>` : ''}
    ${!x || x.status === 'running' ? '' : ''}${x?.status !== 'done' && x?.status !== 'running' ? `<p class="faint mono" style="font-size:.78rem">Survey: ${num(surveyCost(p.ring))} RC · ${surveyDays(g, p.ring)} days</p><div class="row">${btn('Start survey', 'sector-survey', { id: sel, cls: 'primary small', disabled: !can.ok })}${!can.ok ? `<span class="warn" style="font-size:.8rem">${esc(can.error)}</span>` : ''}</div>` : ''}
    ${sys.length ? `<div class="list" style="margin-top:.6rem">${sys.map(y => `<div class="item"><div><b>${esc(y.name)}</b> ${badge(y.real ? 'REAL star' : 'FICTIONAL', y.real ? 'known' : 'bad')}<div class="faint mono" style="font-size:.76rem">${num(y.distance_ly)} ly · class ${esc(y.starClass)} · ${y.planets.length} planet${y.planets.length === 1 ? '' : 's'}${y.real ? ' (planets SIMULATED)' : ''}</div></div></div>`).join('')}</div>` : ''}`; }
  return `${head('Civilization', 'Galactic Map', 'Survey the galaxy sector by sector. Real stars appear where they are catalogued; every other system is procedurally generated and marked FICTIONAL.')}
  <p class="notice"><b>Real</b>: stars from the astronomy database. <b>Fictional (procedural)</b>: all other systems, generated from your save's seed. <b>Simulated</b>: planet ratings, including those of real stars (no real survey data exists for them).</p>
  <div class="grid cols-4" style="margin-bottom:1rem">${tile('Mapping range', `${num(mapRangeLy(g))} ly`, 'grows with technology')}${tile('Explored out to', `${num(explorationRadiusLy(g))} ly`, 'outermost surveyed ring')}${tile('Sectors mapped', `${surveyedIds(g).length} / ${RINGS.length * SECTORS_PER_RING}`, `${(mappedFraction(g) * 100).toFixed(0)}% of the map`)}${tile('Systems known', Object.values(secs).reduce((a, x) => a + (x.systems?.length || 0), 0), 'real and fictional')}</div>
  <div class="grid cols-2"><div class="panel" style="text-align:center">${svg}<p class="faint" style="font-size:.76rem">Rings: ${RINGS.join(', ')} ly. Green: surveyed. Amber: in progress. Dark: beyond range.</p></div>${panel('Sector', detail)}</div>`;
}
