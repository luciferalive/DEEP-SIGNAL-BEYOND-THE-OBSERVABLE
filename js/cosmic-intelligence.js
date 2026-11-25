// V5.5 Cosmic intelligence: decoding transmissions, learning the history of a FICTIONAL civilization and studying its technology.
// Understanding grows slowly and with uncertainty: each decoding effort adds a noisy amount of progress, and every revelation is gated by that progress.
import { spend } from './finance.js';
import { record } from './chronicle.js';
import { ms } from './mysteries.js';

export const DECODE_RP = 100; export const MILESTONES = [25, 50, 75, 100];
export const civOf = (game, id) => ms(game).civs.find(c => c.id === id);
export const loreOf = (game, civ) => game.data.civLore.sets[civ.disposition] || game.data.civLore.sets.curious;
export function decodeProgress(civ) { return civ.decode?.progress || 0; }
export function investDecoding(game, civId) {
  const s = game.state; const civ = civOf(game, civId); if (!civ) return { ok: false, error: 'Unknown civilization.' };
  const d = (civ.decode ||= { progress: 0, efforts: 0, revealed: 0, studied: [] }); if (d.progress >= 100) return { ok: false, error: 'Fully decoded.' };
  if (s.resources.researchPoints < DECODE_RP) return { ok: false, error: `Needs ${DECODE_RP} research points.` };
  const radio = s.datasets.filter(x => x.status === 'analysed' && x.kind === 'radio').length; if (radio < 2) return { ok: false, error: 'Needs 2 analysed radio datasets of their transmissions.' };
  s.resources.researchPoints -= DECODE_RP; const gain = Math.round(6 + game.rand() * 8 + Math.min(6, radio / 3)); d.progress = Math.min(100, d.progress + gain); d.efforts++;
  const lore = loreOf(game, civ);
  while (d.revealed < MILESTONES.length && d.progress >= MILESTONES[d.revealed]) { const text = lore.history[d.revealed]; d.revealed++; civ.known.technology = true; civ.known.intent = d.revealed >= 3;
    game.log(`Decoding milestone (${MILESTONES[d.revealed - 1]}%) for ${civ.name}.`, 'good'); record(game, { kind: 'civilization', title: `Decoded: history of ${civ.name} (${d.revealed}/4)`, text, major: d.revealed === 4, ref: civ.id }); }
  return { ok: true, gain };
}
export const TECH_STUDY_RP = 200;
export function studyTechnology(game, civId) {
  const s = game.state; const civ = civOf(game, civId); const d = civ?.decode; if (!d || d.progress < 50) return { ok: false, error: 'Decode at least 50% first.' };
  const lore = loreOf(game, civ); const i = d.studied.length; if (i >= lore.tech.length) return { ok: false, error: 'All technologies in the decoded record have been studied.' };
  if (!spend(game, 800, `Study of an unknown technology`) ) return { ok: false, error: 'Needs 800 RC.' };
  if (s.resources.researchPoints < TECH_STUDY_RP) { s.resources.credits += 800; return { ok: false, error: `Needs ${TECH_STUDY_RP} research points.` }; }
  s.resources.researchPoints -= TECH_STUDY_RP; d.studied.push(lore.tech[i]); game.log(`Technology studied (FICTIONAL): ${lore.tech[i]} +3% data yield.`, 'good');
  record(game, { kind: 'civilization', title: `Studied a technology of ${civ.name}`, text: lore.tech[i], ref: civ.id }); return { ok: true };
}
export const studiedCount = game => ms(game).civs.reduce((a, c) => a + (c.decode?.studied.length || 0), 0);
