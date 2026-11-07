// Apps the island knows: glow colors, how to recognise them, and which logo to show.
//   proc  = desktop process name   title = browser tab / store-app window title
//   logo  = 'L:<id>' from SVG Logos (full color) or 'S:<id>' from Simple Icons (single color); both CC0.
//   Logos are bundled into logos.js by tools/build-logos.mjs. More specific titles go first (YouTube Music before YouTube).
const B = (name, colors, proc, title, logo) => ({ name, colors, proc, title, logo });
const C = c => (Array.isArray(c) ? c : [c]);
const ADOBE = ['#31A8FF', '#FF9A00', '#FF3366', '#00E4BB', '#9999FF'];
const GOOGLE = ['#EA4335', '#FBBC05', '#34A853', '#4285F4'];

export const BRANDS = [
  // Streaming & music
  B('Netflix', C('#E50914'), /^netflix$/i, /netflix/i, 'L:netflix-icon'),
  B('YouTube Music', C('#FF0000'), null, /youtube music/i, 'S:youtubemusic'),
  B('YouTube', C('#FF0033'), null, /youtube/i, 'L:youtube-icon'),
  B('Spotify', C('#1DB954'), /^spotify$/i, /spotify/i, 'L:spotify-icon'),
  B('Apple Music', C('#FA243C'), /^applemusic$/i, /apple music/i, 'S:applemusic'),
  B('SoundCloud', C('#FF5500'), null, /soundcloud/i, 'L:soundcloud'),
  B('Twitch', C('#9146FF'), null, /twitch/i, 'L:twitch'),
  B('Crunchyroll', C('#FF5E00'), null, /crunchyroll/i, 'S:crunchyroll'),
  B('Prime Video', C('#00A8E1'), /primevideo/i, /prime video/i, null),
  B('Hotstar', C('#1F80E0'), null, /hotstar/i, null),
  // Social & chat
  B('WhatsApp', C('#25D366'), /whatsapp/i, /whatsapp/i, 'L:whatsapp-icon'),
  B('Instagram', ['#FEDA75', '#FA7E1E', '#D62976', '#4F5BD5'], null, /instagram/i, 'L:instagram-icon'),
  B('Messenger', ['#00B2FF', '#A033FF'], null, /messenger/i, 'L:messenger'),
  B('Facebook', C('#1877F2'), null, /facebook/i, 'L:facebook'),
  B('X', C('#E7E9EA'), null, /(^| )\/ X$|^X$/, 'L:x'),
  B('Reddit', C('#FF4500'), null, /reddit/i, 'L:reddit-icon'),
  B('LinkedIn', C('#0A66C2'), null, /linkedin/i, 'L:linkedin-icon'),
  B('Pinterest', C('#E60023'), null, /pinterest/i, 'L:pinterest'),
  B('TikTok', ['#25F4EE', '#FE2C55'], null, /tiktok/i, 'L:tiktok-icon'),
  B('Snapchat', C('#FFFC00'), null, /snapchat/i, 'S:snapchat'),
  B('Telegram', C('#2AABEE'), /telegram/i, /telegram/i, 'L:telegram'),
  B('Discord', C('#5865F2'), /^discord$/i, /discord/i, 'L:discord-icon'),
  B('Slack', ['#E01E5A', '#36C5F0', '#2EB67D', '#ECB22E'], /^slack$/i, /slack/i, 'L:slack-icon'),
  B('Teams', C('#6264A7'), /^ms-teams$/i, /microsoft teams/i, 'L:microsoft-teams'),
  B('Zoom', C('#2D8CFF'), /^zoom$/i, /\bzoom\b/i, 'L:zoom-icon'),
  // Google
  B('Gmail', GOOGLE, null, /gmail/i, 'L:google-gmail'),
  B('Google Meet', ['#00832D', '#0066DA', '#E94235', '#FFBA00'], null, /google meet|^meet [-–]/i, 'L:google-meet'),
  B('Google Drive', ['#0066DA', '#00AC47', '#FFBA00'], null, /google drive/i, 'L:google-drive'),
  B('Google Calendar', C('#4285F4'), null, /google calendar/i, 'L:google-calendar'),
  B('Google Docs', C('#4285F4'), null, /google docs/i, 'S:googledocs'),
  B('Google Sheets', C('#34A853'), null, /google sheets/i, 'S:googlesheets'),
  B('Google Slides', C('#FBBC04'), null, /google slides/i, 'S:googleslides'),
  B('Google Maps', GOOGLE, null, /google maps/i, 'L:google-maps'),
  B('Google Photos', GOOGLE, null, /google photos/i, 'L:google-photos'),
  B('Google Keep', C('#FBBC04'), null, /google keep/i, 'L:google-keep'),
  B('Google Classroom', C('#0F9D58'), null, /classroom/i, 'S:googleclassroom'),
  B('Gemini', ['#4285F4', '#9B72CB', '#D96570'], null, /gemini/i, 'L:google-gemini'),
  // AI
  B('ChatGPT', C('#10A37F'), /^chatgpt$/i, /chatgpt/i, 'L:openai-icon'),
  B('Claude', C('#D97757'), /^claude$/i, /claude/i, 'L:claude-icon'),
  B('Perplexity', C('#20B8CD'), null, /perplexity/i, 'L:perplexity-icon'),
  // Work & dev
  B('Notion', C('#EDEDED'), /^notion$/i, /notion/i, 'L:notion-icon'),
  B('Figma', ['#F24E1E', '#FF7262', '#1ABCFE', '#0ACF83'], /^figma$/i, /figma/i, 'L:figma'),
  B('Canva', ['#00C4CC', '#7D2AE8'], /^canva$/i, /canva/i, null),
  B('GitHub', C('#E6EDF3'), /^githubdesktop$/i, /github/i, 'L:github-icon'),
  B('GitLab', C('#FC6D26'), null, /gitlab/i, 'L:gitlab'),
  B('Bitbucket', C('#2684FF'), null, /bitbucket/i, 'L:bitbucket'),
  B('Stack Overflow', C('#F48024'), null, /stack overflow/i, 'L:stackoverflow-icon'),
  B('CodePen', C('#E6E6E6'), null, /codepen/i, 'L:codepen-icon'),
  B('Replit', C('#F26207'), null, /replit/i, 'L:replit-icon'),
  B('Vercel', C('#E6E6E6'), null, /vercel/i, 'L:vercel-icon'),
  B('LeetCode', C('#FFA116'), null, /leetcode/i, 'S:leetcode'),
  B('Linear', C('#5E6AD2'), /^linear$/i, /[-–|] linear$/i, 'L:linear'),
  B('Jira', C('#2684FF'), null, /jira/i, 'L:jira'),
  B('Trello', C('#0079BF'), null, /trello/i, 'L:trello'),
  B('Asana', C('#F06A6A'), null, /asana/i, 'L:asana'),
  B('Miro', C('#FFD02F'), null, /\bmiro\b/i, 'L:miro-icon'),
  B('Loom', C('#625DF5'), /^loom$/i, /\bloom\b/i, 'L:loom-icon'),
  B('Dropbox', C('#0061FF'), /^dropbox$/i, /dropbox/i, 'L:dropbox'),
  B('OneDrive', C('#0078D4'), /^onedrive$/i, /onedrive/i, 'L:microsoft-onedrive'),
  B('Outlook', C('#0A64D8'), /^(outlook|olk)$/i, /outlook/i, null),
  B('Medium', C('#E6E6E6'), null, /[-–|] medium$/i, 'L:medium-icon'),
  B('Behance', C('#1769FF'), null, /behance/i, 'L:behance'),
  B('Dribbble', C('#EA4C89'), null, /dribbble/i, 'L:dribbble-icon'),
  // Learning & everyday
  B('Duolingo', C('#58CC02'), null, /duolingo/i, 'S:duolingo'),
  B('Udemy', C('#A435F0'), null, /udemy/i, 'L:udemy-icon'),
  B('Coursera', C('#0056D2'), null, /coursera/i, 'L:coursera'),
  B('Zomato', C('#E23744'), null, /zomato/i, 'S:zomato'),
  B('Swiggy', C('#FC8019'), null, /swiggy/i, 'S:swiggy'),
  // Desktop apps (real .exe icon is used; the glow color comes from here)
  B('Adobe', ADOBE, /^(photoshop|illustrator|afterfx|adobe.*|indesign|lightroom.*|acrobat|acrord32|creative cloud|dreamweaver|animate)$/i,
    /adobe|photoshop|illustrator|premiere|after effects|firefly|lightroom|acrobat/i, null),
  B('Word', C('#2B579A'), /^winword$/i, null, null),
  B('Excel', C('#217346'), /^excel$/i, null, null),
  B('PowerPoint', C('#D24726'), /^powerpnt$/i, null, null),
  B('VS Code', C('#23A9F2'), /^code$/i, null, null),
  B('Blender', C('#F5792A'), /^blender$/i, null, null),
  B('Steam', C('#66C0F4'), /^steam(webhelper)?$/i, null, null),
  B('Chrome', GOOGLE, /^chrome$/i, null, null),
  B('Edge', ['#0FB5AE', '#2B7DE9'], /^msedge$/i, null, null),
  B('Brave', C('#FB542B'), /^brave$/i, null, null),
  B('Firefox', ['#FF7139', '#E31587'], /^firefox$/i, null, null),
  B('Terminal', C('#C8C8C8'), /^windowsterminal$/i, null, null),
  B('File Explorer', C('#F8D775'), /^explorer$/i, null, null),
];
const BROWSER = /^(brave|chrome|msedge|firefox|opera|vivaldi|arc)$/i;
const BROWSER_SUFFIX = /\s[-–—]\s(?:Brave|Google Chrome|Mozilla Firefox|Opera|Vivaldi|Arc|(?:[^-–—]+\s[-–—]\s)?Microsoft​?\s?Edge)$/;
const STORE_APP =/^ApplicationFrameHost$/i; // Microsoft Store apps (Netflix, WhatsApp…) all run under this host

