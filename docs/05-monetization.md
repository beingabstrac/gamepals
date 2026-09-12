# 05 — Monetization

Principle (learned from JindoBlu): **monetize lightly, keep the rating high, let scale pay.** Ads carry the business; purchases are a bonus.

## 1. Ads (AdMob at launch → AppLovin MAX mediation later)
AdMob first: free, simplest setup, built-in consent (UMP). New accounts get limited ad serving for up to ~30 days, and payouts start at $100. Switch to MAX (also free) once DAU makes the extra eCPM worth the integration work.

| Placement | Format | Rule |
|---|---|---|
| Undo / take back | Rewarded | Free on Easy bot and in same-device games with kids profile; rewarded elsewhere |
| Hint | Rewarded | Sudoku, Solitaire, Minesweeper, Word games |
| Extra try / continue | Rewarded | Puzzle games after a loss |
| Unlock a game variant / theme for 24h | Rewarded | Cosmetic only |
| Double daily-challenge badge | Rewarded | Optional |
| Between games | Interstitial | **Off at launch.** Enable via remote config for A/B test: max 1 per 3 minutes, never in first session, never mid-game, never before first win |
| Banner | — | **None in gameplay.** Test only on the home screen later, if at all |
| App open | — | Not used |

Offline: no ad available → grant the reward anyway (cap ~5/hour). Online matches: no ads during a match; interstitial (if enabled) only after leaving the result screen.

Kids/under-13 segment: non-personalized ads, Families-certified networks only, see [07](07-compliance-legal.md).

## 2. Purchases (RevenueCat)
| Product | Type | Price (US, test) | Gives |
|---|---|---|---|
| **Remove Ads** | Non-consumable | $5.99 | No interstitials/banners; rewarded rewards granted free. Family Sharing on |
| **Game Pals Pro** | Subscription: weekly / yearly | ~$2.99/wk · ~$24.99/yr (test) | Remove Ads + unlimited undo/hints + all themes & piece sets + advanced stats & game analysis + create family tournaments + early access to new games |
| Theme packs | Non-consumable | $1.99–2.99 | Board/card/piece styles |
| Supporter / lifetime Pro | Non-consumable | ~$39.99 (test) | Pro forever |

Rules:
- **Never** paywall a game, a mode, or a bot tier. Pro sells comfort and cosmetics.
- No trial dark patterns; show price clearly; easy cancel link.
- Paywall shown only from: settings, Pro badge on locked cosmetics, after the Nth rewarded ad in a session ("Tired of ads?"). Never on first launch.

Benchmarks to calibrate expectations: games convert ~1% download→paid; 82% of game subs sold are weekly; 73% of games use ≤4-day trials (RevenueCat 2026).

## 3. Web
- Own site: Unity WebGL build + Google H5 Games Ads (by application) — also serves as SEO landing pages and a funnel to the apps.
- Portals: CrazyGames (60% ads / 70% IAP to developer), Poki (selective). Portal builds are separate, lighter packages of individual games with portal SDK ads.
- Web purchases via RevenueCat web billing so Pro works across devices (verify fees/availability at implementation time).

## 4. Revenue model (planning math, not a forecast)
`daily ad revenue ≈ DAU × % who watch × rewarded views per watcher × eCPM / 1000`

| DAU | % watch | views/day | blended eCPM | Ads/day | Ads/month |
|---|---|---|---|---|---|
| 10K | 40% | 3 | $5 | $60 | ~$1.8K |
| 100K | 40% | 3 | $5 | $600 | ~$18K |
| 1M | 40% | 3 | $5 | $6,000 | ~$180K |

eCPM varies a lot by country (US high, India low). IAP typically adds 5–20% on top for this genre. Track and replace assumptions with real data after soft launch.

## 5. KPIs
D1 / D7 / D30 retention · sessions/DAU · rewarded views/DAU · ad ARPDAU · IAP conversion · store rating (keep ≥ 4.7) · crash-free users ≥ 99.5% · organic share of installs.
