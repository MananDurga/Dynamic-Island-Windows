// Connects Claude Code to the island: adds hooks to ~/.claude/settings.json (a backup is kept next to it).
// Run once:  npm run hooks        Remove:  npm run hooks -- --remove
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = 47823; // must match main.cjs
const dir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'com.ember.island');
const tokenFile = path.join(dir, 'token.txt');
const settingsFile = path.join(os.homedir(), '.claude', 'settings.json');
const remove = process.argv.includes('--remove');

// Same secret the island reads at startup, so only Claude Code's hooks can reach it
fs.mkdirSync(dir, { recursive: true });
let token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : '';
if (token.length < 32) { token = crypto.randomBytes(16).toString('hex'); fs.writeFileSync(tokenFile, token); }

fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
let settings = {};
if (fs.existsSync(settingsFile)) {
  const raw = fs.readFileSync(settingsFile, 'utf8');
  try { settings = JSON.parse(raw); }
  catch { console.error(`Could not read ${settingsFile} (not valid JSON). Nothing changed.`); process.exit(1); }
  fs.writeFileSync(settingsFile.replace(/\.json$/, '.backup-before-ember-island.json'), raw);
}

// curl ships with Windows 10+; "|| exit 0" keeps Claude's normal prompt when the island isn't running
const cmd = seconds => `curl.exe -s -m ${seconds} --data-binary @- "http://127.0.0.1:${PORT}/hook?t=${token}" || exit 0`;
const ours = h => JSON.stringify(h).includes(`:${PORT}/hook`);
const add = {
  UserPromptSubmit: { hooks: [{ type: 'command', command: cmd(2), timeout: 5 }] },
  Stop: { hooks: [{ type: 'command', command: cmd(2), timeout: 5 }] },
  SessionEnd: { hooks: [{ type: 'command', command: cmd(2), timeout: 5 }] },
  PermissionRequest: { matcher: '*', hooks: [{ type: 'command', command: cmd(118), timeout: 120 }] },
};
settings.hooks ??= {};
for (const [event, entry] of Object.entries(add)) {
  const kept = (settings.hooks[event] || []).filter(h => !ours(h)); // never touch the user's own hooks
  settings.hooks[event] = remove ? kept : [...kept, entry];
  if (!settings.hooks[event].length) delete settings.hooks[event];
}
fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
console.log(remove ? 'Ember Island hooks removed from Claude Code.' : 'Claude Code is connected to Ember Island. Approvals will show on the island while it runs.');
