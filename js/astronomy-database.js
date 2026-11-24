// The astronomy database: real objects only. Unknown values stay null and are shown as "DATA UNKNOWN".
import { LY_PER_AU } from './constants.js';

export const GROUPS = {
  solar: 'Solar System', star: 'Stars', exoplanet: 'Exoplanets', compact: 'Black holes and compact objects', galaxy: 'Galaxies', nebula: 'Nebulae and remnants', unknown: 'Unclassified (FICTIONAL)', cluster: 'Star clusters', smallbody: 'Asteroids and comets'
};
export const UNKNOWN = 'DATA UNKNOWN';

export function buildDatabase(list) {
  const byId = new Map();
  for (const o of list) {
    if (byId.has(o.id)) throw new Error(`Duplicate astronomy id: ${o.id}`);
    byId.set(o.id, o);
  }
  return { list, byId };
}

export const getObject = (db, id) => db.byId.get(id) || null;

// Distance from the observer in light-years, or null if unknown. Solar System bodies use their mean solar distance.
export function distanceLy(obj) {
  if (obj.distance_ly != null) return obj.distance_ly;
  if (obj.distance_au != null) return Math.max(obj.distance_au, 0.0001) * LY_PER_AU;
  return null;
}

export function search(db, { query = '', group = 'all', bookmarks = null } = {}) {
  const q = query.trim().toLowerCase();
  return db.list.filter(o => {
    if (group !== 'all' && o.group !== group) return false;
    if (bookmarks && !bookmarks.includes(o.id)) return false;
    if (!q) return true;
    return [o.name, o.designation, o.classification, o.spectral_type, o.id].some(v => v && String(v).toLowerCase().includes(q));
  });
}

export function formatRA(deg) {
  if (deg == null) return UNKNOWN;
  const hours = deg / 15; const h = Math.floor(hours); const m = Math.floor((hours - h) * 60); const s = ((hours - h) * 60 - m) * 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${s.toFixed(1).padStart(4, '0')}s`;
}
export function formatDec(deg) {
  if (deg == null) return UNKNOWN;
  const sign = deg < 0 ? '−' : '+'; const a = Math.abs(deg); const d = Math.floor(a); const m = Math.floor((a - d) * 60); const s = ((a - d) * 60 - m) * 60;
  return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}′ ${s.toFixed(0).padStart(2, '0')}″`;
}
export function formatDistance(obj) {
  if (obj.distance_au != null && obj.distance_ly == null) return obj.distance_au === 0 ? '0 AU (the Sun)' : `${obj.distance_au.toFixed(3)} AU from the Sun (mean)`;
  const ly = obj.distance_ly;
  if (ly == null) return UNKNOWN;
  if (ly === 0) return 'Observer is inside this galaxy';
  const e = obj.distance_err_ly;
  const unit = v => (v >= 1e9 ? `${(v / 1e9).toFixed(2)} Gly` : v >= 1e6 ? `${(v / 1e6).toFixed(2)} Mly` : v >= 1e4 ? `${Math.round(v).toLocaleString('en-US')} ly` : `${v < 100 ? v.toFixed(v < 10 ? 4 : 2) : Math.round(v).toLocaleString('en-US')} ly`);
  return unit(ly);
}
export function formatUncertainty(obj) {
  if (obj.distance_au != null && obj.distance_ly == null) return 'Not applicable (moving object)';
  if (obj.distance_ly === 0) return 'Not applicable';
  const e = obj.distance_err_ly;
  if (!e) return UNKNOWN;
  const unit = v => (v >= 1e6 ? `${(v / 1e6).toFixed(2)} Mly` : v >= 1000 ? `${Math.round(v).toLocaleString('en-US')} ly` : `${v < 1 ? v.toFixed(4) : v.toFixed(v < 10 ? 3 : 0)} ly`);
  return e[0] === e[1] ? `± ${unit(e[0])}` : `−${unit(e[0])} / +${unit(e[1])}`;
}
export function formatQuantity(q, digits = 4) {
  if (!q || q.value == null) return UNKNOWN;
  const v = q.value;
  const text = Math.abs(v) >= 1e6 || (Math.abs(v) < 0.001 && v !== 0) ? v.toExponential(2).replace('e+', ' × 10^').replace('e-', ' × 10^−') : Number(v.toPrecision(digits)).toLocaleString('en-US');
  const err = q.err != null ? ` ± ${Math.abs(q.err) >= 1e6 ? q.err.toExponential(1).replace('e+', ' × 10^') : Number(q.err.toPrecision(2)).toLocaleString('en-US')}` : '';
  return `${text}${err} ${q.unit}`;
}
export const formatPlain = (v, unit = '') => (v == null ? UNKNOWN : `${Number(v.toPrecision(4)).toLocaleString('en-US')}${unit ? ' ' + unit : ''}`);
