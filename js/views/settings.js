import { esc, badge, panel, head, empty, select, btn } from '../ui-components.js';
import { SLOTS } from '../save-manager.js';
import { GAME_VERSION, GAME_NAME } from '../constants.js';

export const title = 'Settings';
const slotName = s => (s === 'autosave' ? 'Autosave' : 'Manual slot ' + s.split('-')[1]);
export function render(ui) {
  const g = ui.game, p = g.prefs; const saves = ui.saveList || [];
  const row = slot => { const m = saves.find(x => x.slot === slot)?.meta;
    return `<tr><td>${slotName(slot)}</td><td>${m ? `${esc(new Date(m.savedAt).toLocaleString())}<div class="faint" style="font-size:.72rem">Game date ${esc(new Date(Date.UTC(2189, 0, 1) + m.gameTime * 1000).toISOString().slice(0, 10))} · ${m.credits} RC · ${m.discoveries} discoveries</div>` : '<span class="faint">Empty</span>'}</td>
    <td><div class="row">${slot !== 'autosave' ? btn('Save here', 'save-slot', { id: slot, cls: 'small primary' }) : ''}${btn('Load', 'load-slot', { id: slot, cls: 'small', disabled: !m })}${btn('Export', 'export-slot', { id: slot, cls: 'small', disabled: !m })}${btn('Delete', 'delete-slot', { id: slot, cls: 'small danger', disabled: !m })}</div></td></tr>`; };
  return `${head('17 · System', 'Settings', 'Preferences, saves and game management. Saves are stored in your browser (IndexedDB) and can be exported as files.')}
  <div class="grid cols-2">
    ${panel('Preferences', `<div class="stack"><label class="check"><input type="checkbox" data-act="pref-autopause" ${p.autoPauseOnEvent ? 'checked' : ''}> Pause the simulation when an event needs a decision</label>
      <label class="field">Autosave interval ${select('pref-autosave', [[0, 'Off'], [30, 'Every 30 seconds'], [60, 'Every minute'], [180, 'Every 3 minutes'], [600, 'Every 10 minutes']], p.autosaveSeconds, { act: 'pref-autosave' })}</label>
      <label class="field">Interface size ${select('pref-scale', [[0.9, 'Small'], [1, 'Normal'], [1.15, 'Large'], [1.3, 'Extra large']], p.uiScale, { act: 'pref-scale' })}</label>
      <label class="field">Simulation speed ${select('pref-speed', [[0, 'Paused'], [1, '1 min per second'], [2, '10 min per second'], [3, '1 hour per second'], [4, '6 hours per second'], [5, '1 day per second']], g.state.time.speed, { act: 'pref-speed' })}</label></div>`)}
    ${panel('Game', `<div class="stack"><div class="row">${btn('New game', 'new-game', { cls: 'danger' })}${btn('Export current game', 'export-current', { cls: '' })}<label class="btn" style="cursor:pointer">Import save…<input type="file" accept=".json,application/json" data-act="import-file" hidden></label></div>
      <p class="faint" style="font-size:.8rem;margin:0">New game and importing never overwrite a save without asking you first.</p>
      <dl class="kv"><dt>Game</dt><dd>${esc(GAME_NAME)}</dd><dt>Version</dt><dd class="mono">${GAME_VERSION}</dd><dt>Save format</dt><dd class="mono">v${g.state.version}</dd></dl></div>`)}
  </div>
  ${panel('Backups (made automatically before a save is upgraded)', saves.filter(x => x.slot.startsWith('backup-')).length ? `<div class="table-wrap"><table><tr><th>Backup</th><th>Game date</th><th>Actions</th></tr>${saves.filter(x => x.slot.startsWith('backup-')).map(x => `<tr><td class="mono">${esc(x.slot)}</td><td class="mono">${esc(new Date(Date.UTC(2189, 0, 1) + x.meta.gameTime * 1000).toISOString().slice(0, 10))}</td><td><div class="row">${btn('Load', 'load-slot', { id: x.slot, cls: 'small' })}${btn('Export', 'export-slot', { id: x.slot, cls: 'small' })}${btn('Delete', 'delete-slot', { id: x.slot, cls: 'small danger' })}</div></td></tr>`).join('')}</table></div>` : empty('No backups yet. One is created the first time an older save is loaded.')).replace('<section class="panel ', '<section style="margin-top:1rem" class="panel ')}
  ${panel('Saves', `<div class="table-wrap"><table><tr><th>Slot</th><th>Saved</th><th>Actions</th></tr>${SLOTS.map(row).join('')}</table></div>`).replace('<section class="panel ', '<section style="margin-top:1rem" class="panel ')}`;
}
