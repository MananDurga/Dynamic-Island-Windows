# Ember Island — design system

## Product
A personal "dynamic island" overlay for a Windows 11 laptop. A pill sits at the top-center of the screen,
always on top. It is inspired by the iPhone Dynamic Island but has its own identity: a phoenix.

Jobs:
- Glance: clock, weather, battery, now-playing, active app — in a 36px-tall compact pill.
- Approve: when Claude Code needs permission, the pill drops open with a soft "ting", shows what Claude wants
  to do (a shell command or a file edit) and two buttons: Allow / Deny. Approvals only — no prompt typing.
- Notify: every Windows notification appears in the island (app icon, app name, title, body), auto-collapses after ~5s.
- Idle: when nothing is happening, a small 3D phoenix lives in the pill and loops its life cycle:
  ash → reborn chick → grown phoenix → ignites → combusts back to ash.

## Surfaces & sizes
- Compact pill: 240 × 36, radius 18.
- Expanded card: up to 520 × 210, radius 30.
- Window is transparent; only the pill is visible.

## Material
- "Smoked obsidian glass": background rgba(10, 8, 8, 0.90) (90% opaque) with backdrop blur 24px and saturation 140%.
- 1px inner highlight on the top edge: rgba(255,255,255,0.08).
- Soft outer shadow: 0 8px 30px rgba(0,0,0,0.45).

## Signature: the living rim
A 1.5px glowing border around the pill (conic/linear gradient + outer glow 0 0 14px). Color = state:
- Idle: ember gradient #3a1d12 → #6b2d16 at 35% opacity, slowly breathing.
- Claude Code working: coral #E8775A, gentle pulse (2.4s).
- Claude needs approval: coral #FF8A65 brightening, faster pulse (1.2s).
- Music: tinted from album art (default teal #5EEAD4).
- Notification: the sending app's accent (default azure #60A5FA).

## Color
- Text primary #F5F1EE, secondary #A39A94, tertiary #6E6560.
- Inner cards: rgba(255,255,255,0.05) with 1px rgba(255,255,255,0.06) border, radius 16.
- Allow button: solid #F5F1EE text #140c09. Deny button: transparent, 1px rgba(255,255,255,0.18), text #F5F1EE.
- Phoenix palette: ash #4a4440 → ember #ff6a2a → flame #ffb347 → core #fff2c2.

## Type
- "Segoe UI Variable Display" (fallback "Segoe UI", system-ui). Only this family.
- Compact text 13px/500. Card titles 14px/600. Big numerals 28px/600 tabular-nums. Meta 11.5px/500 uppercase letter-spacing .06em.
- Code (Claude command preview): "Cascadia Code", 12px, on rgba(0,0,0,0.35) block, radius 10.

## Motion
- Morph: spring, slight overshoot (cubic-bezier(.2,.9,.3,1.25)), 380ms.
- Content fades/slides 6px after morph, 160ms.
- Respect reduced motion: no overshoot, no particle animation.
