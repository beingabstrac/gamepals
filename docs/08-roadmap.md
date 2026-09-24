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
- [ ] **The name.** "Game Pals" is not liked and is not final. Rejected so far: Pips, Turno, Dado, Roda, Toybox, and "Your Turn" (unusable: [ItsYourTurn Games](https://apps.apple.com/us/app/itsyourturn-games/id6748541223) is our pitch in our words, plus three other "Your Turn" apps, and every domain gone). Nothing ships to a store until this is settled, because the bundle ID is permanent from the first upload. Whatever it is, the store title is brand first then JindoBlu's keywords: `<Name>: 2 Player Games` with `Offline cards, board & bots` under it.
- [ ] Confirm the app ID (placeholder `app.gamepals.game`) once the name is settled.
- [ ] App Store Connect API key as repo secrets (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`).
- [ ] Google Play: account type (a personal account made after Nov 2023 needs a 12-tester closed test for 14 days), a service-account JSON and an upload keystore as secrets.
- [ ] AdMob account and app IDs (M10). RevenueCat account (M11).
- [ ] Cloudflare account + API token, Firebase project (M13).
- [ ] Play every new game on a real phone after each quality pass and note what feels wrong. Tests prove games don't crash and can finish; they can't judge feel.
- [ ] Free trademark search for "Game Pals" ([09](09-naming.md)).
- [ ] A support email address for the store listings (M12b). Not a personal address unless you want it public.
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
- [x] **M7a Cards, tableau pair (2026-09-18):** FreeCell and Spider, 32 games. Both play like our Klondike, so all three now draw from one card module (`apps/client/src/games/cards/`): one card face, one slide, one hint bus. FreeCell has the supermove limit, sends home the cards nothing can need, and says "Not enough free cells for that many" instead of ignoring the tap. Spider has one, two and four suits, the rows left shown on the deck, a shake when an empty column blocks the deal, and a spin as a finished run leaves the board. Spider's deal gives every card a number of its own, because eight cards can wear the same face and the screen has to tell them apart.
  - **Two real bugs this milestone turned up.** A stuck FreeCell deal made autoplay throw "No legal moves" (found by the Android run, not by any browser): both patience bots now take a move back instead, and the table says "No moves left. Undo, or start a new deal." And **cards never moved in test mode**: every state change killed each card's slide and started a new one, so when moves come faster than frames the new slide died before a frame drew it. That is why every gallery picture of Solitaire since M6 was an empty table with one card on the deck, and why the M6 note claiming Solitaire "renders correctly" was wrong. Slides now know where they are headed and are left to finish.
  - **A third bug came out of the same review:** cards were dealt face down and never turned over. The face only swapped at the end of the squeeze tween, and any slide starting in the same breath cleared it. Cards are dealt already turned now, and only a card uncovered in play turns over.
  - **Still to look at:** the 2048 gallery shot shows a 4 and an 8 but only two tiles, which smells like the same bug in `Twenty48Scene`. The scenes that animate per state change (2048, Sliding Puzzle, Ludo, Memory, Mancala, Snakes & Ladders) all deserve the same read. On a loaded CI runner the card deal is still visibly slower than the delays ask for, which is worth measuring before the store screenshots in M12.
  - **The local checks grew** (`scripts/precheck.sh`): imports nothing uses, and the gallery's own game list, which nobody had told it about. They still cannot see unused locals or parameters, which is what typecheck failed on three times this milestone.
- [x] **M7b Cards, pick-a-card pair (2026-09-18):** Pyramid and TriPeaks, 34 games. Both are about picking the right card rather than building anything, and both draw from the same card module as the other three patience games. Pyramid: 28 cards in seven rows, pairs that add up to 13, Kings alone, three passes through the deck, and every card that pairs with the one you hold lifts so nobody adds up by eye. TriPeaks: three peaks over a base of ten, one rank up or down with the Ace wrapping both ways, the cards you can take standing proud of the rest, and a run counter that grows until you go back to the deck.
  - **The flip rule finally settled.** M7a dealt cards already turned to stop the deal-time flips being killed; TriPeaks then showed a face-down card sitting on the waste, because a drawn card flips while it travels. Now any card that moves is turned as it goes, and only a card that turns where it lies animates, which is the one case nothing can race. Solitaire and Spider use the same rule.
  - **The gallery earned its keep again:** it caught Pyramid's pass count clipped off the bottom edge, two thirds of both tables empty, and that face-down waste card. Solitaire's picture finally shows a real game in progress, foundations and all, for the first time since M6.
- [x] **M8 Teach and rivalry (2026-09-18):** the first time you open a game, one line under the board says the thing to do first, taken from that game's own "how to play" words (`tryIt` in the registry overrides it). It goes when you move or after ten seconds, and it never takes a tap. Games between the same players keep a running score on this device, shown on the result sheet and on the table: "Pip 0 · Nova 2", with "Nova has won 2 in a row" under it. The tally follows a player's name, not their chair, because seats rotate between games so a different side starts. Solo puzzles keep no score, since there is nobody to keep it against.
  - **Tested for real, not just built:** `e2e/rivalry.spec.ts` checks the line shows the first time and not the second, that it cannot be tapped, that the score counts two games between the same players, and that a solo game has none. It also files a picture of both, on every push, because neither shows up in the game gallery: the coaching line goes the moment a bot moves, and the score lives on the result sheet.
  - **A picture of nothing now fails.** The first run of that shot caught the result sheet at the start of its slide, when it is still invisible, and filed it as if it were fine. It now waits for the sheet to arrive and says so.
  - **One flake fixed on the way:** the chess bot tournament timed out at 5103ms against the default 5000. Every other bot tournament in the suite already carried its own timeout; that one did not.

## Stage 2: phones, stores and money
- [ ] **M9 🔑 Native builds:** signed iOS (iPhone + iPad, also runs on Apple silicon Macs) and Android (phones, tablets, Chromebooks) builds from CI on `v*` tags; icons, splash, safe areas, orientation; TestFlight + Play internal track
- [ ] **M10 🔑 Ads:** AdMob rewarded first (extra hint, undo, retry, a second go at a daily), one interstitial between games with a hard cap and never inside a turn, UMP consent, iOS tracking prompt, offline grace, no ads in the web or portal build. The loudest complaint in every review set we read is ad frequency, so the cap is a feature we say out loud.
- [ ] **M11 🔑 Pro, three ways:** monthly, yearly and lifetime through RevenueCat, with **lifetime as the hero** and the two subscriptions as the anchors beside it. Pro turns ads off, opens every level, keeps the daily archive and the full stats, and gives unlimited hints and undo. Restore purchases. The evidence says this audience buys the one-off (JindoBlu sells Remove Ads at $6.99 against 413K ratings; Ponder Club sells ad-free forever), so the page leads with it and the subscriptions exist to make it look like the sensible choice.
- [x] **M11b The paywall and the plumbing (2026-09-20):** everything about the money that needs no account. Three ways to buy with the one-off leading and flagged as the best value, what Pro unlocks, restore purchases, and a stub seller standing in for RevenueCat, so the shop and the entitlement work end to end today. When the keys arrive, `SELLER` is the only line that changes. Prices are provisional until the owner sets them.
  - **Ads have their rules rather than their account.** Rewarded is always asked for by the person (the first is Sudoku's hint once you run out), an interstitial can only ever happen between games, never inside a turn, not before three games, at most one every four minutes and six a day, and Pro turns the lot off. Ad frequency is the loudest complaint in this whole category, so the cap is the product, not a setting.
- [x] **M12a Store screenshots (2026-09-18):** five Playwright projects render at exactly the sizes the stores ask for, the shots come from real play, and CI hands them back as an artifact when you tick **store** on a manual run. Sizes, sources and gaps: [14](14-store-kit.md).
  - **Checked both vendors' pages rather than trusting memory, which was as well.** Apple takes 1260 × 2736 (6.9" iPhone) and 2064 × 2752 (13" iPad) and scales those down for every smaller size. **Google Play insists on exactly 16:9 or 9:16**, which Apple's shapes are not (1260 × 2736 is about 1:2.17), so Play cannot reuse them and gets its own pair. Every shot is a JPEG, because both stores refuse an alpha channel and a JPEG cannot carry one.
  - **The pictures found a real gap.** On a 13" iPad the board fills the width and leaves the bottom third of the screen empty; on a landscape tablet it sits in the middle third with empty felt either side. The e2e layout checks never caught it because nothing overflows: it is wasted space, not broken layout. Same root as the phone note under M6. **The tablet shots should not be uploaded until M12c.**
- [x] **M12c Room on big screens (2026-09-19):** the stylesheet had exactly one media query in it, for reduced motion, so every screen was 720px wide and centred. Wide screens now let the page grow (1040px, then 1200px), a board not fighting for width uses more of the height, and in landscape the board takes the height while whose turn it is, the controls and the first-time line stand beside it. The shelf goes from two columns to five on an iPad. Phones are untouched: every rule is behind a width or an orientation.
  - **The check I wrote failed first, which is the point.** Every layout check until now asked whether something overflowed, which is why a board in the middle third passed them all. The new one says what the layout is for: on a wide screen the turn line starts after the board ends, and the board takes over 70% of the height. It failed with "the turn line starts at 555 and the board ends at 935", because I had put the media rules **above** the rules they change and a media query carries no extra weight, so `display: flex` further down the file quietly undid the grid. Moved to the end of the file, it passes.
  - **Wide boards in portrait are still open.** Mancala, Dominoes, Backgammon and Yatzy fill the width and leave the bottom of a phone empty; that is a per-game portrait layout, not a stylesheet rule, and it is not done.
- [x] **M12b Store words (2026-09-18):** the privacy page is live at [/privacy.html](https://beingabstrac.github.io/gamepals/privacy.html), linked from the foot of the shelf, and shipped inside the apps so it opens with no connection. The listing text for both stores is in [15](15-store-listing.md), every field counted against its limit.
  - **Written from what the code does, not from what I assumed.** The app makes no network requests of its own, holds no advertising identifier, and asks for no permission; the fonts are bundled rather than fetched, which I checked because a font from a CDN would have been a third party to disclose. Everything it remembers (settings, which games you have opened, each table's last setup, the running score, the Classic Snake best) lives on the device.
  - **Nothing claims what has not shipped.** The subtitle I first drafted said "Online Pals", which would have been a false store claim until M16; the footer line I first wrote said "No ads", which M10 would falsify. Both are gone. The listing doc opens with what to re-check when ads, Pro and online land.
  - **Still on the owner:** a support address (both stores demand one, and I will not publish a personal address without being asked), and `app-ads.txt`, which needs an AdMob publisher ID. That file is a public statement about who may sell our ad inventory, so a placeholder is worse than nothing.
- [ ] **M12d The web channel:** portal builds (CrazyGames, Poki, GameDistribution) and an itch.io page, using the portal SDKs instead of AdMob. Ponder Club is not in the App Store at all and does fine, so this is not a consolation prize and it does not wait for M9.
  - [x] **The build itself (2026-09-21).** `VITE_PORTAL=1 pnpm build` produces a portal folder, and
    CI builds it on every push and keeps it as the `portal-build` artifact. It registers no service
    worker, because a portal serves the game from its own origin and some portals reject a build
    that installs one, and CI asserts that rather than trusting the flag: no `serviceWorker` in the
    bundle, no `sw.js`, no absolute paths in the HTML. Asset paths were already relative, so the
    game itself needed no changes. **The check failed on its first run**, which is the whole
    argument for writing it: not registering a worker is not the same as not shipping one, and the
    plugin was still writing `sw.js` into the folder. The plugin is now disabled rather than
    removed, because `main.tsx` imports one of its virtual modules and dropping it outright fails
    the build at that dynamic import even though the call sits behind the flag. Two failed runs to
    get one flag right, and the same check caught both.
  - [ ] **The portal SDKs.** Deliberately not written yet. Each portal's SDK loads from that
    portal's own origin and only behaves inside their frame, so an adapter written now could not be
    run against anything and would be a guess dressed as progress. It goes behind the existing
    `AdProvider` seam the day there is an account. **Owner:** a CrazyGames, Poki or itch.io account
    is all that is missing; the build is ready to upload.
- [ ] **Launch 1.0:** Android, iOS, iPad, Mac (iPad app), web; about 35 games
  - **The catalogue stopped being the constraint on 2026-09-19, at M20a.** There are 51 games
    against a launch target of about 35. Everything between here and a launch is either waiting on
    the owner (the name, the app ID, the store accounts, AdMob, RevenueCat, Cloudflare) or is
    quality work on what already exists. Adding a fifty-second game is not progress towards
    shipping, so the loop should prefer quality passes and the unblocked parts of M12d over new
    games until the owner-side list moves. New games are still worth building when there is
    nothing better; they are no longer the best thing available.

## Stage 3: online
- [ ] **M13 🔑 Backend skeleton:** Cloudflare Worker + D1 + Durable Objects deployed from CI, Firebase guest sign-in, `IBackend` in the client, daily budget guard, backend tests in CI
- [ ] **M14 Leaderboards:** solo scores (2048, Sudoku times, Classic Snake, Yatzy, Shut the Box, Sliding Puzzle...) checked on the server by replaying the move log; daily seeded challenge; global, country, friends
- [ ] **M15 Friends and family:** name + avatar (no free text), friend codes, links and QR, family groups, preset emotes
- [ ] **M16 Online live, 2 players:** rooms for every 2-player board game, invite links, reconnect, matchmaking with a labeled bot fallback
- [ ] **M17 Async turns + push notifications**
- [ ] **M18 Online 3–4 players + ratings (Glicko-2)**
- [ ] **M19 Realtime online duels (research first):** latency-tolerant Air Hockey; may stay same-device only if it doesn't feel good

## The look (tried and dropped, 2026-09-19 to 2026-09-20)
The flat candy look was called soft, so a second look went in behind `?look=2` and was built out over a day: first a dark card room of walnut, felt and brass, then, after the owner pointed at Township, a bright playroom where every surface carried a gradient, a top highlight, an outline, a lip and a shadow. Roughly twenty-five game tables were dressed in it. The owner did not like it, and it is out: one look again, the flat one.
What was worth keeping, and stayed:
- **The turn line never fades to nothing** (`pill-in`). It is keyed on its own text, so in a game whose line changes every move it used to sit at opacity 0 for the whole game.
- **A deploy no longer waits a day.** The page reloads once when the new service worker takes over, unless a game is on screen.
- **The game's page does its job in one screen.** The goal is one line, the rest of the rules are behind a toggle, and Play is reachable without scrolling.
- **`labelCheck()` and `e2e/labels.spec.ts`**, which catch a seat name running off a table or sitting on a card.
- **A time on every game**, which came from the model rather than the paint.
What it cost: about a day. What it bought: those five fixes, and a clear answer that the flat look stays.

## The model (decided 2026-09-20, from Ponder Club)
[ponderclub.co](https://ponderclub.co) is two independent developers running a daily-puzzle site with about sixteen games. They take the opposite line from JindoBlu: calm, anti-doomscroll, "thoughtful games for restless minds", and they say out loud that they have no investors. What they prove, and what we copy:
- **One lifetime unlock, never a subscription.** They sell "ad-free forever"; JindoBlu sells Remove Ads at $6.99. Two very different companies, same answer, so M11 leads with a one-time unlock and treats a subscription as an extra at most.
- **The web is a real channel, not a consolation prize.** "We have a Web App for smartphones and tablets. We are not in the App Store." Our PWA already works offline; it does not have to wait for M9.
- **A time on every game**, so a person knows whether they have time for it now.
- **A daily puzzle, a countdown to the next one, and a streak** — with a switch to hide the streak, because a hook you cannot turn off is a trap.
- **A shelf for games still in testing**, where scores do not count, so a new game can go out before it is finished.
The look stays the playroom (docs/12 Part 4). This is the model, not the paint.
- [x] **D1 A time on every tile (2026-09-20):** all 43 games carry `minutes` in the registry, shown on the shelf and beside the game's name on its own page.
- [x] **D2 The daily and the streak (2026-09-20):** one seeded puzzle a day, the same for everybody, from twelve solo games taking turns. A row at the top of the shelf with today's game, how long it takes, a countdown to the next one and the streak. No server: the seed is the date, so two people on opposite sides of the world get the same board with nothing stored anywhere.
  - The streak starts again at one after a missed day, finishing today twice changes nothing, and there is a switch to hide it next to sound and vibration, because a hook you cannot turn off is a trap.
  - **The Android emulator caught what eight screen types missed.** A third round button in the hero pushed the home screen 10px sideways and the flame hung off the edge. The WebView is narrower than any of our Playwright screens, so the layout spec now checks the shelf at 320 as well, with every settings button required to be in view. That is the second time a button has fallen off that row.
- **D3 Ad-free forever.** M11b built the entitlement, the three offers and the ad caps, and they
  work. What it also built was a page promising five things, of which one is true:
  | The page says | Is it real? |
  |---|---|
  | No ads, ever | Yes. `gameFinished` returns false for Pro and `watchFor` grants without watching. |
  | Every level of every game | **No.** Nothing gates a level anywhere, and gating what people already have would be a regression. Dropped from the wording rather than built. |
  | Hints and undo without watching anything | Half. The seam is real, but only Sudoku asks. |
  | Every day's puzzle in the archive | **No.** The only place that phrase appears is the promise. |
  | Your full stats and streak history | **No.** Same. |
  A paywall that lists things it does not do is how refunds and one-star reviews are earned, so
  the rest of D3 is making the page true. Split in two:
  - [x] **D3a The archive, and honest wording (2026-09-20):** the daily now keeps which days were
    finished, and a Past puzzles sheet lists four months of them, newest first, with the game each
    day held and a tick on the ones played. The last week is open to everybody, because a week is
    enough to catch up after a busy few days, and the rest is one of the three things Pro gives.
    Finishing an old day ticks it and does nothing to the streak: a streak that can be topped up by
    playing last Tuesday is not a streak. PRO_GIVES is down from five lines to three, all true.
  - [x] **D3b Stats and streak history (2026-09-20):** nothing was being counted, so this had to
    build the counting as well as the page. `stats.ts` records every finished game, in the
    real-time games too, and only when a person was in a seat: a build with bots in every chair is
    a test run, and counting those would have every number come from CI rather than from anybody.
    The sheet shows games finished, won, how many of the forty-six have been tried, days played and
    the daily streak, all free, with the game-by-game list cut to three until Pro. Per-game best
    scores are not here and are not promised: that needs every game to say what its score is, and
    that hook belongs with M14, where the server has to check the same number by replaying the move
    log. With the counting real, the stats line goes back on the shop page, which is now four lines
    and four truths.
  - **The price is the owner's, and the evidence points down, not up.** Our placeholder lifetime is
    $14.99. JindoBlu sells Remove Ads at **$6.99** against 413K ratings, with a brand, an install
    base and years of reviews. We have none of those. Asking more than double a proven price with
    nothing behind it is not a position we can hold. The recommendation when the owner sets real
    prices: lifetime at or under $6.99, and let the subscriptions sit above it rather than below.
- [x] **D4 The testing shelf (2026-09-20):** a "Still cooking" row for games that are out early
  and not finished. A game in it is playable and keeps nothing: no stats, no running score, and it
  can never be the daily, because the daily is the one board everybody gets that day. It replaces
  the "Coming soon" tiles, which were unplayable and, as it turned out, an empty list rendering
  nothing at all. The row is empty in a normal build and that is the point, so `?cooking=<id>`
  puts a game in it and the test plays that game to the end and proves the record stays empty.
  **A check that cannot answer its question is worse than none:** the first go at this was a
  precheck rule reading the registry as text to find cooking games in the daily rota, which cannot
  map a definition's variable name to a game id and would have passed forever. It is a runtime
  fallback in the shelf instead, next to the one that already catches a rota naming nothing.

## Stage 5: cover the field (decided 2026-09-20)
Both competitors' catalogues, and what neither of them has. [JindoBlu](https://apps.apple.com/us/app/2-player-games-offline-games/id1465731199) names Ping Pong, Spinner War, Air Hockey, Snakes, Pool, Tic Tac Toe, Penalty Kicks, Sumo, mini golf, racing cars, sword duels, chess, paint fight, archery, tug of war, whack a mole, memory, maths, solitaire and jigsaw. [Ponder Club](https://ponderclub.co) runs a mini crossword, a word search, a themed-grouping game, a word ladder, an anagram hunt, a Wordle-alike, a 2048-alike, a digit slider, sudoku, a minesweeper, a numbers-target game, flood-it, solitaire, mahjong solitaire and a code breaker. We already have 18 of those. These are the rest, named our own way ([03 §4](03-game-catalog.md#4-trademark-safe-naming)), three or four to a milestone.
- [x] **W1a Word Guess (2026-09-20):** 44 games, and the first word game. Six goes at a five-letter word, a coloured keyboard, a row that shakes when the word is not one we know, and the repeated-letter rule that most copies get wrong. Two public-domain lists: 2,332 answers, 8,585 words you may type. The secret comes from the seed, so it slots into the daily.
- [x] **W1b Word Search (2026-09-20):** 45 games. A themed square of letters with a list hidden in it, across, down and diagonally, and backwards too on the twelve by twelve. Three sizes from the table. Twelve themes written for us, so there is no dictionary to ship and the filler letters come from the theme's own words. A move is the line the finger drew, not the word it was after, so the rules read the grid and say what was found.
- **W1c Mini Crossword (5x5). Source decided 2026-09-20: a clue dictionary of our own, not puzzles.**
  Hand-writing whole puzzles caps the game at however many were written. Hand-writing one clue per
  word and generating the grids does not: the same three hundred words fill an unlimited number of
  5x5 grids, and the date can pick one. A permissive dictionary is no help here, because a
  dictionary definition is not a crossword clue. Split in two, because the words and the filler are
  a loop on their own:
  - [x] **W1c-i the words and the grid (2026-09-20):** 1,631 clues written here (216 of three
    letters, 582 of four, 833 of five), six block patterns and a backtracking filler. Nothing is
    registered as a game yet and nothing is exported from the rules barrel: this is the half that
    had to be right before a scene was worth writing. Two things were found by measuring rather
    than by looking: a crossing can finish a word the filler never chose, so every finished word is
    checked against the dictionary, not just the ones the filler picked; and a 5x5 with six
    five-letter words is beyond a clue dictionary, failing half the time and giving the same grid
    five times in forty seeds, so the patterns were picked by measurement. A puzzle now lays in
    about thirty milliseconds and forty seeds give thirty-four different grids.
  - [x] **W1c-ii the puzzle (2026-09-20):** 46 games, and W1 is done. Tapping the square you are
    already in turns the corner, the clue for the word you are in sits above the grid, typing runs
    on by itself, and wrong letters stay quiet until you press Check my letters, because being told
    straight away takes the puzzle away.
- **W2 Word more.** Three games, so three loops.
  - [x] **W2a Word Ladder (2026-09-20):** 47 games. Carroll's Doublets, 1877. Three lengths as
    levels, and the lists were measured before a line was written: three and four letters come from
    the crossword's clue dictionary (194 of 216 and 481 of 582 in one connected piece) and five
    from the Word Guess answers (1,207 of 2,332). The clue dictionary's own five-letter words are
    useless for this, 86 of 833, which is cheap to find out now and expensive later. No new word
    list: every word already ships for another game. Par is the real shortest, checked in the tests
    by a search that does not know what the generator claimed.
    **A random walk is not an easy bot.** The weak tiers first picked any rung at all and never
    arrived, so they now go by which word looks most like the target, which is how a person plays
    badly. A ladder can also be climbed into a corner where every neighbour is used up, so taking a
    rung back is a move in the rules, and the bots take it.
  - [x] **W2b Word Groups (2026-09-20):** 48 games. Twenty-four puzzles written here, and written
    is the point: a crossword's difficulty is in the grid, which a search can lay, while this
    game's difficulty is entirely in the traps, and no search writes a red herring on purpose. So
    the count is finite and said out loud. First draft had words appearing in two groups of the
    same board, which is not a trap but a mistake, since a trap is a word that only *looks* like it
    belongs elsewhere; the structure check caught all sixteen of them.
    **And it turned up a bug four games deep.** The bot played a deliberate wrong guess and
    `replay` refused it, because `legalMoves` listed only the right four. `replay` is the server
    referee, so anything `apply` takes and `legalMoves` leaves out is a move a person really makes
    and the server then will not verify. Word Guess had it and had shipped (ZONAL is a perfectly
    good guess and produced an unverifiable game), the crossword had it worst of all (only the
    right letter listed, when typing wrong ones is the game), and Word Search listed a line one way
    round. All four fixed, each with a test that fails on the old code, and the contract is now
    written into `GameState` and CLAUDE.md.
  - **Dominoes never put its tiles on the table (found 2026-09-21).** The first settled gallery shot
  showed a domino sitting on every player's name with the board empty and the scores already at 8
  and 7 points. Reading the scene got nowhere worth trusting, so the scene was made to report its
  chip band and the span of its tile sprites: every sprite measured at y=22, which is exactly the
  chip row. Every state change calls `sync`, and `sync` killed each tile's in-flight tween and
  started it again from where it had got to, so when play was quick a tile never finished the 260ms
  journey from the player's chip to the board. It now only starts a new journey when the
  destination has actually changed. Worst in the fast builds, which is why the gallery is where it
  showed up, but wrong at any speed.
- **Thirty-four scenes answer no question about themselves (noted 2026-09-21).** Dominoes was
  broken since it shipped and nothing caught it, because the game runs, finishes, logs nothing and
  fits every screen; the tiles were simply in the wrong place. The scenes that do answer something
  (`labelCheck`, `handCheck`, `tileCheck`, `layoutCheck`, `boardCheck`) are the card games and the
  ones built this week. The other thirty-four are unchecked, and the ones with pieces that travel
  are where the next Dominoes is. Worth a milestone of its own rather than a line here.
- **Snakes & Ladders: the board fell behind the score line without limit (2026-09-21).** Two real
  bugs in one picture, once the shot was settled properly. The board walks a token a square at a
  time and rolls do not wait for the walk, so with quick play the queue grew without bound and the
  board was arbitrarily far behind: forty-seven squares, in the shot that caught it. It now jumps
  to the truth once it is more than three moves behind, because a board that jumps is better than
  a board that is wrong. And the status line named the wrong players: `moved.slice(-2)` takes the
  last two *by seat*, so a four-player game always said Yellow and Blue however far behind they
  were and never named the leader. It sorts by square now. The scene answers `boardCheck()` with
  how far behind it has settled.
- **One quiet moment is not the end of the motion (2026-09-21).** The settle added yesterday waits
  for the scene's tweens to empty, which is not the same as the movement being over: a token walks
  its squares as a chain of short hops, and there is a still instant between every one of them.
  Snakes & Ladders was caught in one, with the board showing tokens at the start while the status
  line had them at 19 and 23. It now wants two quiet samples a beat apart. The first version of a
  check is usually the part of the problem I had already thought of.
- **The gallery now settles before it shoots (2026-09-20).** Reviewing the older games' pictures,
  Dominoes appeared to draw tiles across the players' names and Rummy to show a seat with a card
  count and no cards. Both turned out to be unjudgeable rather than wrong: the shot is taken at a
  fixed 3,500ms, and a domino halfway from a player's chip to the table is pixel-identical to a
  domino drawn on top of a player's name. Rather than guess, or worse "fix" a shipped game on that
  evidence, the gallery now waits for the scene's tweens to finish first, with a cap for the
  real-time games that never settle. The visual audit of the older games waits for pictures worth
  judging.
- **The gallery caught the same mistake three times (2026-09-20).** The full matrix went green on
  eight screen types and the Android emulator, and then the pictures showed Word Groups printing
  "All four." across the last group bar, Anagram Hunt printing its count straight through the list
  of finds, and Word Ladder leaving an empty input row after the game was over. Word Guess had done
  the same thing that morning. Four scenes, one mistake: a status line placed at a computed `y`
  with no band reserved for it. Every word scene now answers `layoutCheck()` with the bands it
  draws in, and one spec fails when any two overlap. Proven against the shipped numbers: Word
  Groups had the board ending at 354 and the banner starting at 348, Anagram Hunt had the banner
  running to 248 and the list starting at 234.
- [x] **W2c Anagram Hunt (2026-09-20):** 49 games, and W2 is done. Seven letters, words of three
    or more hiding in them, one using all seven. Seven because six is not a game, and that was
    measured before building: against the words we already ship, a five-letter base hides a median
    of three findable words, six hides six, seven hides fifteen. A five-letter base left more than
    half of all bases with fewer than four words in them.
    Seven-letter words were the one thing our lists did not have, so 618 were written and the 440
    that hide at least eight known words were kept; the test re-derives that property rather than
    trusting the filter. What counts as a word is the clue dictionary plus the word search themes,
    1,727 words people know, so nothing obscure is ever needed to clear a puzzle.
- **N1 Numbers.** Three games, so three loops, and not in the order they were listed.
  - [x] **N1a Target Number (2026-09-20):** 50 games. Six numbers, four operations, a target from
    101 to 999, no fractions and nothing below zero. Every round is solvable exactly, checked when
    it is laid and checked again in the tests by a solver that does not know what the generator
    claimed. Measured first: 55 of 60 random draws are exactly solvable and the worst solve is
    104ms, so guaranteeing it costs almost nothing.
    The band check written an hour earlier caught this scene before it shipped: the operations
    ended at 464 and the line under them started at 436.
  - [x] **N1b Quick Maths (2026-09-20):** 51 games, and the first new duel in a while. A real-time
    game like Reflex Race, not a turn-based one, because both players are live at once. The sums
    get harder with the round, so there are no levels to pick and nothing to set up. A wrong answer
    locks that player out of the question, because without a cost the best play is to hit all four
    buttons, which is not a game. The band check caught the score sitting on the bottom-left answer
    before it ran.
  - [ ] **N1c Digit Shift:** moved to last on purpose. "A digit slider" is one line of a
    competitor's list, and the two obvious readings of it are a 2048 reskin and a Sliding Puzzle
    reskin, both of which we already ship. Rule: each game must clearly be its own game. This one
    does not get built until there is a design that is not one of those two, and inventing that is
    a loop of its own rather than a rushed third of this one.
- **Yatzy's score card was cutting its own row names off (2026-09-21).** "Two p...", "Bonus ...",
  and every label past Sixes is long enough to lose its ending on a phone: the name column was 38%
  of the width with `text-overflow: ellipsis`, against fifteen rows and four columns of scores.
  Names wrap now, and break when a word cannot fit at all. The layout spec asks the page whether
  any name is wider than the cell holding it, which the DOM knows exactly and a screenshot only
  hints at.
  **The first fix was half a fix, and the check said so.** Removing the ellipsis stopped the names
  being cut off and started them spilling across the scores instead, which is not an improvement.
  The iPhone passed and the desktop failed, because a landscape screen puts the whole card in a
  220px column: the phone was never the hard case.
  **The gap it came through:** the spec checks that `.board` fits and that nothing scrolls
  sideways, and a game's own controls are HTML *below* the board, so nothing was looking at them.
  Every game's text is now checked against the box holding it, and across all fifty-one it came
  back clean: Yatzy was the only one.
  **And the height was measured rather than guessed at.** Sixteen games run 1.03x to 1.14x past
  the bottom of the screen, which is a footer and some margins and is the house style; Yatzy ran
  1.58x on a desktop window and 1.81x on a phone. So the card scrolls inside itself now, which
  also keeps the dice on screen while you hunt for a box, and the check is drawn at 1.2x: loose
  enough not to fail on the ordinary overshoot, tight enough to catch the next Yatzy. Tightening
  that ordinary 1.1x is real work and should be done on purpose, not smuggled in as a threshold.
- [x] **Q2 The board takes the space that is left, not a fixed slice of it (2026-09-21).** Sixteen games
  run 1.03x to 1.14x past the bottom of the screen. Measured, and it is arithmetic rather than a
  mystery, on a 664px phone viewport:

  | | |
  |---|---|
  | screen padding | 36 |
  | topbar | 56 |
  | gap | 18 |
  | status pill | 44 |
  | gap | 18 |
  | board at `max-height: 64vh` | 425 |
  | gap | 18 |
  | **chrome plus board** | **615 of 664** |

  That leaves 49px, and a controls row is 48 to 66px. So any game with controls tips just over,
  which is exactly the 1.03x to 1.14x band, and no game with a bare board is in the list.
  The fix is not a smaller number: it is `.board` taking the height that is left (`flex: 1`,
  `min-height: 0`) inside a game screen that is one viewport tall, so it shrinks to fit instead of
  claiming 64% whatever else is there. **Why it is a milestone and not a line in this loop:**
  `.screen` is shared with the home shelf, which is a long scrolling list and must not be pinned
  to one viewport, so the change is scoped to `.game-screen`. The game screen is one viewport
  tall, the play area takes what the topbar leaves, and the board shrinks inside it. `min-height:
  0` is the part that does the work, because a flex item will not shrink below its content and
  the content here is a canvas. The board is allowed to shrink but not grow, so it never sprawls
  past its aspect ratio, and `max-height: 64vh` stays as a cap for tall screens.
  The height check is back at 1.02x, which is what the rule in CLAUDE.md actually says. Verified
  by the measurement that found it and by the gallery, because a board that fits and a board that
  looks right are two different claims.
- **The gallery could not see nine games at all (2026-09-21).** Sea Battle drew two empty grids
  under a line reading "Red to fire. 4 of their ships left", which looked like a serious bug and
  was the game working exactly as written: with bots in every seat there is no person whose view
  to show, so it showed none. Every hidden-hand card game does the same thing more quietly, and
  the gallery has been photographing rows of face-down cards for as long as it has existed.
  Privacy with nobody to hide from is just a blank screen, so a table with no people now shows
  everything. Real play always has at least one person, so nothing a player would notice changed.
- **Go Fish ran its seat names into each other (2026-09-21).** "Nova: 4 · 3 books Pip: 5 · 2
  books" with no gap anywhere: four labels spread evenly across a 760px table gives each 152px,
  and the text wants nearer 190. On the table, clear of every card, and unreadable. Names sit over
  their counts now, on two lines and a size smaller when there are four players.
  `labelReport` gained a third list, `touching`, because it knew about labels off the table and
  labels on cards but not about labels on each other, and Go Fish had no `labelCheck` at all. It
  has one now and is in `labels.spec.ts` with the other five.
  **And it immediately caught the fix**: two lines are twice as tall, so a label centred at 40
  reached 63 while the seat cards start at 56. Moved up to 26. The first list caught the original
  bug and the second caught my repair of it, in the same run.
- **Spades never said who was partnered with whom (2026-09-21).** The scoreboard read "Blue 71 ·
  Red -60" over four seats named Nova, Pip, Zed and Bo, and the result said "Blue wins" with
  nothing on screen tying a name to a side. In a partnership game that is the one thing the board
  has to say. Every seat label now carries its side and is coloured by it, the way Ludo's status
  line has always read "Pip (Green) is thinking".
  **The first version of this was a new line under the scoreboard, and it would have landed on the
  top seat's label at y=78.** Caught by checking before pushing rather than by a screenshot after,
  which is the first time today that has happened.
- **Hearts called the winner by a name that was nowhere on the table (2026-09-21).** The result
  read "Yellow wins with 0" over a board labelled Nova, Pip, Zed and Bo, and the status line said
  "Hearts broken · Yellow lowest" while the scene's own shout said "Nova takes 2". Two naming
  schemes in one game, and nothing on screen tying them together. The cause is the contract:
  `status` and `resultText` were handed the state and nothing else, so they could only reach the
  colour list, while the scene has the session and uses the seat labels. Both callbacks now get
  the seat names as well. Ludo had it right all along and is the model: "Pip (Green) is thinking",
  which says who and which colour at once.
- **Quick Maths, looked at rather than tested (2026-09-21).** Two things a passing suite had
  nothing to say about. Between questions the four answer pads were drawn empty, which reads as
  something that failed to render rather than a game waiting for the next sum, so they are not
  drawn at all until there is something to answer. And the sum is written twice, once the right
  way up for each player, which is right with two people and silly against a bot: there is nobody
  on the other side of the phone, so it was the same words printed twice in the middle. One copy
  now unless a person is sitting there.
- **Answered: I misread the Ultimate board (2026-09-21).** The glow and the status line agree,
  on both engines. The top-middle board I was sure was lit was not the one lit, and boards 1 and 5
  in a nine-board grid are easier to confuse in a screenshot than they look. Fifth picture today
  that was fine. The check stays and now counts its comparisons, because it skips any moment when
  the player may go anywhere, and a run that skipped all eight looks would have passed having
  compared nothing.
- **Answered: the Callbreak card was innocent (2026-09-21).** The census came back green on both
  engines, so the face-down card at an empty seat was the last trick sitting where it was won,
  counted in `state.trick` like every other card. Fourth time today a picture looked wrong and the
  game was right, and the first time I asked before deciding. The check stays: it says what the
  scene draws against what the rules hold, which is worth having in every card game.
- **Open question: one face-down card in Callbreak (2026-09-21).** The settled end-of-game shot
  shows a single card back at Pip's side of the table with every hand empty. Other seats' hands
  are drawn face-down near their trick spot, so a card there means a card still in a hand after
  the last trick, which should not happen. It could equally be the last trick gathering, or a
  sprite left behind, which is the Dominoes shape. **Not filed as a bug**, because every time
  today I have decided what a picture meant without measuring I have been wrong: mid-animation
  twice, a settle landing in a gap between hops, and nine games that were hiding themselves on
  purpose. The way to answer it is a check that says where every one of the fifty-two cards is,
  which is worth having for all the card games and is a loop of its own.
- [x] **Q3 A fanned card shows enough of itself to be read (2026-09-21).** Solitaire, FreeCell and
  Spider fan a column so each card shows one strip: its own top edge down to where the next card
  starts. The corner index has to fit in that strip. It did not, in any of the three, even before
  any squeeze: the check came back 38, 36 and 30 against an index reaching about 55, so the suit
  was cut off on every covered card in every column, always. In Spider a run has to be all one
  suit, so the one thing you have to read was the one thing missing. Every game still played and
  finished, which is why nothing had ever said a word; the gallery showed it.
  Rank over suit needs about 55 units and no fan can afford that, so the index now runs along the
  top of the card, rank then suit. That brings it to about 34, which all three existing steps
  already clear, so nothing grew and no column got shorter. Ten gets a smaller rank so the glyphs
  do not meet.
  The squeeze was the other half of it. It shrank face-down and face-up steps by one factor,
  spending scarce room equally on cards that say nothing and cards you have to read. Face-down
  cards give up their space first now, down to a sliver, and a face-up card loses part of its
  index only after that is gone. FreeCell has nothing face down and just gets a floor.
  The layout declares what it will leave (`indexStep`) and the check measures the real text
  against it, so the number cannot drift away from the card face in silence. Proven red first, on
  both engines, before any of it was fixed.
  - **The fix had a cost in the other direction, measured rather than guessed.** A hand fans
    sideways, so a card there shows the strip from its left edge to the next card, and a wider
    index clips *there* instead. Laying rank beside suit took the index from 0.33 of a card's
    width to 0.455, which moves the hand size at which a suit disappears from about 24 cards down
    to about 18. Tightening the glyphs brought it back to 0.41, or about 20 cards. Hearts, Spades
    and Callbreak deal 13, Rummy and Gin peak near 14, so none of them can reach it. Only Old Maid
    does, dealing 26 to each of two players, and Old Maid already clipped before any of this and is
    played on rank alone. The real answer for a hand too wide to fan is to shrink its cards rather
    than overlap them further, which is a milestone and not a patch.
  - **Pyramid is the counter-example that makes the finding specific:** it overlaps cards from
    below, so every top-left index stays visible. This was never a card problem, it was a
    column problem, and only three games have columns.
  - **Two questions this sweep raised and did not answer.** War shows "15 to 37" in the pill while
    the labels beside the decks read "Pip: 36" and "Nova: 16": both read the same `state.counts`
    with no cache between them, so the likeliest cause is a one-frame skew between the canvas and
    the DOM in a composited screenshot, which no player would see. Colour Sort ends with its tubes
    at different sizes and seemingly off-centre, which matches completed tubes running a finish
    animation. Neither is filed, because both are exactly the kind of picture that has been wrong
    every time today. Both are worth a check of their own: "the pill and the labels agree once
    the board is settled", and "the tubes are one size and centred once the board is settled".

- [x] **Q4 The board finishes the move before the sheet says how it ended (2026-09-22).** `GameScreen` renders
  the result sheet the moment `state.result` is set, and the board is still animating the move
  that caused it. Four in a Row says "Nova (Yellow) wins!" with the winning disc still in the air,
  one row above the gap it is falling into. Every game that settles a move has this: the falling
  disc, the flying domino, the walking token, the sliding tile, the pouring tube. The reveal is
  given away before it happens.
  The same missing signal weakens the gallery. `settle()` waits for tweens to go quiet, but Four
  in a Row drops its disc with gravity in `update()` and never tweens at all, so settle sees a
  still scene and photographs a disc in mid-air. Every real-time scene is in the same position:
  air hockey, ping pong, both snakes, sumo, tug of war, penalty kicks.
  One mechanism answers both: an optional `busy()` a scene can offer, meaning "I am still showing
  the last move". The sheet waits for it, capped at something like 1.2s so a stuck scene can never
  swallow the result, and the gallery waits for it too. Worth doing before the store screenshots,
  because a screenshot of a half-finished move is not a screenshot of the game.
  - **Verified, and half-verified (2026-09-22).** The milestone-end matrix went green on all eight
    engines and produced the gallery. Four in a Row proves the sheet half: the winning four sits
    on the board, highlighted, with nothing in the air, where the same shot used to catch a disc
    mid-fall under a sheet that had already named the winner.
    The picture half was still wrong and not for the reason written below. War's pill read
    "19 to 33" beside a label reading "Nova: 20" with two animation frames already being waited
    for, so the canvas is not lagging the DOM: the game is simply still being played. A move lands
    between settle returning and the shot being taken, the line redraws at once, the canvas waits
    for its frame, and the picture catches the gap. No number of frames fixes a thing that keeps
    moving. The gallery now waits for a quiet window instead, reading the move count either side
    of the frames it is about to photograph and trying again if it moved.
    That fix is **not yet seen working**: the gallery only runs under `@full`, which a push skips,
    and a second eight-engine dispatch to re-check one screenshot is not worth about two hundred
    CI minutes when the Monday weekly run does it for nothing. Nothing downstream is waiting on it.
    Worth naming the pattern: this is the Yatzy shout mistake in different clothes. Both times the
    measurement went where it was convenient rather than where the thing happens, and both times
    the convenient version looked rigorous enough to trust.
  - **A third symptom, and the one that reaches the store.** The status line is HTML and the board
    is canvas, and a screenshot composites both. Twice today a picture showed them one move apart:
    War's pill read "15 to 37" beside labels reading 36 and 16, and Ultimate's line named the
    middle-right board while the top-middle one glowed. Both pairs are written from the same field
    in the same pass, so neither can disagree in the app; what disagrees is the canvas frame
    against the DOM paint, sixteen milliseconds no player will ever see. The gallery will
    photograph it, and per M12 these pictures become the store screenshots, so a listing could
    show a caption that contradicts its own board. The capture has to wait for a canvas frame
    after the last state change, not just for the tweens to go quiet.

- [x] **Q5 A message never sits on the thing it is about (2026-09-22).** Four word scenes printed their status
  line through their own content and were fixed with `layoutCheck`. The same fault is spread
  through the games that shout: Dominoes centres its banner in the tile area and centres the tile
  rows there too, so with an odd number of rows "Red goes out: +14" is read through the pips
  (given a plate to sit on for now, because no band inside that table is free); Yatzy's shout
  shares `REST_Y` with the resting dice; Old Maid's "Pairs down" line runs behind the last card;
  Go Fish draws its message under the cards, in the lane they travel; Tug of War puts "Ready..."
  on the centre flag. None of these has a check, because `layoutCheck` was only ever given to the
  word games. The question is the same one for all of them and so is the answer: say where the
  bands are, and let nothing land on a band that carries meaning.
  - **Two of the five were real; the other three were cards in the air (2026-09-22).** Checked at
    rest, which is the only state worth asking about, because a piece crossing a message on its
    way somewhere is the animation working. Dominoes centres its rows in the same band it centres
    its banner in, so an odd number of rows puts the round-end line through the pips every time:
    real, and given a plate because no band in that table is ever free. Yatzy's shout went at
    REST_Y with the dice: real, and moved under them, because there a free band exists and a
    message should not cover what it is about when it does not have to. Old Maid's banner sits at
    336 against an offered card spanning 193 to 306, and Go Fish's at 247 against a pool spanning
    273 to 386; both are clear, and the pictures that accused them had a card in flight. Mapping
    the Go Fish shot back to scene coordinates put the offending card at 169 to 259, nowhere near
    where a pool card rests. Tug of War covers its centre marker only while the marker is at the
    centre and nothing has happened yet.
  - **The Yatzy check passed before it failed, and that is the lesson (2026-09-22).** The first
    version asked from outside every 250ms and came back green on both engines. The window is a
    sliver: the shout lingers over a second while the next roll lifts the dice above the tray
    within a few hundred milliseconds, so a poll sees plenty of shouts and almost never one with
    the dice at rest. A guard that only insisted on seeing a shout was satisfied entirely by the
    harmless ones. Moved into the scene, recorded at the instant the shout is said, it failed
    immediately and printed the numbers. Proving a check red is not enough on its own if the
    check is sampling: it has to sample where the thing happens.
  - **A wording nit found in the same sweep, deliberately not fixed blind.** Spades' team header
    reads "Red 44 (8/4, 4 bags)", which is won-over-bid and reads naturally as bid-over-won: as
    "bid 8, won 4" it would be a hand set by four, not a 44-point one. The seat lines under it
    already say "bid 3 · won 5" and are perfectly clear. Every unambiguous rewording is longer,
    the line already carries two teams across 800 units, and whether it still fits is a thing to
    measure rather than guess, so it belongs with whoever can see the render.

- [x] **Q1 Every scene answers for itself (2026-09-22).** Dominoes and Snakes & Ladders were both broken from
  the day they shipped, both invisible to a green pipeline, and both found by looking at a picture.
  Thirty-four scenes still answer no question about themselves. The ones with pieces that travel
  are the risk, because the failure is always the same: an animation that cannot keep up with the
  speed of play, drifting while every test passes. Give each of them the smallest true question
  (`boardCheck()` is usually "is what I am drawing what the state says", `layoutCheck()` is "is
  anything on top of anything"), a few games to a loop, highest risk first: Ludo, Backgammon,
  Solitaire, Spider, FreeCell, Pyramid, TriPeaks, War, Memory, Checkers, Four in a Row. Audited by
  eye so far and clean: Ludo, Backgammon, Rummy, and the seven built this week.
  - [x] **Closed, and smaller than its own description said (2026-09-22).** "Thirty-four scenes
    answer nothing" counted scenes rather than risk. The drift class only exists where a scene
    keeps persistent pieces keyed to a board: Chess and Backgammon redraw every piece from the
    state on each change and keep no per-piece view, so they cannot drift and a check there would
    compare the state with itself, which is the vacuous kind. Tic-Tac-Toe, Four in a Row, Dots &
    Boxes and both snakes are the same. Sudoku's notes and Dots & Boxes' initials destroy and
    rebuild their entry wholesale rather than walking a copy. The real-time games keep sprites,
    but the sprite is the state and has nothing to disagree with. That left seven: Pyramid,
    TriPeaks, Checkers, Ludo, Memory, War and Reversi, all of which now answer.
    **One real bug, in Checkers, and it was a bad one.** The piece map is keyed by square and only
    re-keyed when a move lands, so a move arriving while the last was still hopping looked up a
    piece still recorded on the square it had left, found nothing, and returned without drawing
    anything. Not queued, not retried: dropped, with the board a move behind the rules for the
    rest of the game. Bots at speed do it readily and two people tapping quickly would too. A move
    in the air is finished immediately now when the next arrives.
    **Reversi needed a change to be answerable at all**: a disc's colour lived only in its
    Graphics, so the scene could not say which way it had painted one. It records that now,
    because a flip that never landed is the fault worth catching and presence alone sails past it.
    **The question had to change too.** Asking whether the board matches at every instant failed
    five games at once, TriPeaks among them on a run where nothing about TriPeaks had changed: at
    speed the animations chain end to end, so a sample almost always lands inside one and a piece
    in flight is not a piece in the wrong place. I tried to carve the flights out with busy flags
    and tween lists and kept meeting another mechanism that appeared in neither. Convergence
    separates them cleanly and needs to know nothing about how a scene animates: a dropped move
    never catches up, a flying one catches up a few hundred milliseconds later.
    **Four of my own checks were wrong before the game ever was**, each a shape or a unit I
    assumed instead of read: counter tweens that move a piece without appearing against it, a
    scene list briefly empty after the canvas appears, a board that stores discs where I compared
    seats, and a Memory board already swept clean before the first look. All four were found by
    making the test report what it saw, and I reached for that two guesses too late every time.
  - [x] **Nineteen games say what can never happen to them (2026-09-22).** Cheaper than a scene
    check and a different question: not "is the board drawing the state" but "can the state itself
    be wrong". Pure rules, so precheck runs them on the spot and none of it costs a CI minute.
    Conservation for Solitaire, Old Maid, Hearts, Spades, Callbreak, Rummy, Dominoes and Colour
    Sort, joining Spider, War and Mancala. Gravity for Four in a Row, which is the one that
    started it: a picture showed a disc hanging over two empty cells and only the state could ever
    say whether that is true of the game rather than of one frame. A disc adds one and lifts none in
    Reversi; neither side gets a piece back in Checkers; four tokens a player in Ludo; a permutation
    that stays solvable after every slide in Sliding Puzzle; powers of two in 2048.
    **Three came back red and all three were the test, not the rules.** Hearts counted 55 because
    `passing` holds cards still sitting in their owner's hand. Old Maid counted 9 because `pairs`
    counts pairs rather than listing cards, so I was summing integers as card ids. Dominoes threw
    because I had the arguments the wrong way round. Each took seconds to find because there was
    no browser between the question and the answer.
    Then five more: Ultimate never changes a mark or un-wins a small board, Sudoku never lets a
    given change or moves the solution underneath the player, Sea Battle keeps both fleets still
    and never lets a fired square change its mind, Chess always has both kings and never gains a
    piece, Memory pairs every symbol and never takes a card back. Five of the nineteen tests were
    wrong on first write, all five mine misreading a field: `passing` holds cards still in a hand,
    `pairs` counts rather than lists, `shots` is a square per cell rather than a list of shots,
    and twice I had an argument order or a size type wrong. **That ratio is the argument for this
    layer.** A quarter of first drafts misread the state, every one cost seconds, and the same
    misreadings arriving through a screenshot earlier in the same loop cost the better part of an
    hour each and twice pointed at the wrong fix.
  - [x] **Seven more scenes answer, and all fifty-one were looked at (2026-09-21).** A full pass
    over the gallery, one game at a time. New checks: `fanCheck()` on Solitaire, FreeCell and
    Spider (is a covered card readable), `boardCheck()` on Sliding Puzzle and Colour Sort (is
    every piece its proper size, in its proper place), `handCheck()` extended on Crazy Eights
    (every card in hand is placed or on its way, and one that is neither is lost), and a check
    that a result names somebody at this table, covering Old Maid and Shut the Box against the
    running score. The rules also gained a seed-conservation invariant for Mancala, which is not
    a scene check but was worth having once the question came up.
    **Looked at and found correct**, with the arithmetic checked by hand where there was any:
    Sudoku (all 27 groups), Mini Crossword (all ten entries and the numbering), Word Search (all
    six words), Word Ladder, Word Guess, Anagram Hunt, Word Groups, Target Number, Quick Maths,
    Hearts (a shot moon, scored right), Spades (bids, tricks and bags all reconcile), Callbreak
    (every call and its 0.1s), Gin Rummy (a legal knock with three deadwood), Rummy, Go Fish,
    TriPeaks, Pyramid, 2048, Chess, Checkers, Reversi, Ludo, Backgammon, Sea Battle, Dots & Boxes,
    Memory, Echo, Tic-Tac-Toe, Snakes & Ladders, Yatzy, Mancala, Dominoes, Classic Snake, Snake
    Battle, Penalty Kicks, Air Hockey, Ping Pong, Sumo, Tug of War, Reflex Race, Colour Sort,
    Sliding Puzzle, War, Old Maid, Crazy Eights, Spider, Solitaire, FreeCell, Ultimate.
    **Seven looked wrong and were not**, each checked in the code before being written off:
    Pyramid's part-cleared triangle, Mancala's forty-two missing seeds (the end sweep mid-hop),
    Yatzy's single die (four still falling), War's off-by-one, Ultimate's board (a frame skew),
    Quick Maths' unflipped text (no people to face), and Four in a Row's floating disc (a
    physics drop, caught in the air). That is seven out of seven where the picture alone would
    have sent me the wrong way.
  - [x] **The whole class swept, not sampled (2026-09-21).** The bug is not "things move", it is
    "the scene keeps its own idea of where things are", and that is a grep rather than a gallery
    review. Every scene in all fifty-one games, sorted:
    - **Drains a queue of events one at a time** (unbounded lag, the actual bug): Snakes & Ladders
      and Shut the Box. Both fixed, both answer `boardCheck()`, one test covers them.
    - **Keeps a copy of the board and walks it**: Mancala only. I wrote it down as safe and the
      check I added to say so failed instead, three seeds out. Nothing stopped two sowings
      overlapping, and the first to finish snapped the board to the state and cleared `busy` while
      the second was still in the air, so its remaining hops counted seeds onto an already-correct
      board. Every callback checks its era now, same as the other two. That is three of the three
      scenes with this shape broken, which is a better answer than "two of three".
    - **Keeps a counter or a record of what it drew last**: Four in a Row, Tic-Tac-Toe, Ultimate,
      Sudoku, Anagram Hunt. Not mirrors, nothing to drift.
    - **Draws straight from the state**: everything else, Ludo and Backgammon included, which is
      why both looked right.
  - [x] **Shut the Box (2026-09-21).** Found by looking for the shape rather than at more pictures:
    only two scenes drain a queue of events one at a time, and the other one was Snakes & Ladders.
    Same unbounded lag, same fix, same `boardCheck()`, and one test now covers both. Ludo looked
    like the same risk and is not: it draws every token straight from the state, which is why it
    cannot drift and why its picture was clean.
- [x] **P1 Puzzles (2026-09-23):** Sweeper, Flood, Tile Match, Jigsaw, 55 games. Green on all eight screen
  types with every game played to the end (run 35900834113), and the four looked at in its iPhone gallery.
  **Starting a manual run on `main` cancels the push run in progress** (they share a concurrency group),
  and only a push deploys: the first try at this run cancelled the deploy of the last two fixes, and the
  push run had to be re-run before the full one could start. Split one game to a loop, the way the word
  games were:
  - [x] **P1a Sweeper (2026-09-23):** 52 games. Mines under a grid, numbers counting the neighbours, and a
    board that never needs a guess. The mines are laid on the first tap, from the seed and that square, and
    a board is kept only when simple deduction from the open numbers alone clears it; that was measured
    first (under 1ms a board on average, 30 redraws at worst on Hard) so it could be built at all. The bot
    proves every move, and a test plays 75 boards with a random source that throws, so any guess fails it.
    Three sizes, dig or flag by tap, long press or the Dig/Flag switch, chording on an open number,
    keyboard arrows + Enter + F. It came with a fix for every one-player game: the vs Bot / Friends / Solo
    row was set `hidden`, and `.quick-starts { display: flex }` beat the attribute, so solo games showed
    three buttons that did nothing. A global `[hidden] { display: none !important }` settles it for good;
    checked live on Sweeper (row hidden) and Chess (row shown).
  - [x] **P1b Flood (2026-09-23):** 53 games. Fill the board from a corner in one colour within a move
    limit, and a two-player duel from opposite corners where you cannot pick your own colour or the other
    side's. The limit is our solver's count plus 4, 3 or 2 spare moves, so every board can be won; the
    solver takes any colour it can finish off, otherwise the one that brings the farthest patch nearest
    (Tatham's rule), and was measured first: 23.1 moves on 14 by 14 against the classic app's 25, in half
    a millisecond. Your patch is drawn flat and joined, free squares as raised tiles, and the flood runs
    as a wave from your corner. Checked live on both modes: a solo win, a duel lost 48 to 51 to a Medium
    bot, and the rematch turning the board so the person in the second seat sits at the bottom. The moon
    that marks the second corner first shipped as a white disc with an ink bite and read as an eye; it is
    cut as a real crescent now. Two type errors reached CI (a `0 | -1` array, Phaser's `fillPoints`
    wanting its own vector type), because typecheck cannot run on this machine.
  - [x] **P1c Tile Match (2026-09-23):** 54 games. Built as the triple-tray genre, not free pairs: take a
    free tile into a tray of seven, three alike pop, seven without a three loses. Matching free pairs off a
    stack is Mahjong solitaire, which has its own line in the catalogue, so building pairs would have been
    the reskin this line said to avoid. Pictures are dealt along a real way of taking the pile apart, so
    every board can be cleared, and a greedy player that never looks underneath wins 95% of Easy, 79% of
    Medium and 56% of Hard, which is the difficulty curve. Three undos a game. Asking every upper tile to
    rest on all four below was tried first and left boards a layer short; resting on two is what the real
    games do. Played live: a Hard board lost with 62 tiles left, one undo used. That run found a real gap:
    the scene said it was done while a tile was still in the air, because Phaser's tweens smooth over lag
    and the scene clock does not, so on a hidden or slow page the result could come up over a flying tile.
    `busy()` now counts tiles in flight.
  - [x] **P1d Jigsaw (2026-09-23):** 55 games. Eight pictures drawn by us as SVG (a beach, a house, balloons,
    a rocket, a fish bowl, a farm, a city at night, a snowman), each drawn once and every piece cut out of it
    on a canvas along its own knobbed outline, so the pieces fit because they come from one drawing along
    one set of lines. 12, 20 or 35 pieces; drag a piece and it snaps in near its place, or tap it and tap
    where it goes; Edges first steps the middle pieces back. The snowman's lower third was plain white snow
    on the first draw, which is a row of pieces nobody could place, so it got a sled and snow shadows before
    shipping. The SVG is loaded from a blob rather than a data URL (some browsers taint a canvas for a data
    URL, and WebGL will not take a tainted canvas) and waited for with `onload`, not `decode()`, which
    Safari has refused for SVG. Played live: one piece dragged in, one tapped in, a wrong drop sent back,
    the rest finished to "Done! The whole picture." One unused pair of parameters reached CI.
- [x] **U1 Duels A (2026-09-24):** Pool, Mini Golf, Archery. Green on all eight screen types with every game
  played to the end (run 35919138247), and the three looked at in its gallery. Split one game to a loop (2026-09-23), because each is a
  physics game of its own. All three are turn-based shots rather than real-time: a move is an aim and a
  power, and the rules run a fixed-step simulation from it, so the server referee can replay a game the
  same way `replay` does for every other game. That only holds if the simulation uses nothing but
  arithmetic and `Math.sqrt`, which are exact in every engine; `Math.sin` and `Math.cos` are not
  guaranteed to agree between engines, so aims are points to shoot at, not angles.
  - [x] **U1a Pool (2026-09-24):** 56 games. Eight-ball, WPA rules with the phone simplifications (8 on
    the break spotted, ball in hand anywhere after a foul), on a table held upright. Each shot is played
    out by a fixed-step simulation in the rules and the scene plays its frames back, so what you see is
    what a referee would replay. A shot is a direction and a power, millions of them, so Pool is the first
    game where the state answers `allows(move)` and `legalMoves` is a spread; `moveFor` / `isLegalMove`
    look a move up wherever one arrives. The name was `accepts` until CI showed FreeCell already has a
    private `accepts` meaning something else; with a matching signature the helpers would have trusted it
    silently. Found live and fixed before ticking: a 9-foot table left the balls 11 points across on a
    phone, so it is a 7-foot bar table; and a straight break barely opened the rack, because contacts
    were resolved once in ball-number order, so the same break spread 307 to 776mm depending on which
    numbered ball sat where. Contacts now settle in passes. A scene can hold the bots until its last move
    has finished showing (`session.holdBots`), and a shot rests 450ms before the next.
  - [x] **U1b Mini Golf (2026-09-24):** 57 games. Nine holes of our own as data (walls, blocks, a slope,
    sand, water, a bowl), three or nine at the table, 1 to 4 players taking each hole in turn; water costs
    a stroke and puts the ball back, six strokes and you pick up with seven. Strokes roll out in the rules
    the same arithmetic-only way as Pool, and a test has the expert bot hole every hole within par plus
    two. Pull back and let go to hit. Played live: a nine-hole round to "Round done in 31, par 23". Each
    hole is now fitted to the screen, because the first draw used the scale of the whole course box and
    a narrow hole came out as a strip. Pool and Mini Golf left the drift check: they set every ball from
    the rules when a shot ends, so they hold nothing that could drift, and under autoplay they were never
    idle long enough to answer.
  - [x] **U1c Archery (2026-09-24):** 58 games. Three ends of three arrows, 1 to 4 players an arrow at a
    time, 30, 50 or 70 metres. Each arrow's wind comes from the seed and carries it by an amount that grows
    with the range; the sight sways in the scene, steadying for a second and then tiring, and the move is
    only where the sight was on release, so the rules add nothing random and a match replays. Bots read a
    share of the wind and shake by tier, measured at about 7, 8.4, 9.1 and 9.7 an arrow. The first tiers
    were far too good (Expert shot a perfect 1800 over 20 matches). The gallery showed the score pop as dark
    gold on the gold ring, all but invisible, so pops are ink with a white edge.
- [x] **U2 Duels B (2026-09-24):** Sword Duel, Spinner War, Racing. Every duel played to the end on all eight
  screen types (run 35926301034); the one red there was the fits-the-screen test, which walks every game in
  one test and ran out of its flat 300 seconds at 65 games on the slow Android engine, so it now gets eight
  seconds a game. Split one game to a loop (2026-09-24). These three
  are real time, like Sumo and Air Hockey: a pure fixed-step `step` in the rules, the scene feeding it
  inputs, bots as input functions with a reaction delay.
  - [x] **U2a Spinner War (2026-09-24):** 59 games. Tops in a bowl that pulls them together, a lip that turns
    slow tops back, spin that runs down on its own and faster in hard clashes (the slower top losing more),
    and a dash that costs spin. A ring out is 2, a spin finish 1, first to 3. Tuned by measuring bot rounds:
    the first draft's rounds lasted 4 seconds and all ended by ring out; without a lip, and with bots
    dashing every 0.7 seconds, nothing else could happen. Rounds now run about 18 seconds, most by spin
    finish. A double spin-out in the same step went to the second seat every time, so mirror matches were
    won by seat 1 ten times out of ten; it now compares spin before the step, or goes again with no points.
  - [x] **U2b Racing (2026-09-24):** 60 games. Two cars that drive themselves, one thumb each to steer, three
    laps round one of three tracks picked by the seed (real-time games have no level picker). Checkpoints in
    order, so cutting across is no lap; grass at a third of the speed. The first third track ran its road
    over itself: two parts of it passed 144px apart on a 116px road, and the bots lost the line there. A
    test now keeps every track's separate parts apart, proved red on that track.
  - [x] **U2c Sword Duel (2026-09-24):** 61 games. Two fencers on a strip held upright: step, lunge (reach
    and then a stretched recovery), parry (knocks a lunge aside and leaves the attacker open for the
    riposte); a double scores nobody; first to five. The first bot rolled its chances every step, 120 times
    a second, so "parries 30% of the time" meant always; the scene now hands it a roll that changes every
    0.4 seconds and a view of the other fencer a reaction late. With both bots hovering out of distance no
    bout ever ended, so each now commits to attacks of its own.
- [x] **R1 Party reflex (2026-09-24, full eight green, run 35931865298):** Whack-a-Mole, Paint Fight, Grab It. Split one game to a loop (2026-09-24), real
  time, two players on one phone:
  - [x] **R1a Whack-a-Mole (2026-09-24):** 62 games. Nine holes each, the same moles at the same moments on
    both boards from the seed, 45 seconds, moles 1, golden 3, bombs minus 2 and a dizzy mallet. Bots see a
    pop a reaction late and decide each pop once, from a roll kept per pop.
  - [x] **R1b Paint Fight (2026-09-24):** 63 games. Two rollers on a floor of 12 by 18 tiles, painting as they
    go and over each other, pots that splat a patch, 60 seconds, the split across the middle all round.
  - [x] **R1c Grab It (2026-09-24):** 64 games. A picture is called, two to six decoys flash (four in ten of
    them its same-colour look-alike), then the one called; first grab takes it, a wrong grab costs a point
    and freezes the hand, first to five. A same-step tie first went to nobody, which let two equally quick
    bots tie every call for ever and never finish; it alternates by call now.
That is twenty-two more games on top of the forty-three, and it covers every game either competitor lists.

## Stage 4: grow the catalog (brief first, 3–4 games per milestone, never a reskin)
- [x] **M20a Cards B, hidden hands (2026-09-19):** Crazy Eights, 35 games, and the first game here where you hold cards nobody else may see. Two players get seven cards and three or four get five, a play matches suit or rank, an eight goes on anything and names the next suit, you draw until you can play, and the pile becomes a new deck when the deck runs out.
  - **Bots that cannot cheat, rather than bots asked not to.** `chooseMove` hands the bot a seat's *view* (its own cards, the pile, the suit in force, everyone's hand sizes, how deep the deck is) and never the state. A test shuffles the other hands and reverses the deck behind each of the four levels and checks the same move still comes out. Sea Battle's bot was written not to look, but nothing proved it; this one is proved.
  - **The privacy promise is a test, not a paragraph.** A canvas cannot be asked what it is showing, so the scene answers `handCheck()` behind `?inspect`, which opens the test seam without putting bots in the chairs the way `?autoplay` does. The test sits two people at one phone, plays a turn on the keyboard and checks the cover came down with not one card of the new hand face up behind it.
  - That test failed first for a good reason: it pressed three keys between looks, and a key is also how you lift the cover, so it kept opening the hand it had come to see covered. The cover was fine; the test was not.
- [x] **M20b Cards B, asking and racing (2026-09-19):** Go Fish and War, 37 games. The hidden-hand cover moved out of Crazy Eights into `games/cards/privacy.ts`, where the rest of the dealt-hand games use it.
  - **Go Fish** follows the standard rules: seven cards each for two or three players and five for four, you may only ask for a rank you already hold, they hand over all of it and you ask again, otherwise you draw one and the turn passes. Every ask is public, because in the real game you heard it said out loud, so it is on the table and the bots that are meant to remember it do.
  - **41% of Go Fish games used to stall.** A probe over 600 games found 245 reaching a position with no legal move and no result: the pool empty and only one player still holding cards, so there was nobody to ask. The @full tests play every game to the end, so this would have hung CI. The rules now end the game there, and the test asserts a game finishes rather than quietly breaking out of the loop the way it used to.
  - **War** is the only game here with nothing to choose. Wikipedia says a game "theoretically might be infinite", so ours stops after 300 battles and the bigger stack wins, with the count on screen from the first flip so the finish is never a surprise.
  - **The privacy test was flaky before it was right.** It passed the push gate and failed the full run, which is worse than failing outright. With bots sitting at the other two chairs it was intermittent; with exactly two people and nothing moving but the keys the test presses, it is deterministic. I did not pin the exact interleaving, and the fix was to remove the moving parts rather than to explain them.
- [x] **M20c Cards B, the odd one out (2026-09-19):** Old Maid, 38 games, and M20 is done. One queen comes out of the deck so the third cannot pair, all 51 cards go round, pairs are thrown away before anybody plays, and a turn is one thing: take a card from the fan the player on your left is holding out. Bots are handed the size of the fan and nothing else, so there is no card they could be aiming for.
  - **A key already on its way could uncover the next person's hand.** The android-tablet run printed what the test saw: the turn had passed and the next hand was showing all seven of its cards. Phaser reads input on its own frame, so the key pressed a moment earlier arrived just after the cover went up and lifted it at once, and a person mashing keys as their turn ends would do the same to the person beside them. A covered hand now swallows input without acting on it and ignores anything arriving within 300ms of the cover. That is a fix to the game, not to the test: the test still presses quickly on purpose.
  - Worth keeping in mind for the rest of the dealt-hand games: this is the third time a flake in these tests turned out to be worth fixing in the app rather than in the test.
- [x] **M21a Cards C, tricks (2026-09-19):** Hearts, 39 games, and the bones of a trick-taking game in `packages/rules/src/games/tricks.ts`: following suit, who takes a trick, who leads the next, and which suits a player has shown they are out of. Spades and Callbreak sit on the same thing.
  - **The game people mean by Hearts** is what card historians call Black Lady: plain Hearts with the queen of spades at thirteen. Both are cited in the brief, because the base game in Wikipedia's Hearts article has no queen in it and shipping that would have surprised everybody.
  - Passing goes left, right, across and then a hand with no passing; the two of clubs leads; nothing that scores may go on the first trick; hearts cannot be led until one has been thrown away; all 26 on one player puts 26 on everybody else.
  - **One hand, to 50 or to 100** is picked at the table. A full game is eight or nine hands, which is a long sitting on a phone, so it is a choice rather than the only way to play.
  - Passing needed the turn to walk round the table rather than everybody choosing at once, because the session only ever asks the seat whose turn it is. The cards still change hands at the same moment, once the fourth player has chosen.
- [x] **M21b Cards C, bidding (2026-09-19):** Spades, 40 games, and the first game where a player says how well they expect to do before they play. Seats across from each other are partners, the two bids add up, and the pair has to take at least that many tricks. Spades are always trump and cannot be led until somebody has been forced to throw one.
  - **A bid of nought is nil, not "no bid".** It is a promise to take no tricks at all, worth a hundred either way. I wrote two test fixtures expecting the scores of a partnership that simply had not bid, and both were wrong. The rules were right and my reading of them was not, which is the sort of mistake a test only catches if the numbers in it were worked out by hand.
  - **Bags** are the part that makes the game: every trick over the bid is worth a single point now and ten against you later, once ten of them have piled up. Taking more than you promised is not free, so a pair that has been overshooting all game can lose on a hand it won.
  - One hand, to 200 or to 500, picked at the table, and the scoreboard shows each pair's score, tricks taken against tricks bid, and bags, because none of those three can be worked out from the others.
  - **An unused helper in a test file failed CI**, after typecheck had passed everything else. `scripts/precheck.sh` did not read test files, so `scripts/unused-scan.sh` now does: it finds a name bound once and used once, anywhere in the repo, and says whether it is exported.
- [x] **M21c Cards C, the subcontinent's game (2026-09-19):** Callbreak, 41 games, and M21 is done. Four players each for themselves, spades always trump, everybody calls at least one trick, and the call is scored or taken off whole.
  - **Nobody is allowed to hold a winner back.** Hold a higher card of the suit led and you must play it; with none of that suit you must trump, and the spade has to beat the spades already on the trick. That one rule is what separates Callbreak from Spades, and it makes the refusal message matter: a card that is greyed out here is usually greyed out because of a card somebody else played, so the game says "Beat the 10♥" rather than "not that one".
  - **Scores are kept in tenths** (41 is 4.1), because a trick over your call is worth a tenth of a point. Keeping them as whole numbers inside the rules means no rounding to argue with, and one place to turn them into words.
  - **The gallery screenshot found two faults that every test passed over.** The two seats at the sides had their names centred 76px from the edge of an 800px table, so in Spades and Callbreak the names ran off both edges, and in all three trick-taking games they sat on top of that seat's own face-down pile. The message banner sat on the far pile too. Hearts and Spades shipped like that in the last two milestones and nothing caught it: the page did not scroll, the board fitted, no card went missing.
  - **So the check is now a test.** The scenes answer `labelCheck()` in test mode and `e2e/labels.spec.ts` asserts no seat name runs off the table or sits on a card. Run 35444543112 is that test against the layout that shipped: red on both engines, "names on top of a card" for Hearts and Spades, "names off the table" for Callbreak. Worth repeating, because it keeps coming back: green CI says a game works, not that it looks right. Looking at the gallery artifact is part of finishing a game.
- [x] **M22a Cards D, melds (2026-09-19):** Gin Rummy, 42 games, and the bones of a melding game in `packages/rules/src/games/melds.ts`: sets, runs with aces low, the arrangement of a hand with the least left over, and laying off. Rummy sits on the same thing.
  - **The arrangement search has to be exact**, not nearly right, because a knock is legal or not on that number. It also plays hands better than I do: I wrote a test expecting K-Q-J-10 of hearts and two loose kings to be worth 22, and the search found 2, by putting the king of hearts with the other two kings and leaving Q-J-10 standing. The test now says that, because the mistake is the interesting part.
  - **The hand sorts itself** into that arrangement on screen, with a gap between melds and the count underneath, so nobody drags cards into order. Knocking throws the card that leaves you holding the least, which is the knock a player wants.
  - **The turn line was invisible for the whole game, and every test passed.** `.turn-pill` is keyed on its own text, so it remounts and replays its entry animation whenever the line changes, and that animation started from nothing. Gin Rummy's line changes on every move (take, draw, throw), so the fade never finished. Run 35449601418 is the new check against the shipped CSS: opacity 0.00 on all six looks through a whole game. The pill now has its own keyframe starting at 0.55.
  - Second milestone running where the gallery picture found what green CI could not. The pattern is the same both times: something that is only wrong while the game is moving, which no screenshot-free test was looking at.
- [x] **M22b Cards D, the family game (2026-09-19):** Rummy for 2 to 4, 43 games, and M22 is done. Draw one, put melds down if you want to, add to melds already on the table if you want to, throw one away. First one out takes what everybody else is holding, doubled for laying a whole hand down in one turn.
  - **The bots never went out.** Thirty-one hands of a test match ended with nobody out: every one died of the cards running out, because the bots threw cards away at random, and the ones that would not lay off sat holding four cards no meld could take. That is not a hard opponent, it is a broken game. Every tier now melds, lays off and throws something it can spare; the tiers differ in how well they choose. Seventeen of twenty hands now end with somebody out at both table sizes, and a test asserts at least twelve, because nothing else could see this.
  - **The label check from M22a caught my own new table** before it shipped: the seat names sat on the face-down hands. Then the gallery picture showed the deck and the pile under two players' hands with the melds squeezed into a corner at half size, so the piles moved down the left and the melds took the width beside them.
  - **The Android job had one place with no relaunch:** the first connect. Every game already retried a lost WebView page, but if the page died before the shelf drew, the whole run was thrown away, which is exactly what happened on run 35457684066 with all eight screen types green. It retries three times now.
  - **Our one invention:** the rules say the pile is turned over when the stock runs out and say nothing about what happens when that runs out too, so we throw the hand in and nobody scores. Two players taking each other's discards would otherwise sit there for ever.
- [ ] **M23 Party (pass the phone):** Impostor, Charades, Draw & Guess, Guess the Person. Split one game per loop, like the others. These need a table the others do not: three to eight people on one phone, so a game marked `party` in the registry gets player-count chips and a ring of faces instead of four chairs (`PartySetup` in `components/Setup.tsx`). There are no bots in a talking game; autoplay plays them as a quiet table so CI can finish them.
  - [ ] **M23a Impostor:** everyone but one sees the secret word; pass the phone to look, go round with one word each, vote, and a caught impostor gets one guess from six words. Ten word sets of our own.
  - [ ] **M23b Charades:** the holder puts the phone on their forehead, the table acts or describes the word and taps Got it or Pass; a minute a go, one or two goes each, 160 words of our own. Tap now; tilt later, since it needs a motion permission on iPhones.
  - [ ] **M23c Draw & Guess:** one person draws the secret word while the table shouts; Got it asks who called it and both score. Eighty seconds, five inks, hold to peek, 140 words of our own.
  - [ ] **M23d Guess the Person:** 24 faces of our own, twelve yes or no questions the phone answers, faces tip over, a wrong name loses. vs bot or two people passing the phone.
- [ ] **M24 Heritage A:** Royal Game of Ur, Senet, Nine Men's Morris, Pachisi. Split one game per loop.
  - [ ] **M24a Royal Game of Ur:** Finkel's rules, the board stood on end to fit a phone, four pyramid dice, pieces hop square by square.
  - [ ] **M24b Senet:** Kendall's reconstruction, the board on end, four sticks, swaps, walls, the water.
  - [ ] **M24c Nine Men's Morris:** place, move, fly with three; mills glow and take; search bots, Expert in the worker.
  - [ ] **M24d Pachisi:** the cross, six cowries, graces, castles, partners with four; not a Ludo reskin (see the brief).
- [ ] **M25 Heritage B:** Go 9×9, Hnefatafl, Fanorona, Chowka Bhara. Split one game per loop.
  - [ ] **M25a Go 9×9:** area scoring with komi 7, superko, dead stones played off; Monte Carlo bots on a fast board, Expert in the worker.
  - [ ] **M25b Hnefatafl:** Copenhagen rules on 11 by 11, minus shieldwalls, exit forts and encirclement; search bots, Expert in the worker.
  - [ ] **M25c Fanorona:** approach and withdrawal, capture runs, choose the line by tapping it; search bots, Expert in the worker.
  - [ ] **M25d Chowka Bhara:** the 5 by 5 floor, four cowries, hit before going inside (round again until then), doubles safe.
- [ ] **M26 Board extras:** Gomoku, Chinese Checkers, Hex, Code Breaker (Code Breaker also answers Ponder Club's)
  - [ ] **M26b Chinese Checkers:** the 121-hole star, chained hops, anti-spoiling home; 2 to 4 players until the party table can seat six.
  - [ ] **M26c Hex:** 11 by 11 with the swap rule; all-moves-as-first Monte Carlo bots, Expert in the worker.
  - [ ] **M26d Code Breaker:** Easy, Classic and Hard; pegs carry their numbers; `allows` for the 32,768 codes of Hard.
  - [ ] **M26a Gomoku (parked 2026-09-24):** the rules were easy; the bot was not. A one-move evaluator (unbroken runs, then five-wide windows, attack plus defense) played so badly that in self-play the second player won 72% of games, where real Gomoku favors the first, and a little randomness beat no randomness, so tier ordering was noise. Subtracting the reply's best score punished its own threats. It needs a real threat-space search (fours and open threes first, then a short forced-win search) before it ships. The draft rules and tests were kept out of the repo.
- [ ] **M27 Puzzles A:** Nonogram and friends (Sweeper, Tile Match and Word Guess moved to Stage 5, where the competitors' lists put them). Split: Nonogram, Mahjong Solitaire, Block Puzzle, Number Match. Nuts & Bolts was dropped: it is Color Sort with different pictures.
  - [ ] **M27d Number Match:** Take Ten: pairs that match or make ten, five adds, the grid shrinks to fit.
  - [ ] **M27c Block Puzzle:** 8 by 8, three pieces a deal, drag with the piece above your finger; goal 500.
  - [ ] **M27b Mahjong Solitaire:** 36, 72 and the 144-tile turtle, our own faces, deals built backwards so each can be cleared.
  - [ ] **M27a Nonogram:** 3 sizes, mirrored pictures that line logic alone solves; drag to paint, Fill and Mark buttons.
- [x] **H1 Shelves (2026-09-24):** at 83 games one grid was a wall, so the home screen now has a shelf per kind: two on one phone, board games, games from long ago, cards, words and numbers, puzzles, party. One file (`games/shelves.ts`), the same tiles, and a last "More games" shelf so a game left off every list still shows. A design call made without the owner, and easy to undo: say so and it goes back to one grid.
- [ ] **M28 Chill shelf A:** Pop bubbles, Bubble wrap, Newton's cradle, Zen garden. A toy ends when you finish it (both sides popped, or Done), so it fits the game contract. Pop bubbles and Bubble wrap are one toy: two would be a reskin.
  - [ ] **M28b Zen Garden:** rake with four tines, up to seven stones, Smooth, Done.
  - [ ] **M28a Pop It:** four shapes, rainbow rows, drag to pop, flip for the second side.
- [ ] **M30+** The rest of the catalog, 3–4 per milestone, split here when we get there

After launch, alternate: one Stage 3 or 4 milestone, then one polish/bug milestone driven by player reviews and crash reports.

## Budget
$0. Apple and Google developer accounts already exist; everything else uses free tiers ([10](10-zero-budget-plan.md)). Paid from revenue, in order: Apple renewal $99/yr → domain ~$10/yr → Cloudflare Workers paid plan ($5/mo) if free caps are hit → small ad tests → custom art.
