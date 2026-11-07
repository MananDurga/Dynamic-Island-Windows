# Ember Island — design (v2)

## Why
A dynamic island for this Windows 11 laptop that feels like *mine*, not an iPhone copy, and that saves
switching windows: glance at status, read every notification, and approve Claude Code permissions from the notch.

## Goals
1. **Look**: smoked-glass pill at 90% opacity, a thin glowing rim whose color shows state
   (ember = idle, coral = Claude working, bright coral pulse = approval needed, teal = music, azure = notification),
   springy morph with slight overshoot. Visual spec: [design-system.md](design-system.md).
2. ~~Phoenix idle mark~~ — dropped by the user; idle shows the normal compact widgets.
3. **Claude Code widget**: appears while any Claude Code session is working (coral mark + project name), gone when it stops.
4. **Approvals from the island** (approvals only, no prompts): pill drops open, plays a soft "ting", shows the tool and
   the command / file in plain words, Allow / Deny. Answer goes straight back to Claude Code.
5. **All Windows notifications** mirrored in the island: app name, title, body; auto-collapse after ~5 s, hover holds it.
6. **Starts with Windows**.

## Non-goals
- Typing prompts or replying to Claude from the island.
- "Always allow" rules (stay in Claude Code settings).
- Hiding Windows' own toast pop-ups (user can turn banners off in Windows Settings).

## Anti-goals (would be a failure even if it "works")
- Claude ever getting stuck because the island is closed or ignored.
- Any web page or other program being able to approve something for Claude.
- Covering the screen / stealing clicks outside the pill.

## How (decided)
- Electron + plain HTML/CSS/JS (no framework). Tauri was tried; Windows Smart App Control blocks locally compiled apps, so it stays Electron.
- **Claude Code link**: the island runs a local web endpoint on 127.0.0.1 only, with a random secret in the URL.
  User-level Claude Code hooks (`~/.claude/settings.json`) send it: `UserPromptSubmit` (working), `Stop`/`SessionEnd`
  (done), and `PermissionRequest` (wait for Allow/Deny, then answer). Applies to every Claude Code session on this laptop,
  desktop app and terminal.
- If the island is closed, not answered within 120 s, or errors → no answer is returned and Claude shows its normal prompt.
- If you answer in the Claude app first, the card disappears on the session's next event.
- **Notifications**: Windows notification listener (access already granted), read by the existing PowerShell bridge.
- **Sound**: a short synthesized chime (no audio file).
- **Autostart**: Electron's "open at login" setting.

## Builder's calls (not discussed — easy to change)
- Real background blur is not possible for a pill-shaped transparent window in Electron; the glass is a 90% dark tint without blur.
- Several pending approvals queue and show one at a time.
- Approval timeout 120 s.