// Raw windows from the bridge -> one entry per app (web and store apps are recognised by their window title)
export function resolveApps(windows, icons, fgTitle, logos = {}) {
  const out = new Map();
  for (const w of windows) {
    const byTitle = BROWSER.test(w.name) || STORE_APP.test(w.name);
    // browsers append their own name ("… - Brave", "… - Personal - Microsoft Edge"); drop it before matching
    const page = BROWSER.test(w.name) ? (w.title || '').replace(BROWSER_SUFFIX, '') : w.title || '';
    const titled = byTitle ? BRANDS.find(b => b.title?.test(page)) : null;
    const brand = titled || BRANDS.find(b => b.proc?.test(w.name));
    if (STORE_APP.test(w.name) && !brand && !w.title) continue;
    const key = titled ? 'web:' + titled.name : STORE_APP.test(w.name) ? 'store:' + w.title : 'app:' + w.name.toLowerCase();
    const fg = w.fg && (!fgTitle || w.title === fgTitle); // a browser has many windows under one process
    const prev = out.get(key);
    if (prev) { prev.fg ||= fg; continue; }
    const icon = titled || STORE_APP.test(w.name) ? null : icons[w.path] || null;
    out.set(key, { key, name: brand?.name || (STORE_APP.test(w.name) ? w.title : w.desc || w.name), icon,
      logo: icon ? null : logos[brand?.name] || null, colors: brand?.colors || null, fg });
  }
  return [...out.values()].sort((a, b) => b.fg - a.fg);
}

// Unknown apps: take the most saturated average color of their icon
const cache = new Map();
export function iconColor(url) {
  if (!url) return Promise.resolve(null);
  if (!cache.has(url)) cache.set(url, new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, 16, 16);
      const d = x.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0, w = 0;
      for (let i = 0; i < d.length; i += 4) {
        const s = (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) * d[i + 3] / 255;
        r += d[i] * s; g += d[i + 1] * s; b += d[i + 2] * s; w += s;
      }
      resolve(w > 50 ? `rgb(${r / w | 0},${g / w | 0},${b / w | 0})` : '#B8B0AA'); // grey icons get a neutral glow
    };
    img.onerror = () => resolve(null);
    img.src = url;
  }));
  return cache.get(url);
}
