// Event scheduler: things that happen at a future game time (ship stages, deliveries, training...). Stored in the save.
const handlers = new Map();
export const onSchedule = (type, fn) => handlers.set(type, fn);
export function schedule(game, t, type, payload = {}) {
  const q = game.state.schedule; const item = { t, type, payload, id: game.state.uid++ };
  let i = q.length; while (i > 0 && q[i - 1].t > t) i--; q.splice(i, 0, item); return item;
}
export const cancelScheduled = (game, pred) => { game.state.schedule = game.state.schedule.filter(x => !pred(x)); };
export function runDue(game) {
  const q = game.state.schedule; let guard = 0;
  while (q.length && q[0].t <= game.state.time.t && guard++ < 500) { const it = q.shift(); handlers.get(it.type)?.(game, it.payload, it); }
}
export const pendingOf = (game, type) => game.state.schedule.filter(x => x.type === type);
