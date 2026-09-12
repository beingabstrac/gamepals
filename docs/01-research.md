# 01 — Research

Researched 2026-09-12. Figures marked *(est.)* are third-party estimates (Sensor Tower, podcast hosts), not confirmed numbers.

## 1. The competitor: JindoBlu (Moreno Maio)

- Solo Italian developer, publishing since 2014 under **JindoBlu** (seller entity: Jindoblu Limited). Built in **Unity**.
- ~**580M lifetime downloads**, only ~**$2.7M lifetime IAP** → the business is **ads**.
- Four apps, all free, all rated ~4.7–4.8 on the App Store (Canada, Sep 2026):

| App | Ratings (CA store) | First release | Notes |
|---|---|---|---|
| Offline Games – No Wifi Games | 54K | Aug 2023 | 1.5M downloads/day peak (Jul 2024) *(est.)* |
| 2 Player Games: Offline games | 43K | May 2019 | 81 mini-games, ~225M downloads *(est.)* |
| 1 2 3 4 Player Games | 12K | Dec 2022 | up to 4 players, one device |
| Antistress – Relaxing games | 8K | Feb 2017 | 160+ toys, ~270M downloads *(est.)* |

- Retention: Antistress D30 ~25%, 2 Player Games D30 ~18% *(est., Gamigion)*.
- Updates every ~2 weeks; icons/screenshots changed constantly.

### Podcast teardown — "two & a half gamers", Offline Games episode (~Aug/Sep 2024)
Full transcript: [research/podcast-transcript.txt](research/podcast-transcript.txt)

