# 10 — Zero-budget plan

Goal: build and launch Game Pals spending **only the unavoidable store fees**, and let ad revenue pay for anything else. Researched 2026-09-12.

## 1. Store accounts
Apple Developer Program and Google Play developer accounts **already exist** (confirmed 2026-09-12) — no new spend. Keep the Apple membership ($99/yr) renewed; if it lapses, apps are removed from the App Store.

Google Play note: if the Play account is a *personal* account created after 2023-11-13, each new app still needs a closed test with 12 testers for 14 days before production. Organization accounts and older personal accounts are exempt.

**Day-one spend: $0.** Everything below is free.

## 2. Free stack
| Need | Free choice | Free limits / gotchas | When you'd pay |
|---|---|---|---|
| Engine | Phaser 4 + TypeScript + Vite; Capacitor for iOS/Android | MIT, free forever | Never |
| Dev environment | GitHub Codespaces (VS Code in the browser) + Claude Code | GitHub Pro (already owned): 180 core-hours/month (~90 h on a 2-core machine), 20 GB storage; stop codespaces when idle | Past ~90 h/month, work in a light local folder instead |
| Source control | GitHub private repo | — | — |
| 2D art | **Kenney CC0 packs**: Board Game Pack (490), Playing Cards (270), Board Game Icons (250), Domino Pack (30); plus Krita / Inkscape / Blender | CC0 = free for commercial use, no credit required | Custom art later |
| Sound | Kenney UI/digital sound packs (CC0), Freesound filtered to CC0 | Check each file's license; log it | — |
| Fonts | Google Fonts (OFL) | — | — |
| Backend (friends, groups, leaderboards, matches, async games) | **Cloudflare Workers + Durable Objects + D1** (see §3) | 100K requests/day; D1 5M row reads + 100K writes/day, queries fail past the cap until midnight UTC | Workers paid plan ($5/mo) once revenue exists |
| Accounts | Firebase Auth (anonymous, Sign in with Apple, Google) | Free to 50K monthly active users | > 50K MAU |
| Backend escape hatch | Nakama on **Oracle Cloud Always Free** Arm VM (up to 4 cores / 24 GB) — official arm64 Docker images exist (3.37–3.40, 2026) | Arm capacity often unavailable in your region; idle VMs reclaimed if CPU p95 < 10% for 7 days (upgrading to pay-as-you-go stops reclaim but needs a card) | — |
| Backend alternative | Unity Gaming Services free tier (evaluated when the engine was Unity; see §3) | Unity-first SDKs | — |
| Platform leaderboards | Game Center (iOS) + Play Games Services (Android) | Free, but each only covers its own platform | — |
| Ads | **AdMob** (+ free mediation) | $100 payout threshold; new accounts get limited ad serving for up to ~30 days; `app-ads.txt` required on your developer website | Add AppLovin MAX (also free) once DAU is meaningful |
| Purchases | RevenueCat | Free up to $2.5K monthly tracked revenue, then 1% | Only when earning |
| Analytics & crashes | Firebase Analytics + Crashlytics; UGS Analytics free to 50K MAU | — | — |
| Remote config | UGS Remote Config (free) or Firebase Remote Config | — | — |
| Website, privacy policy, deep links | Cloudflare Pages or GitHub Pages (`*.pages.dev` / `*.github.io`) | ⚠ Verify AdMob accepts `app-ads.txt` on a free subdomain before relying on it; if not, a ~$10 domain is the **first** thing to buy from revenue | Custom domain |
| Web distribution | itch.io (you choose the platform cut, 0–100%, default 10%), CrazyGames (Basic Launch without SDK: ≤ 50 MB, ≤ 20 MB for mobile home; ad revenue share needs SDK/Full Launch), GameDistribution (Unity SDK), Poki (selective, < 8 MB initial download) | Non-exclusive — publish everywhere | — |
| Google Play production access | 12 testers opted in for 14 continuous days (personal accounts created after 2023-11-13) | Free sources: friends/family, Reddit tester-swap threads, Testers Community free exchange. Organization accounts skip this but need a D-U-N-S number (free) and a registered business | — |
| Builds | GitHub Actions (typecheck, tests, web build, Android) + Codemagic (iOS → TestFlight) | Actions (GitHub Pro): 3,000 Linux minutes/month · Codemagic: 500 macOS M2 minutes/month | Never at this scale |
| Web hosting | GitHub Pages (Pro allows it from the private repo) · Cloudflare Pages for per-branch previews later | Free; the site itself is public | — |
| Trailers & store video | OBS Studio + DaVinci Resolve (free) | — | — |
| Marketing | ASO, YouTube Shorts, TikTok, Instagram Reels, Reddit, Discord | Organic reach for gaming accounts reported down to ~4–8% in 2026 → post 3–5 short videos per week | Small paid tests later |

