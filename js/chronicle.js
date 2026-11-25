// Civilization history: a permanent timeline of milestones. Entries are never deleted (capped at 600 for save size).
export const KINDS = ['station', 'mission', 'discovery', 'research', 'technology', 'event', 'anomaly', 'publication', 'infrastructure', 'finance', 'exploration', 'civilization'];

export function record(game, { kind, title, text = '', major = false, ref = null }) {
  const s = game.state; const e = { id: `h-${s.uid++}`, t: s.time.t, kind, title, text, major, ref };
  s.chronicle.unshift(e);
  // Keep the history bounded for save size. Milestones (major) are kept first: the oldest minor entries are dropped before any major one.
  if (s.chronicle.length > 900) { let drop = s.chronicle.length - 900; for (let i = s.chronicle.length - 1; i >= 0 && drop > 0; i--) if (!s.chronicle[i].major) { s.chronicle.splice(i, 1); drop--; } if (s.chronicle.length > 1400) s.chronicle.length = 1400; }
  return e;
}
export const hasKind = (game, kind) => game.state.chronicle.some(e => e.kind === kind);

// V1 saves have no history. Rebuild what can be proven from the saved data, exactly once.
export function backfill(game) {
  const s = game.state; if (s.flags.chronicleBackfilled) return;
  s.flags.chronicleBackfilled = true; const add = (t, o) => { const e = record(game, o); e.t = t; e.backfilled = true; };
  add(0, { kind: 'station', title: 'Meridian Station established', text: 'Recorded from the original save.', major: true });
  const mc = s.missions.completed.slice().sort((a, b) => a.completedAt - b.completedAt);
  mc.forEach((m, i) => add(m.completedAt, { kind: 'mission', title: `Mission completed: ${game.data.missionById[m.id]?.title || m.id}`, major: i === 0, text: i === 0 ? 'First mission completed.' : '' }));
  const ds = s.discoveries.slice().sort((a, b) => a.t - b.t);
  ds.forEach((d, i) => add(d.t, { kind: 'discovery', title: d.title, major: i === 0, text: i === 0 ? 'First discovery archived.' : '', ref: d.id }));
  for (const [id, t] of Object.entries(s.tech.researched)) add(t, { kind: 'technology', title: `Technology: ${game.data.techById[id]?.name || id}`, major: true });
  for (const h of s.events.history) add(h.resolvedAt ?? h.t, { kind: 'event', title: h.title, text: `Decision: ${h.choice}` });
  for (const a of s.anomalies) add(a.t, { kind: 'anomaly', title: a.title, text: a.status });
  s.chronicle.sort((a, b) => b.t - a.t);
}
export function searchChronicle(game, { query = '', kind = 'all', majorOnly = false } = {}) {
  const q = query.trim().toLowerCase();
  return game.state.chronicle.filter(e => (kind === 'all' || e.kind === kind) && (!majorOnly || e.major) && (!q || (e.title + ' ' + e.text).toLowerCase().includes(q)));
}
