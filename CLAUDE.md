# Game Pals — project context

All-in-one casual games app (board, card, party, puzzle, reflex) for **every surface**: iPhone, iPad, Mac (iPad app on Apple silicon + PWA), Android phones, tablets and Chromebooks, Windows/Linux (PWA), web and game portals. Surfaces, modes and the test matrix: `docs/13-platforms-and-testing.md`. Every game must fit portrait and landscape, work with touch, mouse and keyboard, and pass e2e on all 8 Playwright screen types.
Every game supports as many of these as make sense: solo, vs bot (Easy/Medium/Hard/Expert), same-device 2–4 players, online random, online friends/family, async turn-based. Everything except online works offline.

Read `README.md` and `docs/` first — decisions are recorded there. Update the relevant doc when a decision changes. Full build plan: `docs/08-roadmap.md` + `docs/04-tech-architecture.md`.

## Locked decisions
- **Phaser 4 + TypeScript + Vite**, Preact for menus/shell, **Capacitor** for iOS/Android. Developed fully in the cloud (GitHub Codespaces); builds on GitHub Actions (web, Android) and Codemagic (iOS). Nothing heavy installed on the owner's Mac.
- **Zero budget:** free tools/tiers only. Apple + Google developer accounts already exist.
- Game rules live in `packages/rules`: pure, deterministic TypeScript (seeded `createRng`, no `Math.random`, no Phaser/DOM imports). Client, bots, tests and the server referee all use it.
- Backend: Cloudflare Workers + Durable Objects + D1 (free tier), Firebase Auth/Messaging/Analytics/Crashlytics. All online calls go through our own `IBackend` interface.
- Ads: `@capacitor-community/admob` (MIT), rewarded-first. Purchases: RevenueCat. Portal builds (CrazyGames/Poki) use portal SDKs instead of AdMob.
- App saves: native storage (`@capacitor/preferences` / SQLite), never localStorage/IndexedDB inside the apps (iOS can evict them). Use `storage` from `apps/client/src/platform.ts` (Preferences in the apps, localStorage on the web), never `localStorage` directly. `platform.ts` also provides device haptics and the Android Back button (game → table → home).
- **Slow bots think in a Web Worker:** `apps/client/src/bot/worker.ts` + `bot/runner.ts`, for the games in `HEAVY_BOTS` (deep search or playouts). Only the move log crosses over; `chooseBotMove` (`packages/rules/src/games/catalog.ts`) rebuilds the game there, keeping the last few games so each move costs one apply, not a full replay. Quick bots decide inline from the live state, because a message round trip costs more than their thinking. Both paths seed from the game seed + move number, so they agree. If a worker cannot start, errors, or passes an 8 s budget, the move is worked out on the main thread.
- **Keyboard play is required:** every game plays with keys too, via `games/keys.ts` (`onKeys`, `focusRing`, `moveRing`): number keys where they fit, arrows + Enter/Space, a grape focus ring that hides on touch.
- **Installable web app (PWA):** `vite-plugin-pwa` precaches the whole build so the web app installs and opens offline. The service worker is registered in `main.tsx` on the web only, never inside the native apps or self-test builds. App icons come from `apps/client/scripts/make-icons.mjs` (`pnpm --filter @gamepals/client icons`).
- **Test mode:** `?autoplay` (web) or `VITE_SELFTEST=1` builds (native) put bots in every seat and speed games up; `e2e/full.spec.ts` (@full) and the native jobs use it to play every game to the end.
- No GPL code in shipped apps (e.g. no Stockfish). No trademarked game names (see docs/03). CC0/permissive assets only, logged in `docs/licenses.md`.
- No free-text chat — emotes/preset phrases only. Bots never cheat.
- Look & feel follows `docs/12-catalog-and-direction.md` Part 3 (supersedes the style in docs/11): white app, flat candy colors from `apps/client/src/theme.ts`, **no gradients**, cute bubbly rounded UI, original vector art (`components/Art.tsx`), crisp rendering (`games/crisp.ts` — every scene calls `fitCamera` first), springy/physical motion (gravity, arcs, squash), and choices made by tapping things (table setup), never forms. Every action gets motion + `cue()` sound/haptic. Run the per-game juice checklist before calling a game done.
- Game catalog and build waves: `docs/12-catalog-and-direction.md` Part 2.
- **Bright** candy colors (not pastel). Every game has a plain-language `howTo` (goal, controls, win, draw/tip) shown before play. All app text is simple and plain spoken, and never uses em dashes.
- **Teach and keep score:** the first time a game is opened, one line under the board says what to do first (`firstplay.ts`, `tryIt` in the registry, defaulting to the first sentence of `howTo.controls`); it goes on the first move or after ten seconds and never takes a tap. Games between the same players keep a running score on the device (`rivalry.ts`), shown on the result sheet and the table, and following a player's **name** rather than their seat, because seats rotate between games.
- **Facing:** use `facing()` / `isPerson()` from `apps/client/src/games/duel.ts`. With two people, the top player's text is flipped; against a bot, all text faces the person and the bot's controls/hints are hidden.
- Audit of every game against its real rules: `docs/games/audit.md`.
- **SVG in Preact:** write SVG attributes in dashed form (`stroke-width`, `text-anchor`, `dominant-baseline`, `font-size`). Preact v10 passes camelCase SVG props through unchanged, and the browser ignores them. Center text with `text-anchor="middle"` + `dominant-baseline="central"` on each `<text>`.
- **Research before building:** every game gets a brief in `docs/games/<id>.md` (real rules with sources, what makes it feel right, reference apps, our design, tests) before any code. Each game must be clearly its own game, not a reskin of another.
- **CI minutes are finite** (3,000/month on GitHub Pro for a private repo, and we ran out on 2026-09-18): a push runs two engines (`desktop-chrome` + `iphone`), the full eight only at a milestone end, the Android emulator and iOS are opt-in, and browser engines are cached. A public repo would make Actions free and unlimited. Details in `docs/08-roadmap.md`.
- **Nothing ships unless it's green:** one CI pipeline (`.github/workflows/ci.yml`): typecheck + unit tests + build → Playwright e2e on a phone browser (every game opened and played; any console error fails) → deploy web. Phone builds (TestFlight / Play internal) go out on release tags `v*` through the same gate. Add every new game to `apps/client/e2e/smoke.spec.ts`.

