import { esc, num, badge, panel, head, tile, btn, bar } from '../ui-components.js';
import { civIndex, SAFETY, PACE, TIERS, STAGE_NAMES, worldStage } from '../civilization.js';
import { getObject } from '../astronomy-database.js';

export const title = 'Civilization';
const BODIES = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const rad = au => 24 + 52 * Math.log10(1 + au * 2.2);
function map(g) {
  const s = g.state; const cx = 300, cy = 190; const parts = [`<circle cx="${cx}" cy="${cy}" r="7" fill="#e3c987"/>`];
  const pos = {}; BODIES.forEach((id, i) => { const o = getObject(g.data.db, id); if (!o) return; const r = rad(o.distance_au || 1), a = i * 2.4 + 0.5; pos[id] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".1"/>`, `<circle cx="${pos[id][0]}" cy="${pos[id][1]}" r="${id === 'jupiter' || id === 'saturn' ? 6 : 4}" fill="#6fa7a3"/>`, `<text x="${pos[id][0] + 7}" y="${pos[id][1] + 3}" font-size="9" fill="currentColor" opacity=".7">${esc(o.name)}</text>`); });
  pos.moon = [pos.earth[0] + 10, pos.earth[1] - 9]; parts.push(`<circle cx="${pos.moon[0]}" cy="${pos.moon[1]}" r="2" fill="#aaa"/>`);
  for (const id of Object.keys(g.data.worlds.worlds)) { const st = worldStage(g, id); if (!pos[id] || !st) continue; parts.push(`<circle cx="${pos[id][0]}" cy="${pos[id][1]}" r="${6 + st}" fill="none" stroke="#7fb893" stroke-width="1.5" stroke-dasharray="${st >= 3 ? '' : '2 2'}"><title>${esc(id)}: ${STAGE_NAMES[st]}</title></circle>`); }
  s.facilities.filter(f => f.status === 'active').forEach((f, i) => { const p = pos[f.site] || [cx + 14 + i * 3, cy + 14]; parts.push(`<rect x="${p[0] - 3}" y="${p[1] + 6 + (i % 3) * 5}" width="5" height="5" fill="#d3a85f"><title>${esc(f.type)} at ${esc(f.site)}</title></rect>`); });
  return `<svg viewBox="0 0 600 380" width="100%" style="max-width:640px;color:var(--text,#cfd8e0)" role="img" aria-label="Solar System map (radius not to scale)">${parts.join('')}</svg>`;
}
export function render(ui) {
  const g = ui.game, s = g.state; const idx = civIndex(g); const pol = s.civ.policy;
  const next = TIERS.find(([min]) => min > idx.score);
  return `${head('Civilization', 'Civilization', 'The state of your programme beyond the station: index, policies and a map of what you have reached.')}
  <div class="grid cols-4" style="margin-bottom:1rem">${tile('Stage', idx.tier, `index ${idx.score}${next ? ` · next at ${next[0]}` : ' · highest stage'}`)}${tile('Science', idx.science, 'discoveries and technology')}${tile('Infrastructure', idx.infrastructure, 'facilities and modules')}${tile('Exploration', idx.exploration, 'worlds and missions')}</div>
  <div class="grid cols-4" style="margin-bottom:1rem">${tile('Stability', idx.stability, 'morale, funds, reputation')}${tile('Population', idx.population, 'crew and facility staff')}${tile('Settlements', s.facilities.filter(f => f.type === 'outpost' && f.settledDays >= 60).length, 'outposts with 8+ staff')}${tile('Interstellar', s.interstellar.length, 'probes launched')}</div>
  <div class="grid cols-2">${panel('Map of the Solar System', map(g) + '<p class="faint" style="font-size:.76rem">Orbit radii are compressed (not to scale); angles are decorative. Green rings: exploration stage. Amber squares: active facilities.</p>')}
  <div class="stack">${panel('Safety doctrine', `<p class="muted" style="font-size:.84rem">Changes mission risk and cost for every expedition.</p><div class="row">${Object.entries(SAFETY).map(([k, v]) => btn(`${v.label} (risk ×${v.risk}, cost ×${v.cost})`, 'policy-set', { id: 'safety', val: k, cls: `small ${pol.safety === k ? 'primary' : ''}` })).join('')}</div>`)}
  ${panel('Expansion pace', `<p class="muted" style="font-size:.84rem">Rapid pace builds facilities faster but raises facility running costs.</p><div class="row">${Object.entries(PACE).map(([k, v]) => btn(`${v.label} (build ×${v.build}, upkeep ×${v.upkeep})`, 'policy-set', { id: 'pace', val: k, cls: `small ${pol.pace === k ? 'primary' : ''}` })).join('')}</div>`)}</div></div>`;
}
