import { loadAllData, browserReader } from './data-loader.js';
import { SaveManager, IndexedDbBackend, MemoryBackend } from './save-manager.js';
import { Clock } from './time-engine.js';
import { UI } from './ui-manager.js';

function starfield() {
  const c = document.getElementById('stars'); const x = c.getContext('2d'); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const draw = () => { c.width = innerWidth; c.height = innerHeight; x.clearRect(0, 0, c.width, c.height); for (let i = 0; i < 220; i++) { const a = 0.15 + rnd() * 0.55; x.fillStyle = `rgba(200,215,235,${a})`; const r = rnd() < 0.08 ? 1.3 : 0.7; x.fillRect(rnd() * c.width, rnd() * c.height, r, r); } };
  draw(); addEventListener('resize', () => { seed = 7; draw(); });
}

async function boot() {
  starfield();
  try {
    const data = await loadAllData(browserReader);
    let backend; try { backend = new IndexedDbBackend(); await backend.list(); } catch { backend = new MemoryBackend(); setTimeout(() => ui.toast('Browser storage is unavailable. Saves will not persist; use Export.', 'warn'), 500); }
    const ui = new UI({ data, saves: new SaveManager(backend), clock: new Clock({ state: { time: { paused: true, speed: 0 } } }) });
    window.__deepSignal = ui;
    await ui.init();
  } catch (e) {
    console.error(e);
    document.getElementById('view').innerHTML = `<div class="panel"><h3>Could not start</h3><p class="muted">${String(e.message).replace(/</g, '&lt;')}</p><p class="faint">Serve this folder over HTTP (for example <code>python3 -m http.server</code>) rather than opening index.html directly.</p></div>`;
  }
}
boot();
