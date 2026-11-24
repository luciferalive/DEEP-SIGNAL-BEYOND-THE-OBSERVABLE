import { esc, num, badge, panel, head, empty, select, tabs, unknown, val, btn } from '../ui-components.js';
import { search, GROUPS, formatRA, formatDec, formatDistance, formatUncertainty, formatQuantity, formatPlain, getObject, distanceLy } from '../astronomy-database.js';
import { canObserve } from '../observatory.js';

export const title = 'Universe Explorer';
const COLORS = { star: '#e3c987', exoplanet: '#7fb893', compact: '#d46b6b', galaxy: '#a395c9', nebula: '#6fa7a3', solar: '#d3a85f', cluster: '#9fc4e8', smallbody: '#b39a7a' };
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

function skyMap(ui, list) {
  const W = 720, H = 340; const sel = ui.s.object;
  const x = ra => ((360 - ra) / 360) * W, y = dec => ((90 - dec) / 180) * H;
  let grat = '';
  for (let h = 0; h <= 24; h += 3) grat += `<line class="grat" x1="${x(h * 15)}" x2="${x(h * 15)}" y1="0" y2="${H}"/><text x="${x(h * 15) + 3}" y="${H - 4}">${h}h</text>`;
  for (let d = -60; d <= 60; d += 30) grat += `<line class="grat" y1="${y(d)}" y2="${y(d)}" x1="0" x2="${W}"/><text x="3" y="${y(d) - 3}">${d > 0 ? '+' : ''}${d}°</text>`;
  const pts = list.filter(o => o.ra_deg != null && !(o.group === 'exoplanet')).map(o => {
    const r = o.group === 'galaxy' ? 5.5 : o.group === 'compact' ? 5 : 4;
    return `<g class="pt ${sel === o.id ? 'sel' : ''}" data-act="select-object" data-id="${esc(o.id)}" tabindex="0" role="button" aria-label="${esc(o.name)}"><title>${esc(o.name)}</title><circle class="halo" cx="${x(o.ra_deg)}" cy="${y(o.dec_deg)}" r="11"/><circle class="dot" cx="${x(o.ra_deg)}" cy="${y(o.dec_deg)}" r="${r}" fill="${COLORS[o.group]}"/>${sel === o.id ? `<text x="${x(o.ra_deg) + 8}" y="${y(o.dec_deg) - 6}">${esc(o.name)}</text>` : ''}</g>`;
  }).join('');
  return `<svg class="sky" viewBox="0 0 ${W} ${H}" role="group" aria-label="Sky map in right ascension and declination">${grat}${pts}</svg>
  <div class="legend">${Object.entries(COLORS).filter(([k]) => k !== 'solar').map(([k, c]) => `<span><i style="background:${c}"></i>${esc(GROUPS[k])}</span>`).join('')}<span>Equatorial coordinates (J2000). Exoplanets share their host star's position.</span></div>`;
}
function orrery(ui, list) {
  const planets = list.filter(o => o.group === 'solar' && !o.parent && o.distance_au > 0); const sel = ui.s.object;
  const sun = list.find(o => o.id === 'sun'); const W = 720, H = 340, cx = W / 2, cy = H / 2; const R = au => 14 + Math.sqrt(au) * 27;
  const rings = planets.map(o => `<ellipse cx="${cx}" cy="${cy}" rx="${R(o.distance_au)}" ry="${R(o.distance_au) * 0.46}" fill="none" stroke="#1b2636" vector-effect="non-scaling-stroke"/>`).join('');
  const bodies = planets.map(o => { const a = (hash(o.id) % 360) * Math.PI / 180; const px = cx + Math.cos(a) * R(o.distance_au), py = cy + Math.sin(a) * R(o.distance_au) * 0.46; const moons = list.filter(m => m.parent === o.id);
    return `<g class="pt ${sel === o.id ? 'sel' : ''}" data-act="select-object" data-id="${o.id}" tabindex="0" role="button"><title>${esc(o.name)}</title><circle class="halo" cx="${px}" cy="${py}" r="11"/><circle class="dot" cx="${px}" cy="${py}" r="${o.name === 'Jupiter' || o.name === 'Saturn' ? 6 : 4}" fill="${COLORS.solar}"/><text x="${px + 8}" y="${py - 6}">${esc(o.name)}</text>${moons.map((m, i) => `<g class="pt ${sel === m.id ? 'sel' : ''}" data-act="select-object" data-id="${m.id}"><title>${esc(m.name)}</title><circle class="dot" cx="${px - 9 - i * 6}" cy="${py + 8 + i * 5}" r="2" fill="#8190a5"/></g>`).join('')}</g>`; }).join('');
  return `<svg class="sky" viewBox="0 0 ${W} ${H}" role="group" aria-label="Schematic of the Solar System"><circle cx="${cx}" cy="${cy}" r="8" fill="#e3c987" class="dot"/><g class="pt ${sel === 'sun' ? 'sel' : ''}" data-act="select-object" data-id="sun" tabindex="0" role="button"><title>Sun</title><circle class="halo" cx="${cx}" cy="${cy}" r="12"/></g>${rings}${bodies}</svg>
  <div class="legend"><span>Schematic only: orbit spacing is compressed and positions are not an ephemeris. Moons are shown beside their planet.</span></div>`;
}

