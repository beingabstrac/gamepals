# 08 — Roadmap

Solo owner + Claude Code. Rewritten 2026-09-16 as a list of **loop-sized milestones**: each one is finished end to end in a single `/loop` run and ends green and deployed. Stack: [04](04-tech-architecture.md). Budget: [10](10-zero-budget-plan.md). Catalog: [12 Part 2](12-catalog-and-direction.md#part-2--master-catalog-everything-he-has-plus-more). Test matrix: [13](13-platforms-and-testing.md).

## How we work (the loop)
1. Each `/loop` run opens this file and takes the **first unchecked milestone that isn't waiting on the owner**.
2. It does the whole milestone: brief first for any new game, rules + tests, screen, art, How to play, docs.
3. **Exit check** (every milestone): typecheck, unit tests and build pass; quick CI green; full CI green on all 8 screen types + Android emulator (+ iOS simulators for native milestones); deployed to the live site.
4. Tick the box, update the status in `CLAUDE.md`, post a short summary (done / not done / what the owner should try), then **stop the loop**.
5. Blocked on the owner? Add the ask to "Waiting on the owner" and take the next unblocked milestone.
6. Too big for one loop? Split it here **before** starting. Never leave a milestone half done.

## Waiting on the owner
These block the milestones marked 🔑. Some have long lead times, so start them early.
- [ ] Confirm the app ID (placeholder `app.gamepals.game`) and store name.
- [ ] App Store Connect API key as repo secrets (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`).
- [ ] Google Play: account type (a personal account made after Nov 2023 needs a 12-tester closed test for 14 days), a service-account JSON and an upload keystore as secrets.
- [ ] AdMob account and app IDs (M10). RevenueCat account (M11).
- [ ] Cloudflare account + API token, Firebase project (M13).
- [ ] Play every new game on a real phone after each quality pass and note what feels wrong. Tests prove games don't crash and can finish; they can't judge feel.
- [ ] Free trademark search for "Game Pals" ([09](09-naming.md)).

## Done so far
- [x] Monorepo, pure rules package (seeded, replayable), bots with 4 levels, session with any mix of people and bots
- [x] Shell: table setup by tapping chairs, levels, How to play, result sheet, rematch, sound and haptics
- [x] Look v2: white, flat candy colors, no gradients, crisp canvas, springy motion
- [x] One gated CI: unit → e2e on 8 screen types (phones, tablets, desktop browsers) → Android emulator → iOS simulators (on demand) → deploy
- [x] Installable offline web app (PWA); native storage, haptics and Back button wiring for the apps
- [x] Waves 1–3 and most of wave 4: 27 games (see `CLAUDE.md` status)

## Stage 1: the whole offline game, polished (web + PWA)
- [ ] **M1 Land wave 4 part 2:** Yatzy, Shut the Box, Dominoes green on every screen type (built, waiting for CI)
- [ ] **M2 Bot worker:** all turn-based bots think off the main thread, with a small "thinking" cue; heavy bots (Reversi, Ultimate, Dominoes, Chess next) never freeze the screen
- [ ] **M3 Chess:** own engine (castling, en passant, promotion, check, mate, stalemate, 50-move and threefold draws), 4 bot levels, move hints, no GPL code
- [ ] **M4 Backgammon + Sea Battle:** wave 4 complete
- [ ] **M5 Quality pass A (first 15 games):** screenshots of every game in portrait and landscape on phone, tablet and desktop; juice checklist; fix layout, motion and feel issues; landscape layouts (board beside controls)
- [ ] **M6 Quality pass B (the rest)**
- [ ] **M7 Cards A:** Spider, FreeCell, Pyramid, TriPeaks (cheap to build, top of the charts)
- [ ] **M8 Teach and rivalry:** 10-second "try it" hint on first play of each game; running score between the same players; rematch streaks

## Stage 2: phones, stores and money
- [ ] **M9 🔑 Native builds:** signed iOS (iPhone + iPad, also runs on Apple silicon Macs) and Android (phones, tablets, Chromebooks) builds from CI on `v*` tags; icons, splash, safe areas, orientation; TestFlight + Play internal track
- [ ] **M10 🔑 Ads:** AdMob rewarded ads (extra hint, undo, retry), UMP consent, iOS tracking prompt, offline grace; no ads in the web/portal build
- [ ] **M11 🔑 Pro:** Remove Ads + Pro through RevenueCat; restore purchases
- [ ] **M12 Store kit:** privacy page (no mic/camera/location, ever), store screenshots made by Playwright, listing text, `app-ads.txt`
- [ ] **Launch 1.0:** Android, iOS, iPad, Mac (iPad app), web; about 35 games

## Stage 3: online
- [ ] **M13 🔑 Backend skeleton:** Cloudflare Worker + D1 + Durable Objects deployed from CI, Firebase guest sign-in, `IBackend` in the client, daily budget guard, backend tests in CI
- [ ] **M14 Leaderboards:** solo scores (2048, Sudoku times, Classic Snake, Yatzy, Shut the Box, Sliding Puzzle...) checked on the server by replaying the move log; daily seeded challenge; global, country, friends
- [ ] **M15 Friends and family:** name + avatar (no free text), friend codes, links and QR, family groups, preset emotes
- [ ] **M16 Online live, 2 players:** rooms for every 2-player board game, invite links, reconnect, matchmaking with a labeled bot fallback
- [ ] **M17 Async turns + push notifications**
- [ ] **M18 Online 3–4 players + ratings (Glicko-2)**
- [ ] **M19 Realtime online duels (research first):** latency-tolerant Air Hockey; may stay same-device only if it doesn't feel good

## Stage 4: grow the catalog (brief first, 3–4 games per milestone, never a reskin)
- [ ] **M20 Cards B:** Crazy Eights, Go Fish, Old Maid, War
- [ ] **M21 Cards C:** Hearts, Spades, Callbreak
- [ ] **M22 Cards D:** Rummy, Gin Rummy
- [ ] **M23 Party (pass the phone):** Impostor, Charades, Draw & Guess, Guess the Person
- [ ] **M24 Heritage A:** Royal Game of Ur, Senet, Nine Men's Morris, Pachisi
- [ ] **M25 Heritage B:** Go 9×9, Hnefatafl, Fanorona, Chowka Bhara
- [ ] **M26 Board extras:** Gomoku, Chinese Checkers, Hex, Code Breaker
- [ ] **M27 Puzzles A:** Minesweeper, Nonogram, Mahjong Solitaire, Word Guess
- [ ] **M28 Chill shelf A:** Pop bubbles, Bubble wrap, Newton's cradle, Zen garden
- [ ] **M29 Duels B:** Pool, Mini Golf, Archery
- [ ] **M30+** The rest of the catalog, 3–4 per milestone, split here when we get there

After launch, alternate: one Stage 3 or 4 milestone, then one polish/bug milestone driven by player reviews and crash reports.

## Budget
$0. Apple and Google developer accounts already exist; everything else uses free tiers ([10](10-zero-budget-plan.md)). Paid from revenue, in order: Apple renewal $99/yr → domain ~$10/yr → Cloudflare Workers paid plan ($5/mo) if free caps are hit → small ad tests → custom art.
