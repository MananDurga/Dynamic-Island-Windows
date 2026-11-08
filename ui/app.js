import { resolveApps, iconColor } from './brands.js';
import { LOGOS } from './logos.js';
import { deviceIcon, newlyConnected, LABEL } from './devices.js';

const island_ = document.getElementById('island');
const pill = document.getElementById('pill');
const content = document.getElementById('content');

const S = { media: null, app: null, weather: null, battery: null, now: new Date(),
  windows: [], icons: {}, apps: [], // open app windows from the bridge -> one entry per app
  devices: null,         // connected USB/Bluetooth devices; null until the first scan
  sessions: new Map(),   // claude session id -> { cwd }
  approvals: [],         // pending permission requests, oldest first
  toasts: [], toast: null };
let cfg = null, hover = false, toastTimer = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const base = p => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';
const time = () => S.now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const playing = () => S.media?.status === 'Playing';
const WMO = c => c === 0 ? '☀' : c <= 3 ? '⛅' : c <= 48 ? '🌫' : c <= 67 ? '🌧' : c <= 77 ? '❄' : c <= 82 ? '🌦' : '⛈';
const SKY = c => c === 0 ? 'Clear' : c <= 2 ? 'Fair' : c === 3 ? 'Cloudy' : c <= 48 ? 'Fog' : c <= 57 ? 'Drizzle' : c <= 67 ? 'Rain'
  : c <= 77 ? 'Snow' : c <= 82 ? 'Showers' : c <= 86 ? 'Snow' : 'Storm';
// Weather places from presets.json: [{ "label": "DEL", "city": "Delhi" }, { "label": "HERE", "auto": true }, …]
// Older files with a single "city" still work; with nothing set, use the current location.
const places = () => cfg.weather?.length ? cfg.weather.slice(0, 2)
  : cfg.city ? [{ label: cfg.city.slice(0, 3).toUpperCase(), city: cfg.city }] : [{ label: 'HERE', auto: true }];

// What Claude wants to do, in plain words
export function describe(tool, input = {}) {
  if (tool === 'Bash') return { what: 'Run a command', detail: input.command };
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool)) return { what: tool === 'Write' ? 'Create / overwrite a file' : 'Edit a file', detail: input.file_path || input.notebook_path };
  if (tool === 'WebFetch') return { what: 'Open a web page', detail: input.url };
  if (tool === 'WebSearch') return { what: 'Search the web', detail: input.query };
  return { what: `Use ${tool}`, detail: JSON.stringify(input).slice(0, 300) };
}

// A soft two-note chime made on the fly (no audio file)
let audio;
function ting() {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    [[1318.5, 0], [1975.5, 0.09]].forEach(([f, d]) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + d);
      g.gain.linearRampToValueAtTime(0.18, t + d + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.9);
      o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + 1);
    });
  } catch (e) { console.error('ting', e); }
}

