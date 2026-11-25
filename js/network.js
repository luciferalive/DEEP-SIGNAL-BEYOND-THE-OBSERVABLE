// V5.6 Civilization networks. Eight networks have a capacity built from facilities and colonies, and a demand created by them.
// When demand exceeds capacity, colonies lose efficiency. Five priorities can be weighted by the player once Network engineering is researched.
import { activeFacilities } from './civilization.js';

export const NETWORKS = ['research', 'communications', 'logistics', 'transportation', 'energy', 'manufacturing', 'exploration', 'autonomy'];
export const PRIORITY_KEYS = ['research', 'logistics', 'energy', 'manufacturing', 'exploration'];
export const PRIORITY_DEFAULT = { research: 20, logistics: 20, energy: 20, manufacturing: 20, exploration: 20 };
export const priorities = game => game.state.network?.priority || PRIORITY_DEFAULT;
const colonies = game => (game.state.colonies || []).filter(c => c.status === 'active');
const fac = (game, type) => activeFacilities(game, type).length;
const col = (game, type) => colonies(game).filter(c => c.type === type).length;

export function capacity(game) {
  const s = game.state; const act = activeFacilities(game); const auto = act.filter(f => !f.pop).length;
  return { research: 10 + 6 * fac(game, 'outpost') + 10 * col(game, 'station'), communications: 10 + 12 * fac(game, 'relay') + 16 * col(game, 'relay'),
    logistics: 10 + 8 * (fac(game, 'mine-ore') + fac(game, 'mine-ice')) + 12 * col(game, 'mine') + 6 * fac(game, 'factory') + 10 * col(game, 'hub'),
    transportation: 10 + 6 * fac(game, 'factory') + 12 * col(game, 'hub') + 10 * (game.unlocked('ops:fleets') ? 1 : 0), energy: 10 + 4 * act.length + 8 * colonies(game).length,
    manufacturing: 10 + 15 * fac(game, 'factory') + 20 * col(game, 'hub'), exploration: 10 + 3 * (s.galaxy?.count || 0) + (game.unlocked('ops:fleets') ? 15 : 0), autonomy: 10 + 8 * auto + (game.unlocked('ops:autonomous') ? 10 : 0) };
}
export function demand(game) {
  const s = game.state; const C = colonies(game); const far = C.reduce((a, c) => a + (c.distanceLy || 0) / 20, 0); const act = activeFacilities(game);
  return { research: 4 + 3 * C.length + 2 * (s.mysteries?.list.filter(m => m.status === 'active').length || 0), communications: 5 + 6 * C.length + 2 * act.length, logistics: 5 + 6 * C.length + 3 * act.length + far,
    transportation: 5 + 5 * C.length + far, energy: 5 + 3 * act.length + 6 * C.length, manufacturing: 5 + 2 * act.length + 3 * C.length, exploration: 5 + 4 * (s.galaxy?.count || 0) / 3, autonomy: 5 + 2 * act.length + 3 * C.length };
}
export function efficiency(game, key) { const c = capacity(game)[key], d = demand(game)[key]; return Math.max(0.3, Math.min(1, c / d)); }
export const managed = game => game.unlocked('network:manage');
// Priority effect: a share above 20% helps that network, below 20% hurts it. Without Network engineering all priorities are neutral.
export const netMult = (game, key) => (managed(game) ? 1 + ((priorities(game)[key] ?? 20) - 20) / 150 : 1);
export function setPriorities(game, p) {
  if (!managed(game)) return { ok: false, error: 'Research Civilization network engineering first.' };
  const vals = PRIORITY_KEYS.map(k => Math.round(+p[k])); if (vals.some(v => !(v >= 0 && v <= 100))) return { ok: false, error: 'Each share must be 0 to 100.' };
  const sum = vals.reduce((a, b) => a + b, 0); if (sum !== 100) return { ok: false, error: `Priorities must total 100% (now ${sum}%).` };
  game.state.network.priority = Object.fromEntries(PRIORITY_KEYS.map((k, i) => [k, vals[i]])); return { ok: true };
}
