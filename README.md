# Game Pals

One app with every classic and party game, playable **any way you want**: solo, vs bot (Easy → Expert), 2–4 players on one device, with friends & family, or against anyone in the world — and **everything except online play works fully offline**.

Platforms: iPhone, iPad, Android, Web — one TypeScript codebase (Phaser 4 + Capacitor), built for $0 with free tiers.

## Quick start (cloud, nothing installed locally)
1. On GitHub: **Code → Codespaces → Create codespace on main**. The dev container installs Node 22, pnpm and Claude Code.
2. In the Codespace terminal: `pnpm dev`, then open the forwarded port 5173 (set it to Public to open it on your phone).
3. `pnpm test` runs the rules and bot tests; CI runs typecheck, tests and build on every push.

## Structure
```
apps/client/      Vite + Phaser 4 + Preact app (web, and the app inside Capacitor)
packages/rules/   Pure TypeScript game rules + bots, shared by client, tests and server
docs/             Research, spec, catalog, architecture, roadmap, budget
```
Coming next: `apps/mobile` (Capacitor iOS/Android), `apps/server` (Cloudflare Workers).

## Docs
| # | Doc | What's inside |
|---|---|---|
| 01 | [Research](docs/01-research.md) | Competitor teardown (JindoBlu), market data, podcast notes, engine research |
| 02 | [Product spec](docs/02-product-spec.md) | Every play mode and combination, social, leaderboards, offline behavior, screens |
| 03 | [Game catalog](docs/03-game-catalog.md) | Launch 12 + backlog, mode support per game, bot design, trademark-safe names |
| 04 | [Tech architecture](docs/04-tech-architecture.md) | Phaser + Capacitor + Cloudflare + Firebase, game contract, networking, offline, cloud dev |
| 05 | [Monetization](docs/05-monetization.md) | Rewarded-first ads, Remove Ads, Pro, web, revenue model |
| 06 | [Growth & ASO](docs/06-growth-aso.md) | Store listing, keywords, YouTube/web funnel, cross-promo, localization |
| 07 | [Compliance & legal](docs/07-compliance-legal.md) | Kids/COPPA, age laws, privacy prompts, trademarks, licenses |
| 08 | [Roadmap](docs/08-roadmap.md) | Milestones M0–M5 with deliverables |
| 09 | [Naming](docs/09-naming.md) | Why "Game Pals", availability checks |
| 10 | [Zero-budget plan](docs/10-zero-budget-plan.md) | Free stack, free-tier limits, launch order, money expectations |
| 11 | [Visual design & game feel](docs/11-visual-design.md) | Style, fonts, colors, motion, sound, haptics, per-game juice checklist |

Raw research: [docs/research/](docs/research/) (podcast + YouTube transcripts). Asset licenses: [docs/licenses.md](docs/licenses.md).