const svg = d => `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = { // drawn icons: Windows renders ⏮⏯⏭ as blue emoji tiles
  prev: svg('M6 5h2v14H6zM20 5v14L9.5 12z'), next: svg('M16 5h2v14h-2zM4 5v14l10.5-7z'),
  play: svg('M7 4.5v15L19.5 12z'), pause: svg('M6.5 5h4v14h-4zM13.5 5h4v14h-4z') };

const NEUTRAL = '#B8B0AA';
const gradient = cs => cs?.length > 1 ? `linear-gradient(135deg, ${cs.join(', ')})` : (cs?.[0] || NEUTRAL);
// Real app icon with a soft glow in the app's color; web apps get a brand-colored monogram
const appIcon = a => `<span class="ai${a.fg ? ' fg' : ''}" style="--c:${a.colors?.[0] || NEUTRAL}" role="img" aria-label="${esc(a.name)}" title="${esc(a.name)}">${
  a.icon ? `<img src="${a.icon}" alt="">`
  : a.logo ? `<span class="logo" style="background:${a.logo.bg}"><img src="${a.logo.src}" alt=""></span>`
  : `<span class="mono" style="background:${gradient(a.colors)}">${esc(a.name[0])}</span>`}</span>`;
const MAX_ICONS = 6;

const W = {
  apps: { // open apps, then connected devices after a thin divider
    c: () => S.apps.length || S.devices?.length ? `<span class="apps">${S.apps.slice(0, MAX_ICONS).map(appIcon).join('')}${
      S.apps.length > MAX_ICONS ? `<span class="more">+${S.apps.length - MAX_ICONS}</span>` : ''}${
      S.devices?.length ? `<span class="devsep"></span>${S.devices.map(d => deviceIcon(d)).join('')}` : ''}</span>` : '',
    e: () => `<div class="tile wide"><div class="meta">Open apps${S.devices?.length ? ' · devices' : ''}</div><div class="chips">${S.apps.length || S.devices?.length
      ? S.apps.map(a => `<span class="chip${a.fg ? ' fg' : ''}" style="--c:${a.colors?.[0] || NEUTRAL}">${appIcon(a)}<span class="ell">${esc(a.name)}</span></span>`).join('')
        + (S.devices || []).map(d => `<span class="chip" style="--c:#2F80ED">${deviceIcon(d)}<span class="ell">${esc(d.name)}</span></span>`).join('')
      : '<span class="dim">No apps open</span>'}</div></div>` },
  clock: { c: () => `<span class="num">${time()}</span>`,
    e: () => `<div class="tile"><div class="big">${time()}</div><div class="dim">${S.now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</div></div>` },
  weather: { c: () => S.wx?.[0]?.temp != null ? `${WMO(S.wx[0].code)} <span class="num">${Math.round(S.wx[0].temp)}°</span>` : '',
    // one tile, split in halves when there are two places, so they can be compared at a glance
    e: () => `<div class="tile wx">${S.wx?.length ? S.wx.map(w => `<div class="wxc">${w.temp != null
        ? `<div class="big">${Math.round(w.temp)}°<span class="meta wxl">${esc(w.label)}</span></div><div class="dim ell">${WMO(w.code)} ${SKY(w.code)}</div>`
        : `<div class="meta">${esc(w.label)}</div><div class="dim">${esc(w.error || '…')}</div>`}</div>`).join('<div class="wxsep"></div>')
      : '<div class="dim">Weather…</div>'}</div>` },
  battery: { c: () => S.battery ? `<span class="num">${S.battery.level}%</span>${S.battery.charging ? ' ⚡' : ''}` : '',
    e: () => S.battery ? `<div class="tile"><div class="big">${S.battery.level}%</div><div class="dim">${S.battery.charging ? 'Charging' : 'Battery'}</div></div>` : '' },
  media: { c: () => S.media?.title ? `<span class="${playing() ? '' : 'paused'}"><span class="bars"><i></i><i></i><i></i></span>${esc(S.media.title)}</span>` : '',
    e: () => S.media?.title ? `<div class="tile wide row"><div class="grow"><div class="ell"><b>${esc(S.media.title)}</b></div>
      <div class="dim ell">${esc(S.media.artist || (S.media.source || '').split(/[.!_]/)[0])}</div></div>
      <div class="ctl"><button data-cmd="prev" aria-label="Previous">${ICON.prev}</button>
      <button data-cmd="toggle" aria-label="${playing() ? 'Pause' : 'Play'}">${playing() ? ICON.pause : ICON.play}</button>
      <button data-cmd="next" aria-label="Next">${ICON.next}</button></div></div>` : '' },
  app: { c: () => S.app ? esc(S.app.name) : '',
    e: () => S.app ? `<div class="tile wide"><div class="meta">Active</div><div class="ell"><b>${esc(S.app.name)}</b> <span class="dim">${esc(S.app.title)}</span></div></div>` : '' },
  claude: { c: () => S.sessions.size ? `<span><span class="spark"></span>Claude${S.sessions.size > 1 ? ` · ${S.sessions.size} sessions` : ''}</span>` : '',
    e: () => S.sessions.size ? `<div class="tile"><div class="meta">Claude</div><div class="ell"><span class="spark"></span>Working${S.sessions.size > 1 ? ` ×${S.sessions.size}` : ''}</div></div>` : '' },
};

function view() {
  if (S.approvals.length) {
    const a = S.approvals[0], d = describe(a.tool, a.input);
    return { cls: 'card', state: 'approval', html: `<div class="cardbody">
      <div class="head"><span class="spark"></span><b>Claude needs permission</b></div>
      <div class="dim">${esc(d.what)}</div>
      <div class="code">${esc(d.detail)}</div>
      <div class="foot"><span class="meta">${esc(a.tool)}${S.approvals.length > 1 ? ` · <span class="queue">+${S.approvals.length - 1} waiting</span>` : ''}</span>
        <button class="btn deny" data-decide="deny">Deny</button><button class="btn allow" data-decide="allow">Allow</button></div></div>` };
  }
  if (S.toast) {
    const n = S.toast;
    return { cls: 'toast', state: n.device ? 'device' : 'notif', html: `<div class="toastbody"><div class="appicon">${n.device ? deviceIcon(n.device, true) : esc((n.app || '?')[0])}</div>
      <div class="meta ell">${esc(n.app)}</div><div class="meta">now</div>
      <div class="ell"><b>${esc(n.title)}</b></div><div></div><div class="dim ell">${esc(n.body)}</div></div>` };
  }
  const p = cfg.presets[cfg.active] ?? Object.values(cfg.presets)[0];
  const state = S.sessions.size ? 'claude' : playing() ? 'music' : 'idle';
  if (hover) {
    // while Claude works its tile takes the battery's place, so the view never needs an extra row
    const keys = [...new Set(S.sessions.size ? ['claude', ...p.expanded.filter(k => k !== 'battery')] : p.expanded)];
    return { cls: 'open', state, html: `<div class="grid">${keys.map(k => W[k]?.e()).filter(Boolean).join('')}</div>` };
  }
  const keys = [...new Set([...(S.sessions.size ? ['claude'] : []), ...p.compact])];
  const parts = keys.map(k => [k, W[k]?.c()]).filter(([, html]) => html);
  while (parts.length > 3) { // at most 3 sections; drop the least important first, keep apps, Claude and the clock
    const i = parts.findIndex(([k]) => !['clock', 'claude', 'apps'].includes(k));
    parts.splice(i < 0 ? parts.length - 2 : i, 1);
  }
  return { cls: '', state, html: `<div class="compact">${parts.map(([, x]) => `<span>${x}</span>`).join('')}</div>` };
}

// The ambient halo takes the colors of the app in front; approvals and notifications take over while shown
function haloColors(state) {
  if (state === 'approval') return ['#FF8A65'];
  if (state === 'notif') return ['#60A5FA'];
  if (state === 'device') return ['#2F80ED'];
  const focus = S.apps.find(a => a.fg);
  return focus?.colors || ['#6b2d16'];
}

let lastCls = null, lastHtml = '', lastHalo = '';
function render() {
  if (!cfg) return;
  const v = view();
  pill.dataset.state = v.state;
  if (v.cls !== lastCls) { pill.className = v.cls; lastCls = v.cls; lastHtml = null; }
  if (v.html !== lastHtml) { content.innerHTML = v.html; lastHtml = v.html; } // unchanged -> keep DOM so animations don't restart
  // compact pill hugs its content; the larger states use their fixed CSS sizes
  pill.style.width = v.cls === '' ? `${Math.max(180, content.firstElementChild?.offsetWidth || 0)}px` : '';
  const cs = haloColors(v.state);
  const halo = cs.length > 1 ? [...cs, cs[0]].join(', ') : `${cs[0]}, ${cs[0]}`;
  if (halo !== lastHalo) { island_.style.setProperty('--halo-colors', halo); lastHalo = halo; }
  // rim follows the app in front, except in states that have their own rim color (Claude, approval, notification)
  if (v.state === 'idle' || v.state === 'music') pill.style.setProperty('--rim', cs[0]); else pill.style.removeProperty('--rim');
}

function setApps() {
  S.apps = resolveApps(S.windows, S.icons, S.app?.title, LOGOS);
  for (const a of S.apps) if (!a.colors && a.icon) iconColor(a.icon).then(c => { if (c && !a.colors) { a.colors = [c]; render(); } });
}

function nextToast() {
  clearTimeout(toastTimer);
  S.toast = S.toasts.shift() || null;
  render();
  if (S.toast) toastTimer = setTimeout(function done() { hover ? (toastTimer = setTimeout(done, 1000)) : nextToast(); }, 5000);
}

// Pointer: the pill is clickable, the rest of the window lets clicks through
pill.addEventListener('mouseenter', () => { hover = true; island.interactive(true); render(); });
pill.addEventListener('mouseleave', () => { hover = false; island.interactive(false); render(); });
pill.addEventListener('contextmenu', e => { e.preventDefault(); island.menu(); });
pill.addEventListener('click', e => {
  const cmd = e.target.closest('[data-cmd]')?.dataset.cmd;
  if (cmd) return island.media(cmd);
  const decision = e.target.closest('[data-decide]')?.dataset.decide;
  if (decision && S.approvals.length) {
    island.decide(S.approvals[0].id, decision);
    S.approvals.shift(); render();
    return;
  }
  if (S.toast) nextToast(); // click dismisses a notification
});
new ResizeObserver(() => { const r = pill.getBoundingClientRect(); island.hitRect?.({ x: r.x, y: r.y, w: r.width, h: r.height }); }).observe(pill);

island.onEvent(ev => {
  switch (ev.type) {
    case 'sys': S.media = ev.media; if (ev.app && !/^(electron|island|ember-island)$/i.test(ev.app.name)) S.app = ev.app; setApps(); break;
    case 'apps': S.windows = ev.apps || []; Object.assign(S.icons, ev.icons); setApps(); break;
    case 'devices': {
      const now = ev.devices || [];
      // the first list is what was already plugged in when the island started: no pop-ups for those
      if (S.devices) for (const d of newlyConnected(S.devices, now)) {
        S.toasts.push({ device: d, app: d.via === 'bt' ? 'Bluetooth' : 'USB', title: d.name, body: `${LABEL[d.kind] || 'Device'} connected` });
      }
      S.devices = now;
      if (!S.toast && S.toasts.length) { nextToast(); return; }
      break;
    }
    case 'notif': S.toasts.push(ev); if (!S.toast) nextToast(); return;
    case 'claude': ev.kind === 'working' ? S.sessions.set(ev.session, { cwd: ev.cwd }) : S.sessions.delete(ev.session); break;
    case 'permission': S.approvals.push(ev); if (S.approvals.length === 1) ting(); break;
    case 'resolved': S.approvals = S.approvals.filter(a => a.id !== ev.id); break;
    case 'config': {
      const changed = JSON.stringify([ev.config.weather, ev.config.city]) !== JSON.stringify([cfg?.weather, cfg?.city]);
      cfg = ev.config; if (changed) loadWeather(); break;
    }
  }
  render();
});

const geo = new Map(); // city name -> { lat, lon }, looked up once
async function where(p) {
  if (p.auto) {
    const r = await island.locate?.();
    if (!r || r.error) throw new Error('Turn on Windows location');
    return r;
  }
  if (!geo.has(p.city)) {
    const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(p.city)}`)).json();
    const loc = g.results?.[0];
    if (!loc) throw new Error(`Can't find "${p.city}"`);
    geo.set(p.city, { lat: loc.latitude, lon: loc.longitude });
  }
  return geo.get(p.city);
}

