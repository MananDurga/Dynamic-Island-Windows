// Connected-device icons: a black glyph in a light circle with a blue outline, plus a small Bluetooth/USB badge.
const P = {
  headphones: 'M12 3a8.5 8.5 0 0 0-8.5 8.5V18a2.5 2.5 0 0 0 2.5 2.5h1.5A1.5 1.5 0 0 0 9 19v-4.5A1.5 1.5 0 0 0 7.5 13H5.5v-1.5a6.5 6.5 0 0 1 13 0V13h-2a1.5 1.5 0 0 0-1.5 1.5V19a1.5 1.5 0 0 0 1.5 1.5H18a2.5 2.5 0 0 0 2.5-2.5v-6.5A8.5 8.5 0 0 0 12 3z',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 3v12.5h8V5zm4 13.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z',
  mouse: 'M12 2a6 6 0 0 0-6 6v8a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6zm-1 2.2a4 4 0 0 0-3 3.8v1.5h3zm2 0v5.3h3V8a4 4 0 0 0-3-3.8z',
  keyboard: 'M3 6h18a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 21 18H3a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 3 6zm2 3v2h2V9zm4 0v2h2V9zm4 0v2h2V9zm4 0v2h2V9zM7 13v2h10v-2z',
  controller: 'M7.5 6.5h9a5.5 5.5 0 0 1 5.2 7.3l-1.1 3a2.2 2.2 0 0 1-3.8.6L15 15.5H9l-1.8 1.9a2.2 2.2 0 0 1-3.8-.6l-1.1-3A5.5 5.5 0 0 1 7.5 6.5zM7 9.5V11H5.5v1.5H7V14h1.5v-1.5H10V11H8.5V9.5zm9.5 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm-2 2.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z',
  speaker: 'M7 2h10a1.5 1.5 0 0 1 1.5 1.5v17A1.5 1.5 0 0 1 17 22H7a1.5 1.5 0 0 1-1.5-1.5v-17A1.5 1.5 0 0 1 7 2zm5 8.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  storage: 'M9 2h6v5h1.5a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1H9zm1.5 2v2h1V4zm2 0v2h1V4z',
  bluetooth: 'M11 2l6.5 5.5-4.7 4.5 4.7 4.5L11 22v-7.6l-3.8 3.7-1.4-1.4L10.6 12 5.8 7.8l1.4-1.4L11 10zm2 4.4v4.1l2.2-2.1zm0 7.1v4.1l2.2-2z',
  usb: 'M12 2l3 4h-2v8l3-2v-1.5h-1V8h4v2.5h-1v2.6l-5 3.3V18.3a2 2 0 1 1-2 0v-3L6 12.4v-1.6a1.6 1.6 0 1 1 2-.1v.8l3 2V6H9z',
};
const svg = (d, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="${d}"/></svg>`;
export const LABEL = { headphones: 'Headphones', phone: 'Phone', mouse: 'Mouse', keyboard: 'Keyboard', controller: 'Controller',
  speaker: 'Speaker', storage: 'USB drive', bluetooth: 'Bluetooth device', usb: 'USB device' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const deviceIcon = (d, big = false) =>
  `<span class="dev${big ? ' big' : ''}" role="img" aria-label="${esc(`${d.name} (${LABEL[d.kind] || 'device'}, ${d.via === 'bt' ? 'Bluetooth' : 'USB'})`)}" title="${esc(d.name)}">${
    svg(P[d.kind] || P[d.via === 'bt' ? 'bluetooth' : 'usb'], big ? 20 : 11)}<span class="via">${svg(P[d.via === 'bt' ? 'bluetooth' : 'usb'], big ? 9 : 6)}</span></span>`;

// Devices in `now` that weren't in `before` (by id) — these get the "connected" pop-up
export const newlyConnected = (before, now) => now.filter(d => !before.some(b => b.id === d.id));
