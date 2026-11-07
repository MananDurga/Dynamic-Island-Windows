// Ember Island — Electron shell. UI lives in ui/; system data comes from bridge.ps1; Claude Code talks to the hook server.
const { app, BrowserWindow, ipcMain, Menu, screen, protocol, net } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PORT = 47823;
const APPROVAL_WAIT = 115_000; // hook timeout is 120 s; answer before Claude gives up
const W = 560, H = 256;        // window = largest card; the empty area lets clicks through
const DIR = path.join(app.getPath('appData'), 'com.ember.island');
const CONFIG = path.join(DIR, 'presets.json');
const UI = path.join(__dirname, 'ui');

let win, quitting = false;
const pending = new Map(); // approval id -> { answer(decision), session }
let nextId = 1;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required'); // the approval chime plays without a click
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const send = ev => win?.webContents.send('island', ev);
function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); }
  catch { return JSON.parse(fs.readFileSync(path.join(__dirname, 'presets.json'), 'utf8')); }
}
const ps = (args = []) => spawn('powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'bridge.ps1'), ...args], { windowsHide: true });

function token() {
  try { const t = fs.readFileSync(path.join(DIR, 'token.txt'), 'utf8').trim(); if (t.length >= 32) return t; } catch {}
  const t = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(path.join(DIR, 'token.txt'), t);
  return t;
}

// Media, foreground app and notifications arrive as JSON lines
function watchBridge() {
  const p = ps(['-Parent', String(process.pid)]);
  let buf = '';
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/^﻿/, '').trim();
      buf = buf.slice(i + 1);
      if (line) try { send(JSON.parse(line)); } catch { /* skip partial line */ }
    }
  });
  p.on('exit', () => { if (!quitting) setTimeout(watchBridge, 3000); });
}

// Drop approval cards for a session that moved on (e.g. answered in the Claude app instead)
function resolveSession(session) {
  for (const [id, p] of pending) if (p.session === session) { pending.delete(id); p.answer(null); }
}

function handleHook(v) {
  const session = v.session_id || '', cwd = v.cwd || '';
  const state = kind => send({ type: 'claude', kind, session, cwd });
  switch (v.hook_event_name) {
    case 'UserPromptSubmit': resolveSession(session); state('working'); return Promise.resolve('');
    case 'Stop': case 'SessionEnd': resolveSession(session); state('stopped'); return Promise.resolve('');
    case 'PermissionRequest': return new Promise(resolve => {
      const id = nextId++;
      const answer = d => {
        clearTimeout(timer); pending.delete(id); send({ type: 'resolved', id });
        const behavior = d === 'allow' ? { behavior: 'allow' } : d === 'deny' ? { behavior: 'deny', message: 'Denied from Ember Island' } : null;
        // no answer -> empty reply -> Claude shows its normal prompt
        resolve(behavior ? JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: behavior } }) : '');
      };
      const timer = setTimeout(() => answer(null), APPROVAL_WAIT);
      pending.set(id, { answer, session });
      state('working');
      send({ type: 'permission', id, session, cwd, tool: v.tool_name, input: v.tool_input });
    });
    default: return Promise.resolve('');
  }
}

// Claude Code hooks POST here: 127.0.0.1 only, secret token in the URL
function serveHooks(tok) {
  http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== `/hook?t=${tok}`) { res.writeHead(403).end(); return; }
    let body = '';
    req.setEncoding('utf8');
    req.on('data', c => { body += c; if (body.length > 1 << 20) req.destroy(); });
    req.on('end', async () => {
      let v = {};
      try { v = JSON.parse(body); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(await handleHook(v));
    });
  }).on('error', e => console.error('hook server', e)).listen(PORT, '127.0.0.1');
}

function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    // 1.5% down from the top edge, so the browser's tab strip above it stays easy to click
    width: W, height: H, x: wa.x + Math.round((wa.width - W) / 2), y: wa.y + Math.round(wa.height * 0.015),
    frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false,
    alwaysOnTop: true, focusable: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.once('ready-to-show', () => win.showInactive());
  win.loadURL('app://ui/index.html');
}

function showMenu() {
  const cfg = readConfig();
  Menu.buildFromTemplate([
    ...Object.keys(cfg.presets).map(name => ({
      label: name, type: 'radio', checked: name === cfg.active,
      click: () => { cfg.active = name; fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2)); send({ type: 'config', config: cfg }); },
    })),
    { type: 'separator' },
    { label: 'Edit presets.json…', click: () => spawn('notepad.exe', [CONFIG], { detached: true }) },
    { label: 'Reload', click: () => win.reload() },
    { label: 'Quit Ember Island', click: () => app.quit() },
  ]).popup({ window: win });
}

ipcMain.handle('get_config', () => readConfig());
ipcMain.on('interactive', (_, on) => win.setIgnoreMouseEvents(!on, { forward: true }));
ipcMain.on('media', (_, cmd) => { if (['toggle', 'next', 'prev'].includes(cmd)) ps(['-Cmd', cmd]); });
ipcMain.on('menu', showMenu);
// Current position from Windows' location service, only asked for when a weather place is set to "auto"
ipcMain.handle('locate', () => new Promise(resolve => {
  const p = ps(['-Cmd', 'locate']);
  let out = '';
  const timer = setTimeout(() => { p.kill(); resolve({ error: 'location timed out' }); }, 20_000);
  p.stdout.on('data', d => { out += d; });
  p.on('exit', () => { clearTimeout(timer); try { resolve(JSON.parse(out.replace(/^﻿/, '').trim())); } catch { resolve({ error: 'location unavailable' }); } });
}));
ipcMain.on('decide', (_, id, decision) => pending.get(id)?.answer(decision));

if (!app.requestSingleInstanceLock()) app.quit(); // autostart + manual start must not run two islands
else app.whenReady().then(() => {
  fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(CONFIG)) fs.copyFileSync(path.join(__dirname, 'presets.json'), CONFIG);
  protocol.handle('app', req => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(UI, rel));
    if (!file.startsWith(UI)) return new Response('', { status: 403 }); // no escaping the ui folder
    return net.fetch(pathToFileURL(file).toString());
  });
  app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: [__dirname] }); // start with Windows
  createWindow();
  watchBridge();
  serveHooks(token());
});
app.on('before-quit', () => { quitting = true; for (const p of pending.values()) p.answer(null); });