## 3. Backend decision for the $0 phase: Cloudflare + Firebase
Chosen 2026-09-12 together with Phaser + TypeScript:
1. **Same language end to end** — the server imports `packages/rules` to referee matches and validate scores.
2. **No servers to run** — nothing to patch, back up or get reclaimed; no card needed on the free plan.
3. **Durable Objects** give one stateful object per match room / async game, with WebSocket hibernation so idle turn-based games cost nothing.
4. **Firebase Auth** handles guest → Apple/Google sign-in for free up to 50K MAU; the Worker verifies Firebase ID tokens.

Risks: D1 queries hard-fail past the daily free caps → a budget guard shows "online is busy, try later" before that and everything offline keeps working; the $5/month Workers plan is the first backend spend once revenue exists.

### Superseded: Unity Gaming Services (kept for reference)
UGS free tier (unity.com pricing page, 2026-09-12):
| Service | Free |
|---|---|
| Authentication | Free |
| Friends | 50,000 active users/month |
| Leaderboards | Free "for a limited time" (pricing may change) |
| Cloud Save | 5 GiB storage, 1M writes, 1M reads / month |
| Cloud Code | 1M invocations, 20 compute hours, 1 GiB egress / month — **supports C# modules** |
| Lobby | 10 GiB / month per regional group |
| Relay | first 50 average monthly CCU; 3 GiB per CCU up to 150 GiB |
| Remote Config | Free |
| Analytics | 50,000 active users/month |

Why UGS instead of Nakama for now:
1. **No server to run** — nothing to patch, back up, or get reclaimed; no card needed.
2. **Cloud Code runs C#** — the server can use the same rules library as the game to referee ranked matches. No TypeScript rewrite.
3. Covers friends, leaderboards, cloud saves, lobbies, relay, accounts and remote config in one free tier.
4. Online features only arrive in phase 3, so usage (and risk) is zero until then.

Risks and mitigations:
- One quota exceeded blocks everything → usage alerts at ~70%; by that scale ad revenue covers the bill.
- Leaderboards pricing may change → keep leaderboard volume modest (write only personal bests).
- Lock-in → all online calls go through our own `IBackend` interface; Nakama on Oracle's free VM is the fallback.
- Async turn-based games use Cloud Save + Cloud Code (cheap), not Relay; only realtime games (Air Hockey) use Relay.

## 4. Launch order
1. **Web, Android and iOS together** — itch.io + CrazyGames Basic Launch, Google Play, App Store. If the Play closed-test rule applies (see §1), start it as soon as the first playable build exists.
2. **Online & social** after the offline launch (UGS stays at $0 until then).

