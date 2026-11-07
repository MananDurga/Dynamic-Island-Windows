// Run: node tools/check-brands.mjs — tab and window titles map to the right app and logo
import assert from 'node:assert';
import { resolveApps, BRANDS } from '../ui/brands.js';
import { LOGOS } from '../ui/logos.js';

const tab = title => resolveApps([{ name: 'brave', title, fg: false }], {}, '', LOGOS)[0];
const cases = {
  'Netflix - Brave': 'Netflix',
  'Lo-fi beats - YouTube Music - Brave': 'YouTube Music',
  'How to cook rice - YouTube - Brave': 'YouTube',
  'Spotify – Web Player - Brave': 'Spotify',
  'Inbox (3) - someone@example.com - Gmail - Brave': 'Gmail',
  'Meet - abc-defg-hij - Brave': 'Google Meet',
  'Quarterly plan - Google Docs - Brave': 'Google Docs',
  'Budget - Google Sheets - Brave': 'Google Sheets',
  'Home / X - Brave': 'X',
  'ChatGPT - Brave': 'ChatGPT',
  'WhatsApp - Brave': 'WhatsApp',
};
for (const [title, want] of Object.entries(cases)) {
  const app = tab(title);
  assert.equal(app.name, want, title);
  assert.ok(app.logo?.src.startsWith('data:image/svg+xml'), `${want} has a logo`);
}
// Microsoft Store apps run under ApplicationFrameHost and are recognised by window title
assert.equal(resolveApps([{ name: 'ApplicationFrameHost', title: 'Netflix', fg: true }], {}, 'Netflix', LOGOS)[0].logo?.bg, '#FFFFFF');
// a plain tab with no known app stays the browser itself
assert.equal(tab('Some random article - Brave').name, 'Brave');
// every brand that names a logo got one bundled
for (const b of BRANDS) if (b.logo) assert.ok(LOGOS[b.name], `logo bundled for ${b.name}`);
console.log(`brands ok: ${Object.keys(cases).length} titles, ${Object.keys(LOGOS).length} logos`);
