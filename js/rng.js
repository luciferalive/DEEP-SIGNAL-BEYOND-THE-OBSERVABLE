// Deterministic PRNG (mulberry32). The state lives in the game state so saves replay the same way.
export function nextRandom(state) {
  state.rng = (state.rng + 0x6D2B79F5) | 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const pick = (rand, list) => list[Math.floor(rand() * list.length)];
export function weightedPick(rand, list, weightOf) {
  const total = list.reduce((s, x) => s + weightOf(x), 0);
  let r = rand() * total;
  for (const item of list) { r -= weightOf(item); if (r <= 0) return item; }
  return list[list.length - 1];
}