## 5. Portfolio strategy
- Research repeatedly points the same way: many small games beat one big bet (a full-time solo dev's advice), and JindoBlu grew with 4 cross-promoting apps.
- From the same codebase, ship **Game Pals** (all-in-one) plus **single-game spin-offs** later (e.g. a Ludo-only and a Chess-only app). Each is a free extra store listing on its own keyword, cross-promoting the main app.
- ⚠ Google Play's spam/repetitive-content policy: spin-offs must be genuinely different games, not reskins.

## 6. Realistic money expectations
- A solo dev's 3-week prototype (2025, $50 total cost): **233K Android downloads → ~$10.6K ad revenue** (~$0.045 per download), 11K iOS → ~$580, 163K web plays → ~$751. Downloads came organically after a surprise spike that lasted ~4 months.
- A first app with 21 downloads earned $0.07. **Downloads are everything**; ASO and videos matter more than features.
- AdMob pays only after $100 accumulates.
- A full-time solo dev took ~18 months to earn a living and lost $40K+ on one flop. Keep your job/income until the numbers are steady.

## 7. What to buy first, once money arrives
1. Apple Developer Program renewal ($99/yr) when it comes due.
2. Custom domain (~$10/yr) → cleaner links, reliable `app-ads.txt`.
3. Small Apple Search Ads / TikTok boosts on the best-performing game.
4. Custom art/sound for the top games.

## 8. Sources
- [Google Play – testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en) · [Choose a developer account type](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en) · [ontest.app – 12 testers methods](https://ontest.app/blog/how-to-get-12-testers-for-google-play-closed-testing) · [Testers Community](https://www.testerscommunity.com/)
- [Apple – fee waivers](https://developer.apple.com/help/account/membership/fee-waivers/)
- [Unity Gaming Services pricing](https://unity.com/solutions/gaming-services/pricing) · [UGS billing behavior](https://docs.unity.com/ugs/en-us/manual/overview/manual/signing-up-for-ugs)
- [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) · [Oracle Free Tier FAQ](https://www.oracle.com/cloud/free/faq/) · [Nakama on Docker Hub](https://hub.docker.com/r/heroiclabs/nakama)
- [Cloudflare D1 free-tier enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/) · [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Durable Objects free tier](https://developers.cloudflare.com/changelog/2025-04-07-durable-objects-free-tier/)
- [RevenueCat pricing (costbench)](https://costbench.com/software/subscription-billing/revenuecat/)
- [AdMob payment thresholds](https://support.google.com/admob/answer/2772208?hl=en) · [AdMob ad serving limits](https://support.google.com/admob/answer/9493252?hl=en) · [app-ads.txt requirement](https://ppc.land/new-admob-policy-requires-app-ads-txt-from-january-2025/) · [AppLovin payments](https://support.applovin.com/en/max/max-dashboard/account/payments)
- [Kenney Board Game Pack](https://kenney.nl/assets/boardgame-pack) · [Playing Cards Pack](https://kenney.nl/assets/playing-cards-pack) · [Board Game Icons](https://kenney.nl/assets/board-game-icons) · [Domino Pack](https://kenney.nl/assets/domino-pack)
- [CrazyGames requirements](https://docs.crazygames.com/requirements/intro/) · [Poki requirements](https://sdk.poki.com/new-requirements.html) · [GameDistribution Unity SDK](https://acc.gamedistribution.com/sdk/unity) · [itch.io launch guide](https://app.cinevva.com/guides/itch-io-launch-guide)
- [Play Games Services leaderboards in Unity](https://developer.android.com/games/pgs/unity/leaderboards)
- [Zero-budget indie marketing (Boomie Studio)](https://boomiestudio.com/blog/indie-game-marketing) · [TikTok for indie devs (presskit.gg)](https://presskit.gg/field-guides/tiktok-indie-game-marketing)
- YouTube transcripts in [research/yt/](research/yt/): [$14K solo game, no marketing](https://www.youtube.com/watch?v=sB1fT3plzdo) · [Making a living from mobile games](https://www.youtube.com/watch?v=5Sr7GkMY3N4) · [Quit my job to make mobile games solo](https://www.youtube.com/watch?v=s8mpENnbcEU) · [Making a game solo with $0](https://www.youtube.com/watch?v=vve0ykOPk3s)
