import { record } from './chronicle.js';
// The permanent scientific record. Every completed analysis creates an entry with a timestamp and evidence.
const label = c => (c >= 75 ? 'High' : c >= 55 ? 'Moderate' : 'Low');

export function recordDiscovery(game, { ds, obj, first, rp }) {
  const s = game.state;
  const confidence = Math.round(100 * (0.4 + 0.6 * ds.quality)) - (ds.partial ? 10 : 0);
  const inst = s.instruments.find(i => i.id === ds.instrumentId);
  const d = {
    id: `disc-${s.uid++}`, t: s.time.t, targetId: obj.id, category: 'Known Universe', type: first ? 'First characterisation by this programme' : 'Follow-up observation record',
    title: `${first ? 'Characterisation' : 'Follow-up'}: ${obj.name}`, instrumentId: ds.instrumentId, evidence: [ds.id, ds.obsId], quality: ds.quality, hours: ds.hours,
    confidence, confidenceLabel: label(confidence), rp, sentToEarth: false, verification: null,
    summary: `${ds.hours} h ${inst?.kind || ''} observation of ${obj.name} analysed (data quality ${(ds.quality * 100) | 0}%${ds.partial ? ', incomplete' : ''}). Results are consistent with the catalogue characterisation of this ${obj.classification.toLowerCase()}. Catalogue values: see Universe Explorer.`
  };
  s.discoveries.unshift(d);
  record(game, { kind: 'discovery', title: d.title, major: s.discoveries.length === 1, text: s.discoveries.length === 1 ? 'First discovery archived.' : `${d.confidenceLabel} confidence.`, ref: d.id });
  game.log(`Analysis complete: ${obj.name} (${d.confidenceLabel} confidence, +${rp} research points).`, 'good');
  return d;
}

export function searchArchive(game, { query = '', type = 'all' } = {}) {
  const q = query.trim().toLowerCase(); const s = game.state; const rows = [];
  for (const d of s.discoveries) rows.push({ kind: 'discovery', t: d.t, title: d.title, text: d.summary, ref: d });
  for (const o of s.observations.filter(o => o.status !== 'running')) rows.push({ kind: 'observation', t: o.end, title: `Observation: ${o.targetId}`, text: `${o.hours} h, ${o.status}, quality ${o.quality != null ? ((o.quality * 100) | 0) + '%' : 'n/a'}`, ref: o });
  for (const a of s.anomalies) rows.push({ kind: 'anomaly', t: a.t, title: a.title, text: `${a.status}${a.resolution ? ': ' + a.resolution : ''}`, ref: a });
  for (const m of s.missions.completed) rows.push({ kind: 'mission report', t: m.completedAt, title: `Mission report: ${game.data.missionById[m.id]?.title}`, text: 'Mission completed and reported to Earth.', ref: m });
  for (const id of Object.keys(s.tech.researched)) rows.push({ kind: 'technology', t: s.tech.researched[id], title: `Technology: ${game.data.techById[id]?.name}`, text: game.data.techById[id]?.effectText || '', ref: id });
  return rows.filter(r => (type === 'all' || r.kind === type) && (!q || (r.title + ' ' + r.text).toLowerCase().includes(q))).sort((a, b) => b.t - a.t);
}
