# Ember Island — a dynamic island for Windows 11

A small glass pill at the top of your screen, inspired by the iPhone's Dynamic Island but made for a Windows laptop.

- **Your open apps, in the notch.** Real app icons (and real logos for web apps like Netflix, YouTube, Gmail, Google Meet and 60+ more), each with a soft glow in its brand color.
- **Ambient lighting.** The pill glows in the color of the app you're using: red for Netflix, multicolor for Adobe apps, green for Spotify…
- **Media.** What's playing in any app (Spotify, browser, VLC), with previous / play / next.
- **Weather.** Your current location, or compare two cities side by side.
- **Windows notifications.** Every notification also drops down in the island.
- **Claude Code approvals.** When Claude Code needs permission, the island drops open with a chime and **Allow / Deny** buttons — no window switching.
- **Presets.** Right-click the pill to switch layouts or edit them.
- Starts with Windows. 80% opaque smoked glass. Clicks outside the pill pass straight through.

## Requirements

- Windows 10 or 11
- [Node.js](https://nodejs.org) 20 or newer

## Install

```bash
git clone https://github.com/MananDurga/Dynamic-Island-Windows.git
cd Dynamic-Island-Windows
npm install
npm start
```

The first start registers the island to open when you log into Windows. To stop it, right-click the pill → **Quit Ember Island**.

### Notifications

Windows asks once for permission to read notifications. If it doesn't, turn it on under
**Settings → Privacy & security → Notifications**.

### Weather

Right-click the pill → **Edit presets.json** and set up to two places:

```json
"weather": [
  { "label": "DEL", "city": "Delhi" },
  { "label": "BLR", "city": "Bengaluru" }
]
```

Use `{ "label": "HERE", "auto": true }` for your current location (needs **Settings → Privacy & security → Location** on).
Weather comes from [Open-Meteo](https://open-meteo.com) (free, no key).

### Claude Code approvals (optional)

```bash
npm run hooks
```

This adds hooks to `~/.claude/settings.json` (your old file is backed up next to it). The island only listens on
`127.0.0.1` and checks a secret token, so nothing else can approve on Claude's behalf. If the island isn't running
or you don't answer within two minutes, Claude asks you the normal way. Remove with `npm run hooks -- --remove`.

## Add an app or website

Add a line to [`ui/brands.js`](ui/brands.js) with its glow color, how to recognise it (process name or tab title) and a logo id, then:

```bash
npm run logos   # bundle the logo
npm run check   # make sure tab titles map to the right app
```

## How it works

| Piece | What it does |
|---|---|
| `main.cjs` | Electron window (transparent, always on top, click-through), right-click menu, local hook server for Claude Code |
| `bridge.ps1` | PowerShell + Windows APIs: open windows and their icons, media, notifications, location |
| `ui/` | The island itself: plain HTML, CSS and JavaScript |
| `ui/logos.js` | Logos bundled offline — no browsing data leaves your PC |

## Credits

Logos from [SVG Logos](https://github.com/gilbarbara/logos) and [Simple Icons](https://simpleicons.org) (both CC0).
All brand names and logos belong to their owners.

## License

MIT
