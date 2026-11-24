import { esc, num, badge, panel, head, empty, select, btn } from '../ui-components.js';
import { PROPULSION, SHIELDING, baseClasses, validateDesign, materialsFor, BUILD_DAYS } from '../shipyard.js';
import { activeFacilities } from '../civilization.js';

export const title = 'Shipyard';
export function render(ui) {
  const g = ui.game, s = g.state, st = ui.s; const d = st.design || (st.design = { name: 'Custom vessel', base: 'survey-probe', propulsion: 'chemical', shielding: 'none', bays: 0 });
  const bases = baseClasses(g); const v = validateDesign(g, d); const factory = activeFacilities(g, 'factory').length > 0;
  const avail = (tbl, ok) => Object.entries(tbl).map(([k, x]) => [k, x.label + (ok(x) ? '' : ' (locked)')]);
  const designs = s.designs.map(x => `<div class="item"><div><b>${esc(x.name)}</b> ${badge(x.baseClass)}<div class="faint mono" style="font-size:.76rem">${num(x.cost)} RC · ${materialsFor(x)} materials · speed ${x.speedAuDay.toFixed(3)} AU/d · range ${x.rangeAu} AU · ${x.slots} slots · risk ${x.riskBase}</div></div>
    <div class="row">${btn('Build', 'design-build', { id: x.id, cls: 'small primary', disabled: !factory })}${btn('Delete', 'design-delete', { id: x.id, cls: 'small' })}</div></div>`).join('') || empty('No designs yet.');
  return `${head('Fleet', 'Shipyard', 'Design custom spacecraft from an unlocked chassis, then build them in an orbital factory from stocked materials.')}
  <p class="notice">All performance numbers are simulated game values derived from the real-world classes in the catalogue. Building takes ${BUILD_DAYS} days and needs an operational orbital factory (Worlds and Facilities).</p>
  <div class="grid cols-2">${panel('Design', !g.unlocked('design:custom') ? `<p class="muted">Research <b>In-space manufacturing</b> in the Technology Tree to unlock custom designs.</p>` : `<div class="stack">
    <label class="field">Name <input id="dz-name" value="${esc(d.name)}" data-act="dz-set" maxlength="30"></label>
    <label class="field">Base chassis ${select('dz-base', bases.map(c => [c.id, c.name]), d.base, { act: 'dz-set' })}</label>
    <label class="field">Propulsion ${select('dz-prop', avail(PROPULSION, p => (!p.unlock || g.unlocked(p.unlock)) && (!p.tech || s.tech.researched[p.tech])), d.propulsion, { act: 'dz-set' })}</label>
    <label class="field">Hull ${select('dz-shield', avail(SHIELDING, p => !p.tech || s.tech.researched[p.tech]), d.shielding, { act: 'dz-set' })}</label>
    <label class="field">Extra payload bays (0-3) <input id="dz-bays" type="number" min="0" max="3" value="${d.bays}" data-act="dz-set" style="width:5rem"></label>
    ${v.ok ? `<p class="faint mono" style="font-size:.78rem">${num(v.cls.cost)} RC · ${materialsFor(v.cls)} materials · speed ${v.cls.speedAuDay.toFixed(3)} AU/d · range ${v.cls.rangeAu} AU · ${v.cls.slots} slots · base risk ${v.cls.riskBase}</p>` : `<p class="warn" style="font-size:.82rem">${esc(v.error)}</p>`}
    <div class="row">${btn('Save design', 'design-save', { cls: 'primary', disabled: !v.ok })}</div></div>`)}
  ${panel('Saved designs', `<div class="list">${designs}</div>${factory ? '' : '<p class="warn" style="font-size:.82rem">No operational orbital factory.</p>'}<p class="faint mono" style="font-size:.76rem">Materials in stock: ${num(s.stock.materials, 1)}</p>`)}</div>`;
}
