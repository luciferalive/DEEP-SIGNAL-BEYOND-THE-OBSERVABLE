// Loads every JSON data file. `readJson(path)` is injected so the same code runs in the browser (fetch) and in Node tests (fs).
import { buildDatabase } from './astronomy-database.js';

const ASTRO_FILES = ['solar-system', 'stars', 'exoplanets', 'black-holes', 'galaxies', 'nebulae'];

export async function loadAllData(readJson) {
  const astro = await Promise.all(ASTRO_FILES.map(name => readJson(`data/${name}.json`)));
  const [instruments, technologies, missions, events, modules] = await Promise.all(['instruments', 'technologies', 'missions', 'events', 'modules'].map(n => readJson(`data/${n}.json`)));
  return {
    db: buildDatabase(astro.flat()),
    instruments, technologies, missions: missions.missions, events: events.events, transients: events.transients, modules,
    techById: Object.fromEntries(technologies.active.map(t => [t.id, t])),
    missionById: Object.fromEntries(missions.missions.map(m => [m.id, m]))
  };
}
export const browserReader = async path => {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
};
