# 08 — Roadmap

Solo owner + Claude Code. Rewritten 2026-09-16 as a list of **loop-sized milestones**: each one is finished end to end in a single `/loop` run and ends green and deployed. Stack: [04](04-tech-architecture.md). Budget: [10](10-zero-budget-plan.md). Catalog: [12 Part 2](12-catalog-and-direction.md#part-2--master-catalog-everything-he-has-plus-more). Test matrix: [13](13-platforms-and-testing.md).

## How we work (the loop)
1. Each `/loop` run opens this file and takes the **first unchecked milestone that isn't waiting on the owner**.
2. It does the whole milestone: brief first for any new game, rules + tests, screen, art, How to play, docs.
3. **Exit check** (every milestone): typecheck, unit tests and build pass; quick CI green; full CI green on all 8 screen types + Android emulator (+ iOS simulators for native milestones); deployed to the live site.
4. Tick the box, update the status in `CLAUDE.md`, post a short summary (done / not done / what the owner should try), then **stop the loop**.
5. Blocked on the owner? Add the ask to "Waiting on the owner" and take the next unblocked milestone.
6. Too big for one loop? Split it here **before** starting. Never leave a milestone half done.

## CI costs real minutes
GitHub Pro includes 3,000 Actions minutes a month for private repos, and on 2026-09-18 we used all of them: about 3,300 job-minutes on this repo alone (53% of the account's usage across six repos), from roughly 30 runs in a day. Past the allowance jobs are refused with "recent account payments have failed or your spending limit needs to be increased", which reads like a broken build but is billing. **Public repos get Actions free and unlimited**, which is the permanent fix if the owner is happy for the code to be readable. How we keep it cheap meanwhile:
- **One full run per milestone**, at the end. Between fixes the push gate runs two engines only: `desktop-chrome` (Chromium) and `iphone` (WebKit), no whole-game tests.
- **Browser engines are cached** (`~/.cache/ms-playwright`), so jobs stop re-downloading them.
- **The Android emulator job is opt-in** on manual runs (tick `android`), and runs by itself weekly and on release tags. It is about 25 minutes a go, the most expensive thing we have.
- **iOS stays off** except release tags and an explicit tick: macOS minutes count 10x.
- `scripts/precheck.sh` runs the whole rules suite and the duplicate scans on the owner's Mac with no `node_modules`, so most mistakes are caught before a run is spent.

## Waiting on the owner
These block the milestones marked 🔑. Some have long lead times, so start them early.
- [ ] Confirm the app ID (placeholder `app.gamepals.game`) and store name.
- [ ] App Store Connect API key as repo secrets (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`).
- [ ] Google Play: account type (a personal account made after Nov 2023 needs a 12-tester closed test for 14 days), a service-account JSON and an upload keystore as secrets.
- [ ] AdMob account and app IDs (M10). RevenueCat account (M11).
- [ ] Cloudflare account + API token, Firebase project (M13).
- [ ] Play every new game on a real phone after each quality pass and note what feels wrong. Tests prove games don't crash and can finish; they can't judge feel.
- [ ] Free trademark search for "Game Pals" ([09](09-naming.md)).
- [ ] **GitHub Actions is blocked on billing** (hit on 2026-09-18). Settings → Billing & plans: raise the Actions spending limit, or wait for the monthly reset. Nothing ships until a run can start.

## Done so far
- [x] Monorepo, pure rules package (seeded, replayable), bots with 4 levels, session with any mix of people and bots
- [x] Shell: table setup by tapping chairs, levels, How to play, result sheet, rematch, sound and haptics
- [x] Look v2: white, flat candy colors, no gradients, crisp canvas, springy motion
- [x] One gated CI: unit → e2e on 8 screen types (phones, tablets, desktop browsers) → Android emulator → iOS simulators (on demand) → deploy
- [x] Installable offline web app (PWA); native storage, haptics and Back button wiring for the apps
- [x] Waves 1–3 and most of wave 4: 27 games (see `CLAUDE.md` status)

## Stage 1: the whole offline game, polished (web + PWA)
- [x] **M1 Land wave 4 part 2:** Yatzy, Shut the Box, Dominoes green on every screen type (2026-09-16)
- [x] **M2 Bot worker (2026-09-16):** the bots that can take time (deep search or playouts: Checkers, Reversi, Ultimate, Mancala, Dominoes, Yatzy, Shut the Box, and Chess next) think in a Web Worker with a "thinking" cue, so the board never freezes; quick bots stay inline because a message costs more than their thinking; found the Android WebView page loss is not a crash (no crash log) and cut it down by loading the page once per run instead of per game, but it still happens now and then, so the relaunch-and-retry stays; a real fix is still open
- [x] **M3 Chess (2026-09-17):** own engine (castling, en passant, promotion, check, mate, stalemate, 50-move and threefold draws), 4 bot levels, move hints, no GPL code
- [x] **M4a Backgammon (2026-09-18):** full rules (bar, hitting, bearing off, must use both dice, higher die when only one fits, doubles give four moves), 4 bot levels
- [x] **M4b Sea Battle (2026-09-18):** place your fleet, take shots, hidden boards on one device, a bot that hunts properly; wave 4 complete
- [x] **M5 Quality pass A (2026-09-18):** played and screenshotted 12 of the first 15 games on a phone in portrait and fixed what that turned up: instructions moved out of dead buttons into a hint line (Shut the Box, Backgammon, Sea Battle, Dominoes), status lines capitalised and no longer repeating the hint, dice show faint pips before the first roll (Yatzy, Ludo, Snakes & Ladders), domino hand tiles grown from 24px to 32px, Sea Battle ships given hulls, Ultimate Tic-Tac-Toe only glows boards when your choice is actually narrowed, and the Snakes & Ladders status no longer lists four players who are all still at the start.
  - **Not covered, moved on:** landscape and tablet/desktop review, and portrait layouts for the wide boards. They belong with the landscape item below, not squeezed into a phone-portrait pass.
  - Found by hand on 2026-09-17 (phone, live site): Dominoes hand tiles are about 24px wide on a 375px phone (too small to tap; Apple asks for 44), and the table above them is mostly empty, so the line should scale up to fill it.
  - Solo status text starts lowercase ("roll the dice", "pick tiles that add up to 3"); capitalize it.
  - Shut the Box, Backgammon and Sea Battle each show a big disabled button that is really an instruction ("Pick tiles that add up to 3", "Tap a checker", "Fire at their waters") while the status line already says it. Pick one place for instructions and use it everywhere.
  - Sea Battle ships are plain grey blocks; give them a hull shape so they read as ships.
  - Backgammon point columns are about 25px wide on a 375px phone: widen the tap area (the whole triangle plus its checkers) even if the art stays the same.
  - Wide boards (Mancala, Dominoes, Backgammon, Yatzy) fill the width and leave the bottom third of a phone empty. Centring the board in that space was tried on 2026-09-18 and looked worse (a big gap under the title), so the real fix is a portrait layout per wide game, or landscape support. Not a CSS one-liner.
  - Yatzy dice are blank white before the first roll, which reads as broken; show faded pips or a "Tap Roll" hint.
- [x] **M6 Quality pass B (2026-09-18):** the remaining games looked over on a phone. Sumo, Penalty Kicks, Tug of War, Echo, Classic Snake, 2048, Sudoku, Solitaire, Reversi, Reflex Race and Color Sort all render correctly. Fixed: Tug of War no longer says "Ready…" and "Tap tap tap!" at once (the hints wait for "Pull!"); the Penalty Kicks callout sits clear of the ball instead of on top of it; Sudoku's "Notes off" toggle reads "Notes", with the pressed state carrying the meaning; and the games where looking at the board does not tell you what to do (2048, Sliding Puzzle, Memory, Echo) show a one-line controls hint that goes once you make a move, with Classic Snake saying it on the board like the other real-time games.
  - **The review tool that makes this possible:** `e2e/gallery.spec.ts` takes a picture of every game being played and uploads it as a CI artifact (`gallery-iphone`). Before it, every Android screenshot the project saved showed an empty canvas, because Playwright cannot capture that WebView's canvas layer. The same pictures become the store screenshots in M12.
  - **Watch out when reviewing in a browser pane that is hidden:** the page gets no animation frames, so one screenshot catches pop-in animations half drawn. Three false alarms came from this (Echo with one pad, Yatzy with missing dice, Color Sort with clipped tubes). Take three or four screenshots in a row before believing anything.
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