- **Scale:** ~100M downloads in a year, ~90% after July 2024; ~7–8M DAU, ~42M MAU; India #1, US ~13% of downloads but ~31% of IAP revenue.
- **IAP is tiny:** the only purchase is "remove ads" at $5.99 → ~$3K/day.
- **Ad revenue *(hosts' est.)*:** $250K–$600K/day at the spike; even the pessimistic case (30% of users × 1 ad/day) ≈ $2.5M/month.
- **Ads are rewarded only**, same 3 placements in every game: more moves, undo, extra try. No progression, no currency, no shop. Mediation stack includes AdMob, Meta, AppLovin, Unity, ironSource, Amazon.
- **Content** = Windows-era classics (Solitaire, FreeCell, Minesweeper, Snake, Chess, Checkers, Hangman, Tic-Tac-Toe) + clones of recent hyper-casual hits (Water Sort, fruit merge, 2048, word finder, Block Fill). **Adding Ludo** (huge in India) likely triggered the July spike.
- **Growth is organic:** ranks #1 for "offline games", "no internet games" on both stores; keyword-rich description; 570K-subscriber YouTube channel with a trailer per app (Antistress trailer ~19M views); website jindoblu.com links to YouTube, YouTube links to stores; cross-promo strip between his apps. Hosts found **zero** paid creatives in Meta/Google/TikTok ad libraries.
- **Hosts' conclusion:** adding progression/IAP/aggressive ads would likely hurt the 4.9 rating and the "honest offline games" positioning that powers organic growth. *Less is more.*

### What we take from it
1. Rewarded-first monetization, plus one clean "Remove Ads".
2. Pick games by search demand (classics + current hits + market-specific like Ludo).
3. Organic machine from day 1: ASO, YouTube, website, cross-promo.
4. Differentiate: he has no real online/friends/leaderboards and his bots are basic. **Our wedge = every game, every mode, one app.** Don't fight for "offline games" as the main keyword; own "play with friends/family, online or offline".

## 2. Market data

- **Subscriptions in games convert poorly** (RevenueCat State of Subscription Apps 2026): download→paid 1.0% median; 82% of game subs sold are **weekly** (median $5.81), yearly median $24.99; D60 revenue per install $0.14.
- Hybrid monetization (ads + IAP + subs) is most common in games (4× the average app).
- Casual game ad ARPDAU typically $0.05–0.50. Interstitial eCPM $10–25 in Tier-1; never show one in a new user's first 30s; 1–2 per session max.
- Web: CrazyGames pays 60% of ad revenue / 70% of IAP; good portal games earn $200–2,000/month; Google H5 Games Ads available for own site.

## 3. Engine & stack research (summary)

| Option | Verdict | Why |
|---|---|---|
| Unity 6 | Was chosen first; replaced | Proven by competitor; first-party ad/IAP SDKs; Personal free < $200K. Dropped because the editor needs ~20 GB free on the owner's 8 GB M1 Mac, and cloud-only Unity means no visual editor and 10–20 min builds per test |
| **Phaser 4 + Capacitor** | ✅ **Chosen (2026-09-12)** | Best web & AI-coding fit; develops fully in the cloud with instant browser preview; no license step; same code for web portals and apps. Trade-off: mobile ads via the MIT community AdMob plugin (no AppLovin MAX) — acceptable since we start AdMob-only |
| Godot 4 | ✗ | Documented web-export crashes/hangs on iOS Safari (issues #88321, #107390) |
| Flutter + Flame | ✗ | CanvasKit memory crashes on iOS Safari (#178524); thin game tooling |
| Defold | ✗ | Tiny web builds, but small ecosystem |

**Backend update (2026-09-12):** with a TypeScript stack and a $0 budget, the backend is Cloudflare Workers + Durable Objects + D1 (free tier, same language as the rules library) with Firebase Auth — see [04](04-tech-architecture.md) and [10](10-zero-budget-plan.md). Original comparison, kept for reference:

Backends: **Nakama** (friends, groups, leaderboards, tournaments, turn-based + authoritative/relayed matches, chat; open source; Unity SDK) vs Photon (networking only) vs Supabase (data, not realtime gameplay) vs Colyseus (JS-first). Nakama covers the full feature list in one server.

Unity web caveat: keep iOS Safari memory < ~384 MB, Brotli, audio after first tap.

## 4. Sources
- [Gamigion – JindoBlu](https://www.gamigion.com/top-charts-offline-games-no-wifi-games-by-jindoblu/) · [Sensor Tower – JindoBlu](https://app.sensortower.com/publisher/android/JindoBlu) · [TV Tropes – Jindoblu](https://tvtropes.org/pmwiki/pmwiki.php/Creator/Jindoblu)
- [Podcast (YouTube)](https://youtu.be/q9groW1mOnY) · [Episode page](https://lancaric.me/two-a-half-gamers-offline-games-no-wifi-games-the-most-profitable-game-in-the-world/)
- [RevenueCat – State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps)
- [Cinevva – 2D engines 2026](https://app.cinevva.com/guides/best-2d-game-engines-2026) · [Godot vs Unity for web](https://app.cinevva.com/guides/godot-vs-unity-web-games) · [Web monetization](https://app.cinevva.com/guides/web-game-monetization) · [CrazyGames guide](https://app.cinevva.com/guides/publish-game-crazygames)
- [StraySpark – Unity 2026](https://www.strayspark.studio/blog/unity-engine-2026-state-comeback-runtime-fee-aftermath) · [Bugnet – Unity WebGL on iOS](https://bugnet.io/blog/how-to-fix-unity-webgl-build-crashing-on-safari-ios) · [Unity MCP](https://unity.com/blog/unity-ai-mcp-how-to-get-started)
- [Godot #88321](https://github.com/godotengine/godot/issues/88321) · [Godot #107390](https://github.com/godotengine/godot/issues/107390) · [Flutter #178524](https://github.com/flutter/flutter/issues/178524)
- [UndrAds – mediation comparison](https://undrads.com/blogs/ironsource-vs-applovin-max-vs-admob) · [AdReact – interstitials](https://adreact.com/blog/interstitial-ad-best-practices-mobile-games/)
- [Nakama](https://heroiclabs.com/nakama/) · [Nakama social](https://heroiclabs.com/social/) · [Photon pricing](https://crux.supercraft.host/blog/photon-fusion-pricing-2026/)
- [Chier Hu – Claude Code for game dev](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)
