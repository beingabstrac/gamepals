# 11 — Visual design & game feel

Goal: Game Pals should look bright and toy-like and **feel** good on every tap, so short sessions are satisfying and reviews stay high. Researched 2026-09-12.

## 1. Principles
1. **Every action answers back.** Tap → button squashes + click sound + light haptic. Place a piece → it pops/drops in with overshoot. Win → strike/glow, small screen shake, fanfare, confetti. ("Juice it or lose it", GDC 2012: the same game feels alive once feedback is layered on.)
2. **Juice serves clarity.** Effects highlight what just happened (last move, winning line, whose turn); they never hide the board. Big effects (shake, confetti) only for big moments.
3. **Polish after the rules are final.** Each game ships its rules + bots first, then a juice pass (see per-game checklist in §7).
4. **Readable for everyone.** Player colors differ in brightness as well as hue and always come with a shape/icon (X vs O, marked discs). Avoid red-vs-green pairs. Test in grayscale.
5. **Respect settings.** Sound and haptics toggles on the home screen; honor `prefers-reduced-motion`; never vibrate when haptics are off.

## 2. Style
- **Look:** "soft toy" (claymorphism-lite) — rounded 20–24 px cards, pill chips, chunky buttons with a solid bottom edge that presses down, vibrant per-game gradients on a deep indigo background. Matches 2026 casual trends (rounded, colorful, playful 3D-ish depth).
- **Type:** **Fredoka** (headings, buttons, numbers) + **Nunito** (body). Both OFL, bundled with the app via `@fontsource/*` so they work offline.
- **Color tokens:** background `#141733 → #251c4d` gradient; surfaces `#262a55`; text `#f6f7ff`; muted `#aab0dd`. Player colors: blue `#4f8cff`, coral `#ff6b6b`, sun yellow `#ffd23f`, mint `#3ddc97` (for 4-player games pair with icons).
- **Per-game identity:** each game has a two-color gradient used on its card, setup screen and Play button.

## 3. Motion
| Moment | Effect | Timing / easing |
|---|---|---|
| Home cards appear | Staggered pop-in (scale 0.9 → 1, fade) | 40 ms stagger, 300 ms `cubic-bezier(.2,.9,.3,1.3)` |
| Button press | Squash to 0.96 + 3 px press | 80 ms |
| Place mark (Tic-Tac-Toe) | Scale 0.2 → 1 with overshoot | 220 ms `Back.easeOut` |
| Drop disc (Four in a Row) | Fall with bounce, longer from higher up | 120 + 45 ms × rows `Bounce.easeOut` |
| Winning line | Strike draws across / rings glow, then slow pulse | 280 ms `Cubic.easeOut`, pulse 500 ms yoyo |
| Win | Camera shake (tiny), confetti, result sheet slides up | shake 160 ms @ 0.006 |
| Result sheet | Slide up + fade | 260 ms |

Reduced motion: CSS animations off; scene tweens stay short.

## 4. Sound
- Built-in Web Audio synth (`apps/client/src/sfx.ts`, no audio files, no licenses): tap, place, bot place, win arpeggio, lose, draw.
- Later: CC0 packs (Kenney UI/digital audio) or ZzFX (MIT, < 1 KB) for richer effects; light background music optional and off by default.

## 5. Haptics
- Light tick on taps/placements, a short success pattern on a win, one longer pulse on a loss.
- Web: `navigator.vibrate` (Android browsers); apps: `@capacitor/haptics` (M1) using the platform API so system settings are respected.

## 6. Phaser 4 tools to use
- Tweens (pop, drop, pulse), camera shake/flash.
- **Filters** (Phaser 4 unified filter system): internal filters on objects (glow on the winning pieces), external filters on the camera (subtle bloom/vignette) — test on low-end Android first.
- Particles (ParticleEmitter) for sparkles on captures and wins in later games (Ludo, Air Hockey).

## 7. Per-game juice checklist
- [ ] Piece placement has motion + sound + haptic
- [ ] Last move is visible at a glance
- [ ] Whose turn is obvious (status + color)
- [ ] Win/draw has a distinct celebration
- [ ] Works with sound and haptics off, and in grayscale
- [ ] 60 fps on a mid-range phone

## 8. Later
- Custom illustrated icons per game (replace emoji), animated mascot for empty states, board/piece themes as Pro cosmetics, seasonal themes (Diwali Ludo board, winter cards).

## Sources
- [GDC Vault – Juice It or Lose It](https://www.gdcvault.com/play/1016487/Juice-It-or-Lose) · [Breakdown of the talk](https://verbotengames.wordpress.com/2014/04/05/breaking-down-juice-it-or-lose-it/)
- [Game feel on the web: squash, shake, juice](https://valdemird.com/blog/game-feel-on-the-web/) · [GameAnalytics – Squeezing more juice](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design) · [Egmatic – game feel](https://egmatic.com/blog/how-to-make-your-game-feel-good)
- [Pixune – mobile game UI examples 2026](https://pixune.com/blog/best-examples-mobile-game-ui-design/) · [Mobile UI trends 2026](https://www.designstudiouiux.com/blog/mobile-app-ui-ux-design-trends/)
- [Phaser 4 filter system](https://phaser.io/news/2026/05/phaser-4-filter-system) · [Phaser 4 particles notes](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/particles/)
- [ZzFX (MIT)](https://github.com/KilledByAPixel/ZzFX)
- [Haptics in mobile UX (Interhaptics)](https://interhaptics.medium.com/mobile-gaming-ux-how-haptic-feedback-can-change-the-game-3ef689f889bc) · [Respecting haptics settings (Bugnet)](https://bugnet.io/blog/how-to-fix-mobile-game-haptics-firing-when-device-is-silent)
- [Color-blind-friendly board game design](https://www.hicreategames.com/color-blind-friendly-board-game-design/) · [Unlocking colorblind friendly game design](https://chrisfairfield.com/unlocking-colorblind-friendly-game-design/)