function detail(ui, o) {
  const g = ui.game; const s = g.state; const bm = s.bookmarks.includes(o.id); const tr = s.tracked.includes(o.id);
  const insts = s.instruments.map(i => ({ i, c: canObserve(g, i, o) }));
  const row = (k, v) => `<dt>${esc(k)}</dt><dd>${v}</dd>`;
  const props = [['Official designation', esc(o.designation)], ['Common name', esc(o.name)], ['Classification', esc(o.classification)],
    ['Right ascension', o.ra_deg != null ? `<span class="mono">${formatRA(o.ra_deg)}</span>` : unknown()], ['Declination', o.dec_deg != null ? `<span class="mono">${formatDec(o.dec_deg)}</span>` : unknown()],
    ['Distance from Earth', `<span class="mono">${esc(formatDistance(o))}</span>${o.redshift ? ` <span class="faint">(z = ${o.redshift})</span>` : ''}`], ['Distance uncertainty', `<span class="mono">${esc(formatUncertainty(o)) === 'DATA UNKNOWN' ? '' : esc(formatUncertainty(o))}</span>${formatUncertainty(o) === 'DATA UNKNOWN' ? unknown() : ''}`],
    ['Stellar / planetary class', val(o.spectral_type)], ['Mass', o.mass ? `<span class="mono">${esc(formatQuantity(o.mass))}</span>` : unknown()], ['Radius', o.radius ? `<span class="mono">${esc(formatQuantity(o.radius))}</span>` : unknown()],
    ['Temperature', o.temperature_k != null ? `<span class="mono">${num(o.temperature_k)} K</span>` : unknown()], ['Luminosity', o.luminosity_lsun != null ? `<span class="mono">${esc(formatPlain(o.luminosity_lsun, 'L☉'))}</span>` : unknown()]];
  const extra = o.extra.map(e => row(e.label, esc(e.value))).join('');
  return `<section class="panel"><div class="row between" style="margin-bottom:.4rem"><div><h3 style="font-size:1.3rem">${esc(o.name)}</h3><div class="row" style="margin-top:.3rem">${badge('Known universe · real object', 'known')}${badge(GROUPS[o.group])}</div></div>
    <div class="row">${btn(bm ? 'Bookmarked' : 'Bookmark', 'bookmark', { id: o.id, cls: 'small', extra: `aria-pressed="${bm}"` })}${btn(tr ? 'Tracking' : 'Track investigation', 'track', { id: o.id, cls: 'small', extra: `aria-pressed="${tr}"` })}</div></div>
    <dl class="kv" style="margin-top:.8rem">${props.map(([k, v]) => row(k, v)).join('')}${extra}${row('Known characteristics', esc(o.characteristics))}${row('Discovery', val(o.discovery))}${row('Scientific references', o.references.length ? `<ul style="margin:0;padding-left:1rem">${o.references.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : unknown())}${row('Data source', esc(o.source))}${row('Last verified', `${unknown()} <span class="faint" style="font-size:.74rem">Compiled from published catalogue values. Live verification against the archives is planned.</span>`)}</dl>
    <h4 style="margin:1rem 0 .4rem;font-family:var(--sans);font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)">Observation options</h4>
    <div class="stack">${insts.map(({ i, c }) => `<div class="row between" style="font-size:.84rem"><span>${esc(i.name)} <span class="${c.ok ? 'ok' : 'faint'}">${c.ok ? '· in range' : '· ' + esc(c.reason)}</span></span>${btn('Observe', 'target-observe', { id: o.id, val: i.id, cls: 'small primary', disabled: !c.ok })}${btn('Create survey objective', 'survey', { id: o.id, val: i.kind, cls: 'small', disabled: !c.ok, title: 'Creates a mission objective to observe and analyse this object' })}</div>`).join('')}</div></section>`;
}

export function render(ui) {
  const g = ui.game; const st = ui.s; const db = g.data.db;
  const list = search(db, { query: st.query, group: st.group, bookmarks: st.bookmarksOnly ? g.state.bookmarks : null });
  const sel = st.object ? getObject(db, st.object) : null;
  const tracked = g.state.tracked.map(id => getObject(db, id)).filter(Boolean);
  return `${head('Astronomy', 'Universe Explorer', 'A database of real astronomical objects. Values come from published catalogues; anything not known is marked DATA UNKNOWN. Nothing here is fictional.')}
  <div class="panel" style="margin-bottom:1rem"><div class="row between"><div class="panel-title" style="margin:0">Map</div>${tabs([['sky', 'Sky map'], ['solar', 'Solar System']], st.mapMode, 'map-mode')}</div>${st.mapMode === 'solar' ? orrery(ui, db.list) : skyMap(ui, db.list)}</div>
  <div class="grid cols-side">
    <section class="panel"><div class="stack">
      <input id="explorer-q" type="search" placeholder="Search by name or designation…" value="${esc(st.query)}" data-input="explorer-query" aria-label="Search objects">
      <div class="row">${select('explorer-group', [['all', 'All classes'], ...Object.entries(GROUPS)], st.group, { act: 'explorer-group' })}<label class="check"><input type="checkbox" data-act="explorer-bm" ${st.bookmarksOnly ? 'checked' : ''}> Bookmarks only</label></div>
      <div class="faint" style="font-size:.74rem">${list.length} of ${db.list.length} objects${tracked.length ? ` · tracking ${tracked.length}` : ''}</div>
      <div class="list" style="max-height:32rem;overflow-y:auto">${list.map(o => `<div class="item pick ${st.object === o.id ? 'sel' : ''}" data-act="select-object" data-id="${esc(o.id)}" tabindex="0" role="button"><div><div>${esc(o.name)} ${g.state.bookmarks.includes(o.id) ? '<span class="amber" title="Bookmarked">★</span>' : ''}${g.state.tracked.includes(o.id) ? '<span class="info" title="Tracked">◎</span>' : ''}</div><div class="faint" style="font-size:.72rem">${esc(o.classification)}</div></div><span class="mono faint" style="font-size:.72rem;white-space:nowrap">${distanceLy(o) == null ? '' : o.group === 'solar' ? o.distance_au.toFixed(2) + ' AU' : distanceLy(o) === 0 ? 'home' : distanceLy(o) >= 1e6 ? (distanceLy(o) / 1e6).toFixed(1) + ' Mly' : num(distanceLy(o), distanceLy(o) < 100 ? 1 : 0) + ' ly'}</span></div>`).join('') || empty('No objects match.')}</div>
    </div></section>
    <div class="stack">${sel ? detail(ui, sel) : `<section class="panel">${empty('Select an object from the list or the map to see its data.')}</section>`}
      ${tracked.length ? panel('Tracked investigations', `<div class="list">${tracked.map(o => `<div class="item pick" data-act="select-object" data-id="${esc(o.id)}"><span>${esc(o.name)}</span><span class="faint" style="font-size:.76rem">${g.state.discoveries.filter(d => d.targetId === o.id).length} records · ${g.state.datasets.filter(d => d.targetId === o.id).length} datasets</span></div>`).join('')}</div>`) : ''}</div>
  </div>`;
}