## Layout
- `packages/rules/src/core` — `GameDefinition`/`GameState` contract, `createRng`, negamax search, `createSearchBot`, move-log `replay`.
- `packages/rules/src/games/<id>` — one folder per game (rules + bot tiers + tests).
- `apps/client/src/session.ts` — runs any mix of human/bot seats; scenes only render `session.state` and call `session.play`.
- `apps/client/src/games/<id>` — Phaser scene per game; register it in `apps/client/src/games/registry.ts`.

## Commands
- `pnpm dev` — client on port 5173 (open the forwarded port on a phone)
- `pnpm test` — Vitest (rules)
- `pnpm typecheck`, `pnpm build`
- `scripts/precheck.sh [test paths]` — the checks that run on a machine with no `node_modules` (the owner's Mac): duplicate rules exports, duplicate art functions or tile keys, imports nothing uses, every game present in all six test lists, and the rules tests through a small vitest stand-in. Run it before pushing; CI has caught each of these at least once. It cannot see unused locals or parameters, which typecheck fails on, so read a new file over once before pushing it.

## Adding a game
1. `packages/rules/src/games/<id>/index.ts`: immutable state class, `GameDefinition`, bot tiers as data; export from `packages/rules/src/index.ts`.
2. Tests: legal moves, win/draw, illegal moves throw, replay, bot tier ordering.
3. `apps/client/src/games/<id>/<Name>Scene.ts` + registry entry.

## Status
M1 in progress (2026-09-13). Live at https://beingabstrac.github.io/gamepals/ (deployed only from a green CI run on main). 37 games: Tic-Tac-Toe, Four in a Row, Ludo, 2048, Sudoku (4 levels, notes, hints), Solitaire (Klondike, draw 1 or 3), FreeCell, Spider (one, two or four suits), Pyramid, TriPeaks, Crazy Eights (2 to 4 players, hidden hands), Go Fish (2 to 4 players), War, Memory (1 to 4 players, 3 sizes), Sliding Puzzle (3 sizes), Color Sort (3 levels, solver-checked), Echo (solo goals or 2 to 4 player party), Classic Snake (solo, best score), Checkers (English draughts), Chess (our own engine), Backgammon, Sea Battle, Reversi, Dots & Boxes (3 sizes, 2 to 4 players), Mancala (Kalah), Snakes & Ladders (2 to 4 players), Ultimate Tic-Tac-Toe, Yatzy (solo or 2 to 4 players), Shut the Box (9 or 12 tiles), Dominoes (Block or Draw, 2 to 4 players), Air Hockey, Ping Pong (table tennis), Tug of War, Reflex Race, Sumo, Penalty Kicks, Snake Battle. Games can take a level from the table (`levels` in the registry, passed to the rules as `variant`). Wave 3 done; the web app is an installable offline PWA. The card games share one look, one card renderer and one hidden-hand cover (`apps/client/src/games/cards/`). Work follows the loop-sized milestones in `docs/08-roadmap.md`: each /loop run finishes the first unblocked milestone end to end (green on every screen type, deployed), ticks it, and stops.
