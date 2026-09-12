# 07 — Compliance & legal

Not legal advice — have a lawyer review before global launch. Checklist of what applies to this app.

## 1. Children & age
This app appeals to kids, so treat it as **mixed audience** (not child-directed).
- **Neutral age screen** on first launch (birth year picker, no hint of the "right" answer).
- Under 13 (or local age of consent for data, e.g. 16 in parts of the EU):
  - Non-personalized ads only; only **Google Play Families self-certified ad SDKs/networks**; set COPPA/child flags in MAX and each network.
  - No online play with strangers; friends only via family-group invite or in-person QR; no username search.
  - No purchases prompts beyond platform parental controls.
- **COPPA** (US) — FTC amended rule finalized Jan 2025 (mixed-audience definition, privacy notice, data retention). Collect minimum data.
- **US App Store Accountability Acts** (Texas from 2026-01-01, Utah 2026-05-06, Louisiana 2026-07-01; more states coming): use **Apple Declared Age Range API** and Google's age-signals API to get age category (under 13 / 13–15 / 16–17 / 18+) and parental consent signals; respect them for features and purchases.
- **Google Play**: fill the target audience & content form honestly; if under-13 is a target age group the Families policy applies (certified ads, no personalized ads, no location, etc.).
- **Apple**: age rating questionnaire; if we ever join the Kids category, stricter rules (no third-party analytics/ads without exemptions) — **don't** join Kids category.
- **EU/UK**: GDPR/UK GDPR + Age Appropriate Design Code (UK) — high-privacy defaults for kids.

## 2. Privacy & consent
- Google **UMP** consent form (EEA/UK/Switzerland), US state privacy opt-out.
- Apple **ATT** prompt before IDFA; show pre-prompt explaining why; app works fully if declined.
- Privacy policy + App Store privacy labels + Google Play Data safety form — must match actual SDKs (MAX + networks, Firebase, RevenueCat, Nakama).
- **In-app account deletion** + web deletion page (both stores require it).
- Contacts matching (if ever built): explicit opt-in, hashed, purpose-limited, disclosed.

## 3. Accounts
- Sign in with Apple required on iOS if any third-party login (Google) is offered.
- Username filter (profanity, personal info patterns), report/block, moderation queue.
- No free-text chat in v1 (avoids moderation burden and most child-safety risk).

## 4. Intellectual property
- Use only generic game names (see [03 §4](03-game-catalog.md#4-trademark-safe-naming)). No lookalike art/trade dress of branded games (especially Tetris, Uno, Monopoly).
- Original art or properly licensed assets only; keep a license log (`docs/licenses.md`) for every asset, font, sound.
- **No GPL/AGPL code in shipped apps** (App Store terms conflict). OK: MIT, BSD, Apache-2.0, zlib, CC0. Stockfish (GPLv3) excluded.
- Dictionary for word games: permissively licensed word lists only; filter offensive words.
- App name: run trademark searches (USPTO TESS, EUIPO, WIPO Global Brand DB, India IP) in class 9 & 41 before launch; register if clear.

## 5. Store policies
- Ads: no ads that interrupt gameplay; rewarded ads must deliver the reward; clearly label ads; no deceptive close buttons (Google Better Ads & Play policy).
- Subscriptions: clear price, period, auto-renew terms on paywall; restore purchases button; Apple guideline 3.1.2.
- Loot boxes: none (if ever, disclose odds).
- Bots in online matchmaking: must be disclosed as bots (no fake humans).
- Real-money gambling: none. Keep card games clearly free-to-play with no cash value.

## 6. Company & tax
- Developer accounts: Apple Developer Program ($99/yr), Google Play ($25 one-time). Consider registering a company first so the seller name isn't your personal name (JindoBlu shows seller "Jindoblu Limited").
- Apple Small Business Program / Google 15% tier — apply.
- Tax forms (W-8/W-9 equivalents), ad network payouts, VAT/GST handled by stores for IAP; ad revenue is your income to report.
