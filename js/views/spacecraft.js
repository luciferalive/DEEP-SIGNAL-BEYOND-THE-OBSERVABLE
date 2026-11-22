import { esc, num, pct, tone, bar, badge, panel, head, btn } from '../ui-components.js';
import { shipCondition, FUEL_COST_PER_KG, REPAIR_COST } from '../spacecraft.js';

export const title = 'Spacecraft';
const LABEL = { propulsion: 'Propulsion', power: 'Power', navigation: 'Navigation', communications: 'Communications', lifeSupport: 'Life support', radiation: 'Radiation protection', computing: 'Computing' };
export function render(ui) {
  const g = ui.game;
  return `${head('05 · Fleet', 'Spacecraft', 'Your vessels. This version provides one research vessel with refuelling and repair. Upgrades, new hulls and autonomous probes arrive in version 0.5.')}
  <div class="grid cols-2">${g.state.spacecraft.map(sh => panel(sh.name, `<div class="row" style="margin-bottom:.6rem">${badge(sh.type)}${badge(sh.status, 'ok')}${badge(sh.propulsion)}</div><p class="muted" style="font-size:.84rem">${esc(sh.notes)}</p>
    <div class="meter"><div class="top"><b>Propellant</b><span class="mono">${num(sh.fuel)} / ${num(sh.fuelCap)} kg</span></div>${bar(sh.fuel, sh.fuelCap, tone((sh.fuel / sh.fuelCap) * 100, 30, 10))}</div>
    <div class="row" style="margin:.5rem 0 1rem">${btn(`Refuel +100 kg (${Math.round(100 * FUEL_COST_PER_KG)} RC)`, 'refuel', { id: sh.id, val: 100, cls: 'small' })}${btn(`Fill tanks`, 'refuel', { id: sh.id, val: 9999, cls: 'small' })}</div>
    <h4 style="font-family:var(--sans);font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:0 0 .5rem">Systems · overall ${pct(shipCondition(sh))}</h4>
    <div class="stack">${Object.entries(sh.systems).map(([k, v]) => `<div class="row between"><div style="flex:1;min-width:8rem"><div class="row between" style="font-size:.8rem"><span>${LABEL[k] || k}</span><span class="mono">${pct(v)}</span></div>${bar(v, 100, tone(v, 50, 25))}</div>${btn(`Repair (${REPAIR_COST} RC)`, 'repair-ship', { id: sh.id, val: k, cls: 'small', disabled: v >= 100 })}</div>`).join('')}</div>`)).join('')}
  <div class="stack"><div class="roadmap"><b>Not yet available (version 0.5):</b> new research vessels, long-range expedition ships, autonomous probes, observation platforms, component upgrades (power, propulsion, navigation, communications, life support, radiation protection, computing, autonomous intelligence). The vessel cannot yet fly missions; it serves as the station's lifeboat and test platform.</div>
  <div class="roadmap"><b>Propulsion path:</b> chemical (current) → ion → advanced nuclear → fusion → antimatter research → experimental, fictional technologies (warp, wormhole transport) in later versions.</div></div></div>`;
}
