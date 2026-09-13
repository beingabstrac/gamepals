# 04 — Tech architecture

Decided 2026-09-12: **Phaser 4 + TypeScript, developed fully in the cloud, $0.** (Replaces the earlier Unity + Unity Gaming Services design; reasons in [01 §3](01-research.md#3-engine--stack-research-summary).)

## 1. Stack
| Layer | Choice | Notes / free limit |
|---|---|---|
| Game engine | **Phaser 4** (4.1, Apr 2026) + TypeScript + Vite | WebGL renderer rebuilt; big mobile gains; recovers lost WebGL context automatically |
| Menus / shell | **Preact** + CSS over the canvas | Text, localization, RTL, accessibility are easier in HTML |
| Native apps | **Capacitor** (iOS + Android) | Web build bundled into the app → offline by default |
| Rules & bots | `packages/rules` — pure deterministic TS | Shared by client, bots, tests, server referee |
| Backend | **Cloudflare Workers + Durable Objects + D1** | Free: 100K requests/day; D1 5M row reads + 100K writes/day (hard-fail since 2026-09-01); Durable Objects on the free plan with WebSocket hibernation |
| Auth | Firebase Auth (anonymous → Sign in with Apple / Google) via `@capacitor-firebase/authentication`; Worker verifies ID tokens | Free to 50K MAU |
| Push | Firebase Cloud Messaging (`@capacitor-firebase/messaging`) | Free |
| Analytics / crashes | `@capacitor-firebase/analytics`, `@capacitor-firebase/crashlytics` | Free |
| Remote config | Firebase Remote Config or a JSON file on Cloudflare | Bot tuning, ad frequency, feature flags |
| Ads (apps) | `@capacitor-community/admob` (MIT; UMP consent + iOS ATT) | Capawesome's AdMob plugin is paid — not used |
| Ads (web) | CrazyGames / Poki / GameDistribution SDK builds; itch.io | Separate portal builds, no AdMob |
| Purchases | `@revenuecat/purchases-capacitor` (official) | Free to $2.5K monthly tracked revenue |
| Game Center / Play Games | `@openforge/capacitor-game-connect` | Check Capacitor-version support before adopting |
| Local saves | `@capacitor/preferences` + `@capacitor-community/sqlite`; IndexedDB on web | iOS may evict WebView storage — never keep app saves there |
| Haptics, share, status bar, splash | Official `@capacitor/*` plugins | Native feel (App Store guideline 4.2) |
| Dev environment | GitHub Codespaces + devcontainer (Node 22, pnpm, Claude Code) | GitHub Pro: 180 core-hours/month (~90 h on 2 cores), 20 GB |
| CI / builds | GitHub Actions (typecheck, test, web build, Android AAB) · Codemagic (iOS → TestFlight) | GitHub Pro: 3,000 Linux min/month · 500 macOS M2 min/month |
| Web hosting | GitHub Pages (Pro allows Pages from private repos; `pages.yml` deploys on push) · Cloudflare Pages later for per-branch previews | Free; also hosts privacy policy, `app-ads.txt`, deep-link files. Pages sites are public even when the repo is private |

## 2. Repository layout
```
.devcontainer/          Codespaces setup
apps/client/            Vite + Phaser + Preact
  src/shell/…           screens (home, game page, seat picker, results, settings, friends)
  src/games/<id>/       Phaser scene(s) per game — view + input only
  src/platform/         adapters: ads, iap, auth, storage, push, haptics, gameServices (web + native)
  src/net/              IBackend client (REST + WebSocket)
  src/session.ts        seats + turn loop for every mode
apps/mobile/            Capacitor config + ios/ + android/                (M1)
apps/server/            Cloudflare Worker, Durable Objects, D1 migrations  (M3)
packages/rules/         core contract + games + bots
packages/shared/        API/protocol types + validation                    (M3)
.github/workflows/      ci.yml (+ android.yml in M1)
codemagic.yaml          iOS build + TestFlight                             (M1)
```

## 3. Game contract (`packages/rules/src/core`)
```ts
interface GameDefinition<M> {
  id; name; minPlayers; maxPlayers; modes; hiddenInfo; realtime;
  newGame(config, seed): GameState<M>;   // all randomness from seed
  createBot(tier): Bot<M>;
  encodeMove(move): string;               // for move logs + network
}
interface GameState<M> {
  currentSeat; result;
  legalMoves(seat): readonly M[];
  apply(move): GameState<M>;              // pure, throws on illegal move
}
```
- `createRng(seed)` — xoshiro128**, integer math, identical on every JS engine.
- Move log = `{ gameId, seed, config, moves[] }`; `replay()` rebuilds and validates a game → resume, async play, server referee, anti-cheat.
- Search helpers: negamax alpha-beta (`scoreMoves`), `createSearchBot(tier, evaluate)`. Tier knobs (depth, random-move rate, reaction delay…) are data.
- Hidden-information games will add `viewFor(seat)` so servers only send each player what they may see.

## 4. Client
- `Session` holds definition, seats (`human | bot`; `remote` in M3) and state; bots move after a short delay. Every mode combination runs through it.
- Scenes render `session.state` and call `session.play(move)`; Preact renders status, rematch, menus.
- Heavy bots (Chess, cards) will run in a Web Worker (`src/workers/bot.worker.ts`) with a time budget.
- One Phaser `Game` per match, sized 600×600 logical units with `Scale.FIT`.

## 5. Server (M3)
- **D1:** users, friends, groups (family), group_members, personal bests, ratings (Glicko-2 per game), invites.
- **Durable Objects:** `MatchRoom` (live matches; server-authoritative for hidden-info games using `packages/rules`), `AsyncGame` (state + move log, push "your turn"), `Matchmaker` (per game/mode queue, rating bands, labeled bot fallback after ~20 s).
- **Referee:** replays move logs to verify ranked results and top solo scores.
- **Budget guard:** daily counters; online features show "busy, try later" before free caps are hit; everything offline keeps working.

## 6. Offline-first
- All games and assets bundled in the app.
- Outbox (SQLite) for results, async moves and scores; flushed with idempotent IDs when online.
- Rewarded ad unavailable offline ⇒ grant the reward (capped per hour).
- Pro / Remove Ads entitlement cached locally.

## 7. App Store / Play readiness
- Native feel: haptics, safe areas, no browser UI, fast launch, Game Center / Play Games, native purchases, push, offline play (guideline 4.2).
- Guideline 4.7's Nov 2025 change covers apps hosting third-party mini apps — not our own bundled code.

## 8. Performance budgets
- Web initial download < 8 MB (Poki) / < 20 MB (CrazyGames mobile); app install < 50 MB.
- 60 fps on reflex games; lower resolution and 30 fps option on weak Android devices; texture atlases.
- Bots ≤ 1 s think time on low-end phones.

## 9. Testing
Full matrix of surfaces, modes and free test tools: [13](13-platforms-and-testing.md).
- Vitest: rules, bot tier ordering (bot-vs-bot tournaments), determinism (same seed + moves ⇒ same result), replay.
- Playwright on 8 screen types (Android phone and tablet, iPhone, iPad portrait and landscape, desktop Chrome, Safari, Firefox): every game opened and played, layout fits, offline play.
- Real devices: Firebase Test Lab (Android), Xcode Cloud and TestFlight (iPhone, iPad, Mac), plane test before every release.
- Server (M3): Vitest with Wrangler/Miniflare; multi-player browser tests; bot-client load tests.