async function loadWeather() {
  if (!cfg) return;
  const ps_ = places();
  const spots = await Promise.all(ps_.map(p => where(p).catch(e => ({ error: e.message }))));
  const ok = spots.map((s, i) => [s, i]).filter(([s]) => !s.error);
  const wx = ps_.map((p, i) => ({ label: p.label || (p.auto ? 'HERE' : p.city), error: spots[i].error }));
  if (ok.length) {
    try { // one request for all places
      const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${ok.map(([s]) => s.lat)}&longitude=${ok.map(([s]) => s.lon)}&current=temperature_2m,weather_code`)).json();
      const list = Array.isArray(r) ? r : [r];
      ok.forEach(([, i], j) => { wx[i].temp = list[j].current.temperature_2m; wx[i].code = list[j].current.weather_code; });
    } catch (e) { console.error('weather', e); ok.forEach(([, i]) => { wx[i].error = 'Offline'; }); }
  }
  S.wx = wx;
  render();
}

navigator.getBattery?.().then(b => {
  const upd = () => { S.battery = { level: Math.round(b.level * 100), charging: b.charging }; render(); };
  b.onlevelchange = b.onchargingchange = upd; upd();
});
setInterval(() => { S.now = new Date(); render(); }, 15000);
setInterval(loadWeather, 15 * 60 * 1000);
island.getConfig().then(c => { cfg = c; render(); loadWeather(); });
