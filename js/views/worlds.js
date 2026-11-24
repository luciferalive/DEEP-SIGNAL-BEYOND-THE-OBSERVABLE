import { esc, num, badge, panel, head, empty, select, btn, tile } from '../ui-components.js';
import { getObject } from '../astronomy-database.js';
import { STAGE_NAMES, worldStage, maxStage, canBuild, activeFacilities, isConnected, outputFactor, relaysNeeded, siteAu, MATERIAL_IMPORT_RC, STAFF_COST, SERVICE_FACILITY_RC } from '../civilization.js';

export const title = 'Worlds and Facilities';
export function render(ui) {
  const g = ui.game, s = g.state, st = ui.s; const ids = Object.keys(g.data.worlds.worlds);
  const name = id => id === 'station' ? 'Meridian Station' : getObject(g.data.db, id)?.name || id;
  const fsel = st.facType || g.data.facilities[0].id; const ft = g.data.facilityById[fsel]; const site = ft.sites.includes(st.facSite) ? st.facSite : ft.sites[0]; const can = canBuild(g, fsel, site);
  const worlds = ids.map(id => { const w = g.data.worlds.worlds[id], stg = worldStage(g, id), mx = maxStage(g, id);
    return `<div class="item"><div><b>${esc(name(id))}</b> ${badge(STAGE_NAMES[stg], stg >= 3 ? 'ok' : stg ? 'known' : '')}${mx < 4 ? badge('no surface site possible', 'bad') : ''}
      <div class="faint" style="font-size:.78rem">${esc(w.note)}${stg >= 3 ? ` Resource assessment: volatiles ${w.volatiles}/3, materials ${w.materials}/3 (simulated rating).` : ''}</div></div></div>`; }).join('');
  const facs = s.facilities.length ? s.facilities.map(f => { const t = g.data.facilityById[f.type];
    return `<div class="item"><div><b>${esc(t.name)}</b> at ${esc(name(f.site))} ${badge(f.status, f.status === 'active' ? 'ok' : 'warn')}${f.status === 'active' ? badge(isConnected(g, f) ? 'connected' : `needs ${relaysNeeded(siteAu(g, f.site))} relays`, isConnected(g, f) ? 'ok' : 'bad') : ''}
      <div class="faint mono" style="font-size:.76rem">${f.status === 'building' ? `completes ${new Date(Date.UTC(2189, 0, 1) + f.completeAt * 1000).toISOString().slice(0, 10)}` : `condition ${Math.round(f.condition)}% · staff ${f.pop}/${t.staffCap} · output ×${outputFactor(g, f).toFixed(2)} · produced ${num(f.produced)}`}</div></div>
      ${f.status === 'active' ? `<div class="row">${t.staffCap ? btn(`Staff +2 (${2 * STAFF_COST} RC)`, 'fac-staff', { id: f.id, cls: 'small', disabled: f.pop + 2 > t.staffCap }) : ''}${btn(`Service (${SERVICE_FACILITY_RC} RC)`, 'fac-service', { id: f.id, cls: 'small' })}</div>` : ''}</div>`; }).join('') : empty('No facilities yet. Survey a world, research the technology, then build.');
  return `${head('Civilization', 'Worlds and Facilities', 'Survey other worlds with real expeditions, then build facilities that extend communications, mine resources, manufacture spacecraft and house people.')}
  <p class="notice">Real: the bodies and their qualitative resources. Simulated: all ratings, costs, outputs and timings. Surface stages need a vessel that can land; remote observations do not advance them.</p>
  <div class="grid cols-4" style="margin-bottom:1rem">${tile('Materials', num(s.stock.materials, 1), 'construction stock')}${tile('Volatiles', num(s.stock.volatiles, 1), 'refuels ships (1 unit = 4 kg)')}${tile('Active facilities', activeFacilities(g).length, `${s.facilities.filter(f => f.status === 'building').length} under construction`)}${tile('Relays', activeFacilities(g, 'relay').length, '+25 AU range each')}</div>
  <div class="grid cols-main"><div class="stack">${panel('Worlds', `<div class="list">${worlds}</div>`)}</div>
  <div class="stack">${panel('Build a facility', `<div class="stack"><label class="field">Facility ${select('fac-type', g.data.facilities.map(f => [f.id, f.name + (f.unlock && !g.unlocked(f.unlock) ? ' (locked)' : '')]), fsel, { act: 'fac-set' })}</label>
      <label class="field">Site ${select('fac-site', ft.sites.map(x => [x, name(x)]), site, { act: 'fac-set' })}</label>
      <p class="muted" style="font-size:.84rem">${esc(ft.description)} ${esc(ft.effect)}</p><p class="faint mono" style="font-size:.76rem">${num(ft.cost)} RC · ${ft.materials} materials · ${ft.days} days · upkeep ${ft.upkeepPerDay} RC/day${ft.minStage ? ` · needs ${STAGE_NAMES[ft.minStage].toLowerCase()}` : ''}</p>
      <div class="row">${btn('Build', 'fac-build', { cls: 'primary', disabled: !can.ok })}${!can.ok ? `<span class="warn" style="font-size:.8rem">${esc(can.error)}</span>` : ''}</div></div>`)}
    ${panel('Import materials', `<p class="muted" style="font-size:.84rem">Ship construction materials from Earth at ${MATERIAL_IMPORT_RC} RC per unit until you can mine your own.</p><div class="row">${btn('Import 20', 'mat-import', { val: 20, cls: 'small' })}${btn('Import 50', 'mat-import', { val: 50, cls: 'small' })}${btn('Import 100', 'mat-import', { val: 100, cls: 'small' })}</div>`)}
    ${panel('Facilities', `<div class="list">${facs}</div>`)}</div></div>`;
}
