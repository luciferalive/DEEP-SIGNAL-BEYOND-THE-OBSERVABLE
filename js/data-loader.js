// Loads every JSON data file. `readJson(path)` is injected so the same code runs in the browser (fetch) and in Node tests (fs).
import { buildDatabase } from './astronomy-database.js';

const ASTRO_FILES = ['solar-system', 'stars', 'exoplanets', 'black-holes', 'galaxies', 'nebulae', 'pulsars', 'clusters', 'small-bodies'];

export async function loadAllData(readJson) {
  const astro = await Promise.all(ASTRO_FILES.map(name => readJson(`data/${name}.json`)));
  const [instruments, technologies, missions, events, modules, spacecraft, expTypes] = await Promise.all(['instruments', 'technologies', 'missions', 'events', 'modules', 'spacecraft', 'expedition-types'].map(n => readJson(`data/${n}.json`)));
  return {
    db: buildDatabase(astro.flat()),
    instruments, technologies, missions: missions.missions, events: events.events, transients: events.transients, modules, spacecraft, expTypes: expTypes.types,
    classById: Object.fromEntries(spacecraft.classes.map(c => [c.id, c])), equipById: Object.fromEntries(spacecraft.equipment.map(c => [c.id, c])), typeById: Object.fromEntries(expTypes.types.map(c => [c.id, c])),
    techById: Object.fromEntries(technologies.active.map(t => [t.id, t])),
    missionById: Object.fromEntries(missions.missions.map(m => [m.id, m]))
  };
}
export const browserReader = async path => {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
};
