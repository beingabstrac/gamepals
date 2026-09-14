# 13 — Every surface, every way to play

Decided 2026-09-13 (owner): Game Pals ships on **every surface** and supports **every way to play**. Nothing is "phone only" and nothing is "online only" unless it truly needs the internet. This doc is the checklist every game and every feature is held to, and how we test it for $0.

## 1. Surfaces

| Surface | How it ships ($0) | Notes |
|---|---|---|
| iPhone | Capacitor iOS app, App Store | TestFlight on release tags |
| iPad | Same iOS app, universal | Landscape and portrait, split view, keyboard and trackpad |
| Mac | The iPad app on Apple silicon Macs ("Designed for iPad", opt in on App Store Connect), plus the web app installed as a PWA from Safari or Chrome | No extra code or fees. Mac Catalyst only if the iPad app on Mac falls short |
| Android phone | Capacitor Android app, Google Play | Play internal track on release tags |
| Android tablet, foldable, Chromebook | Same Android app (large-screen ready), plus the web app | Resizable windows, mouse and keyboard |
| Web (any browser) | GitHub Pages now, Cloudflare Pages later; installable PWA | Chrome, Safari, Firefox, Edge |
| Windows, Linux | Web app installed as a PWA | Microsoft Store listing through PWABuilder later, free |
| Game portals | CrazyGames, Poki, GameDistribution, itch.io builds | Portal ad SDKs, no AdMob |

Every screen must work at every size from a small phone (360×640) to a big desktop (1920×1080), in portrait and landscape, with touch, mouse and keyboard.

## 2. Ways to play

| Mode | Needs internet | Status |
|---|---|---|
| Solo (puzzles, cards) | No | Built |
| Vs bot, Easy to Expert | No | Built |
| Same device, 2 to 4 players | No | Built |
| Online, random players (with a labeled bot fallback) | Yes | M3 |
| Online with friends (code, link, QR, recent) | Yes | M3 |
| Family groups | Yes | M3 |
| Async turns with push ("your turn") | Yes, to send | M3 |
| Race and Daily (same seed for everyone) | Only to compare | M4 |
| Leaderboards: global, country, friends, family × daily, weekly, all time | Only to sync | M3 |
| Nearby offline multiplayer | No | M5 research |

Offline rules: everything that doesn't need other people works on a plane. Scores and results made offline wait in an outbox and sync later. Online buttons say plainly when there's no connection instead of failing.

## 3. How we test it (all free)

| Layer | Tool | What it proves | When |
|---|---|---|---|
| Rules and bots | Vitest | Real rules, determinism, replay, bot levels | Every push |
| Every game on every surface | Playwright device projects (below) | Opens, plays, no console errors | Every push (core set), weekly and on tags (all) |
| Layout | Playwright layout test | No sideways scrolling, board fits the screen, tile art stays inside its tile | Same as above |
| Keyboard | Playwright key presses (number keys, arrows, Enter, Space) | Games play without touch or a mouse, for desktops, Macs and Chromebooks. Turn games: number keys, arrows + Enter (`games/keys.ts`). Duels on one keyboard: bottom player arrows + Space, top player WASD + Shift; against a bot both sets work (`duel.ts` `onDuelKeys`, `heldDuelKeys`) | Every push |
| Offline | Playwright with the network cut after load | Games start and finish with no connection | Every push |
| Web install and cold offline start | PWA service worker (vite-plugin-pwa precaches the build) + Playwright offline reload in Chromium | The installed web app opens and plays with no connection at all | Every push |
| Whole games on every screen type | Playwright `@full` tests with `?autoplay` (bots in every seat, sped up) | Every game reaches its result and a rematch starts, with no errors | Weekly, tags, manual runs |
| The real Android app | Capacitor APK built in CI, Android 14 emulator, Playwright attached to the app's own WebView (`apps/client/e2e-native/android.mjs`) | Installs, launches, fits the screen, every game plays to the end inside the app; screenshots saved | Weekly, tags, manual runs |
| The real iOS app on iPhone and iPad | Capacitor iOS project built on a GitHub macOS runner; a self-test build (`VITE_SELFTEST=1`, `src/selftest.ts`) plays every game to the end inside the app; `e2e-native/ios-selftest.sh` reads its `SELFTEST` log lines on iPhone and iPad simulators | Installs, launches, fits the screen, every game ends, one board after rematch; screenshots saved | Release tags, or manual runs with "ios" ticked (macOS minutes count 10×) |
| Android app on real phones and tablets | Firebase Test Lab (free Spark: 5 physical + 10 virtual device runs a day), Robo test of the AAB | Launches, no crashes, on many devices | Release tags |
| iOS and iPad app | Xcode Cloud (25 free hours a month with the Apple Developer Program) simulators, plus TestFlight on the owner's devices | Launches, safe areas, rotation | Release tags |
| Mac | The iPad build on an Apple silicon Mac through TestFlight | Window resizing, mouse, keyboard | Release tags |
| Online and friends | Two or more Playwright browser contexts against a local Worker (Wrangler/Miniflare) | Matchmaking, moves sync, reconnect after a network drop, bot fallback | Every push once M3 starts |
| Leaderboards | Worker tests + referee replays | Scores are verified by replaying the move log; friends and family boards filter correctly | Every push (M3) |
| Load | Bot clients against a preview Worker | Free-tier caps hold; budget guard shows "busy, try later" | Before M3 launch |
| Plane test | Real iPhone, iPad, Android phone, Android tablet in airplane mode | Every offline mode of every game | Before every release |

### Playwright device projects
`apps/client/playwright.config.ts`:

| Project | Engine | Stands in for |
|---|---|---|
| `android-phone` | Chromium, Pixel 7 | Android phones |
| `iphone` | WebKit, iPhone 15 | iPhone (Safari engine, same as the iOS app's WebView) |
| `ipad` | WebKit, iPad Pro 11 portrait | iPad |
| `ipad-landscape` | WebKit, iPad Pro 11 landscape | iPad, Mac window |
| `android-tablet` | Chromium, Galaxy Tab S4 | Android tablets, Chromebooks |
| `desktop-chrome` | Chromium, 1280×720 | Windows, Linux, Chromebook, Mac Chrome |
| `desktop-safari` | WebKit, 1280×720 | Mac Safari |
| `desktop-firefox` | Firefox, 1280×720 | Firefox everywhere |

Every push runs the core set (`android-phone`, `iphone`, `ipad-landscape`, `desktop-chrome`) as parallel CI jobs. Release tags and the weekly run use all eight. This keeps us inside GitHub Pro's 3,000 free Linux minutes a month.

## 4. Rules for every new game
- Plays well with touch, mouse and keyboard.
- Board fits the screen in portrait and landscape; controls never fall off the screen.
- Text faces the person playing (docs: `duel.ts` `facing()`).
- Works fully offline; online modes are added on top, never required.
- Listed in `apps/client/e2e/smoke.spec.ts`, so it's opened and played on every surface.
