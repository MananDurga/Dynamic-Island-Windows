// window.island: the only API the UI uses. Tauri in the app; a fake in a plain browser for previewing the design.
if (window.__TAURI__) {
  const { invoke } = window.__TAURI__.core, { listen } = window.__TAURI__.event;
  window.island = {
    onEvent: f => listen('island', e => f(e.payload)),
    getConfig: () => invoke('get_config'),
    interactive: () => {},                       // Rust watches the cursor against hitRect instead
    hitRect: r => invoke('hit_rect', { x: r.x, y: r.y, w: r.w, h: r.h }),
    media: cmd => invoke('media', { cmd }),
    menu: () => invoke('menu'),
    decide: (id, decision) => invoke('decide', { id, decision }),
  };
} else if (typeof window.island?.onEvent !== "function") { // #island element is also window.island in a browser
  // Preview only. Keys: 1 approval, 2 notification, 3 Claude working on/off, 4 music on/off
  let f = () => {}, claude = false, music = false;
  const sys = () => f({ type: 'sys', app: { name: 'Code', title: 'app.js' },
    media: music ? { title: 'Midnight City', artist: 'M83', status: 'Playing' } : null });
  window.island = {
    onEvent: cb => { f = cb; setTimeout(sys, 50); },
    getConfig: () => fetch('../presets.json').then(r => r.json()),
    interactive() {}, hitRect() {}, menu() {}, media() {},
    decide: (id, d) => console.log('decide', id, d),
  };
  addEventListener('keydown', e => {
    if (e.key === '1') f({ type: 'permission', id: String(Date.now()), session: 's1', cwd: 'C:\\code\\island', tool: 'Bash', input: { command: 'npm install --save-dev @tauri-apps/cli' } });
    if (e.key === '2') f({ type: 'notif', id: Date.now(), app: 'WhatsApp', title: 'Riya', body: 'are we still on for tonight?' });
    if (e.key === '3') { claude = !claude; f({ type: 'claude', kind: claude ? 'working' : 'stopped', session: 's1', cwd: 'C:\\code\\island' }); }
    if (e.key === '4') { music = !music; sys(); }
  });
}
