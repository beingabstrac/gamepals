# 08 — Roadmap

Solo developer + Claude Code, working in GitHub Codespaces. Weeks are estimates; every milestone ends with something playable from a link or on a phone. Stack: [04](04-tech-architecture.md). Budget: [10](10-zero-budget-plan.md).

## M0 — Cloud setup (week 1)
- [x] pnpm monorepo, Vite + Phaser 4 + Preact client, Vitest
- [x] `packages/rules` core (contract, seeded RNG, search, bots, replay) + Tic-Tac-Toe with 4 bot tiers + tests
- [x] Client: home, game setup (vs bot with tier, 2 players same device), game screen with rematch
- [x] Devcontainer (Node 22, pnpm, Claude Code) + CI workflow (typecheck, test, build)
- [x] Private GitHub repo `beingabstrac/gamepals`, first green CI run, lockfile committed
- [ ] GitHub Pages (GitHub Pro) → playable URL on every push to main
- [ ] Playwright smoke test; ESLint/Prettier
- [ ] Free trademark search for "Game Pals" ([09](09-naming.md))

## M1 — App shell + 3 games, offline, on phones (weeks 2–5)
- [x] Shell: seat picker (vs bots with player count, same device 2–4, Mix & match any seat), result sheet, sound/haptics settings
- [ ] Shell: dark/light theme, i18n scaffold
- [x] Visual pass: toy-like UI, fonts, sound, haptics, animated scenes ([11](11-visual-design.md))
- [x] Design v2: white, flat, cute, crisp; table setup; physical motion ([12](12-catalog-and-direction.md))
- [x] Four in a Row, Ludo (2–4, bots fill seats)
- [x] Air Hockey (2P split-screen + bot, deterministic physics)
- [x] Wave 2 duels, part 1: Ping Pong, Tug of War, Reflex Race
- [x] Gated pipeline (unit + phone e2e before deploy); tap-to-pick seat picker; game briefs ([games/](games/README.md))
- [x] Ping Pong rebuilt as real table tennis; Sumo; Penalty Kicks
- [x] Snake Battle ([brief](games/snake-battle.md)) — wave 2 complete
- [x] Wave 3 puzzles (brief each first): [x] 2048, [x] Sudoku, [x] Solitaire, [x] Memory, [x] Sliding Puzzle, [x] Color Sort, [x] Echo (Simon-style, own name), [x] Classic Snake (solo); Nuts & Bolts dropped as a reskin of Color Sort ([12 Part 2](12-catalog-and-direction.md#part-2--master-catalog-everything-he-has-plus-more))
- [ ] Wave 4 board games (brief each first): [x] Checkers, [x] Reversi, [x] Dots & Boxes, [x] Mancala, [ ] Snakes & Ladders (rules done, screen next), [ ] Chess, [ ] Dominoes, [ ] Ultimate TTT, [ ] Yatzy, [ ] Shut the Box, [ ] Backgammon
- [x] Every-surface test matrix: 8 Playwright screen types, layout and offline checks ([13](13-platforms-and-testing.md))
- [ ] Layouts for landscape tablets and desktop windows (board fits height; controls beside the board when wide)
- [x] PWA: installable on Mac, Windows, Linux, Chromebook; service worker so the web app opens with no connection
- [ ] Bot Web Worker
- [ ] Capacitor iOS/Android projects; Preferences + SQLite; haptics; safe areas; rotated UI for same-device seats
- [ ] GitHub Actions Android AAB → Play internal testing; Codemagic iOS → TestFlight
- [ ] iPad universal build; opt in to "iPad app on Mac"; Android large-screen and Chromebook support
- [ ] Firebase Test Lab Robo run on tags (Android phones and tablets); Xcode Cloud simulator smoke test (iPhone, iPad)
- [ ] Start Play 12-tester closed test if the account requires it ([10 §1](10-zero-budget-plan.md#1-store-accounts))
- [ ] **Exit:** plane test passes on a real iPhone and Android phone

## M2 — Money + launch 12 (weeks 6–11)
- [ ] AdMob rewarded (undo/hint/retry) + UMP + ATT + neutral age screen; offline reward fallback
- [ ] Remove Ads via RevenueCat; Firebase Analytics + Crashlytics
- [ ] Checkers, Chess (own engine), Reversi, Dots & Boxes, Sea Battle, Crazy Eights, Solitaire, Sudoku
- [ ] Kenney CC0 art pass, tablet layouts, localization EN/HI/ES/PT-BR/ID, accessibility pass
- [ ] Store listings, screenshots, trailers; website with privacy policy + `app-ads.txt`; YouTube channel
- [ ] Launch web (itch.io, CrazyGames Basic), Android, iOS — soft launch Philippines + Canada, then global
- [ ] **Exit:** D1 ≥ 40%, D7 ≥ 15%, crash-free ≥ 99.5%, rating ≥ 4.6

## M3 — Online & social (weeks 12–19)
- [ ] Firebase Auth (guest → Apple/Google); account deletion
- [ ] `apps/server`: Worker + D1 + Durable Objects; budget guard
- [ ] Friends (code, link, QR, recent), family groups, presence, emotes, block/report
- [ ] Live online play for all turn-based games; matchmaking with rating bands + labeled bot fallback
- [ ] Async turn-based + push notifications
- [ ] Leaderboards: global/country/friends/family × daily/weekly/all-time; Glicko-2
- [ ] Invite & challenge deep links
- [ ] Online test suite: 2 to 4 browser contexts per match against a local Worker, network drop and reconnect, bot fallback, leaderboard filters; bot-client load test

## M4 — Depth (weeks 20–27)
- [ ] Race & Challenge (seeded) modes for solo games; Daily Challenge boards
- [ ] Realtime online Air Hockey (casual)
- [ ] Game Pals Pro subscription + cosmetics + family tournaments
- [ ] CrazyGames Full Launch (SDK) + GameDistribution + Poki submission
- [ ] Game Center / Play Games
- [ ] Interstitial A/B test via remote config

## M5 — Scale (ongoing)
- [ ] +2 games per month from backlog ([03](03-game-catalog.md#2-backlog-add-2-per-month))
- [ ] Nearby offline multiplayer (research first)
- [ ] More languages (FR, DE, TR, RU, VI, AR)
- [ ] Market-specific games (Dominoes, Truco-style, Carrom-style)
- [ ] Ranked seasons, tournaments, clubs
- [ ] Spin-off single-game apps (distinct games, not reskins)

## Budget
$0. Apple and Google developer accounts already exist; everything else uses free tiers ([10](10-zero-budget-plan.md)). Paid from revenue, in order: Apple renewal $99/yr → domain ~$10/yr → Cloudflare Workers paid plan ($5/mo) if free caps are hit → small ad tests → custom art.
