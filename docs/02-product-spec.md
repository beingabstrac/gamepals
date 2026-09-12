# 02 — Product spec

## 1. Vision
**Every game, every way to play, one app.** Pick a game, pick who you play with, play — online or offline. No sign-up required to start.

## 2. Play modes

### 2.1 Who you play against
| Mode | Players | Internet | Notes |
|---|---|---|---|
| **Solo** | 1 | No | Puzzles/patience games (Solitaire, Sudoku, 2048…) |
| **vs Bot** | 1 + 1–3 bots | No | 4 tiers: **Easy, Medium, Hard, Expert**. Bots can fill empty seats in any multi-seat game |
| **Same device** | 2–4 | No | Split-screen / pass-and-play. Core of competitor |
| **Nearby** | 2–4 devices | **No** (Bluetooth / local Wi-Fi) | Plane mode multiplayer. Phase 5 |
| **Online – Quick match** | 2–4 | Yes | Random opponent, casual or ranked |
| **Online – Friends & family** | 2–4 | Yes | Invite from friend list, family group, or link/QR |
| **Async (turn-based)** | 2–4 | Yes, intermittently | Make a move, close the app, get notified. Chess, Checkers, Four in a Row, Word games, Sea Battle |

### 2.2 Making solo games social: **Duel & Race**
Solo games get multiplayer through **seeded play**: everyone gets the same deal/board (same random seed) and results are compared.
- **Race** (live): both play the same Sudoku at once, see opponent progress bar.
- **Challenge** (async): "Beat my 2:14 on this deal" link.
- **Daily Challenge**: one seed per game per day worldwide → daily leaderboard.
- **Ghost bot**: race a bot that plays the same seed at the chosen tier.

This is how "all possible combinations" works for every game, not just board games.

### 2.3 Mixed seats
Any seat can be: local human, bot (with tier), online human. Examples:
- Ludo: 2 people on one phone + 2 bots.
- Crazy Eights: me + my brother online + 1 bot.
- Chess: online friend, async, 1 move per day.

Seat-picker screen: 2–4 seat chips, each toggles **You / Friend here / Bot (tier) / Invite online**.

## 3. Bot difficulty (product rules)
- 4 tiers: **Easy** (makes obvious mistakes, fun for kids), **Medium** (casual adult), **Hard** (good player), **Expert** (as strong as we can make it; beats most humans).
- Bots **never cheat** (no peeking at hidden cards/tiles, no rigged dice). Players suspect cheating; honesty is a feature — say so in the store listing.
- Optional "Adaptive" toggle: difficulty shifts ±1 notch after streaks.
- Beating each tier unlocks a badge per game (lightweight goal, not progression economy).

Technical design per game family: [03-game-catalog.md](03-game-catalog.md#bot-design).

## 4. Accounts & identity
- **Guest by default**: device account created silently on first launch. Everything offline works with no account.
- Upgrade to a permanent account when user wants online/friends/cloud save: **Sign in with Apple, Google, email**. (If Google login is offered on iOS, Sign in with Apple is required.)
- Profile: username (filtered), avatar (preset picker, no photo upload in v1), country flag (optional), per-game stats.
- Account deletion in-app (required by both stores).

## 5. Friends, family, contacts
| Feature | How | Phase |
|---|---|---|
| Friend code | 8-char code on profile, type to add | 3 |
| Invite link | Deep link `<domain>/i/<code>` → opens app or store; works via WhatsApp/iMessage | 3 |
| QR code | Show/scan in person | 3 |
| Username search | Search by exact username | 3 |
| Recent opponents | "Add friend" after an online match | 3 |
| Platform friends | Game Center (iOS) / Play Games (Android) friends import | 4 |
| Phone contacts match | **Opt-in**, hashed phone numbers, only after explicit prompt. Adds privacy/legal weight — only if data shows demand | Later |
| **Family group** | Private group (up to ~12), invite by link/QR. Shared family leaderboard, family tournaments, "whose turn" feed | 3 |
| Groups/clubs | Friend groups beyond family (school, office) — same system as family | 4 |

Safety: no free-text chat. **Emotes + preset phrases** ("Good game!", "Your turn!", "Rematch?"). Block & report on every profile. Under-13 accounts: friends only via in-person QR or family group invite (see [07](07-compliance-legal.md)).

## 6. Leaderboards
Dimensions: **game × scope × period**.
- Scope: Global · Country · Friends · Family/group
- Period: Daily · Weekly · All-time
- Types:
  - **Rating** (Glicko-2) per game for online PvP — used for matchmaking and ranked boards.
  - **Score/time** per game for solo games (best time, fewest moves, highest score).
  - **Daily Challenge** board per game.
  - **Bot ladder**: wins vs Expert bot.
  - **Overall Game Pals level**: sum of badges/wins across games (one fun global number).
- Offline results are queued and submitted when back online (see §8). Only verified results can reach Global/Country top 100.

## 7. Core screens
1. **Home**: continue last game, Daily Challenges, "your turn" async games, friends online, game grid (categories: Board · Cards · 2–4 Players · Puzzle · Word · Reflex).
2. **Game page**: rules (short + illustrated), mode picker, seat picker, bot tier, variant settings (e.g. Ludo house rules), leaderboard tab, your stats.
3. **In game**: pause, undo (rewarded or free on Easy), hint (rewarded), emotes, rematch.
4. **Result**: winner, rating change, rematch, share result card, add friend.
5. **Friends & Family**: list with presence, invites, family feed.
6. **Leaderboards hub**.
7. **Profile & settings**: account, language, sound/haptics, dark mode, colorblind mode, left-handed layout, privacy, Remove Ads / Pro, restore purchases.

## 8. Offline behavior (the plane test)
The whole app must pass: **enable airplane mode after install, open the app, play every non-online mode of every game, with no errors or blocked screens.**
- All launch games bundled in the binary. Optional downloadable packs later, but a downloaded pack must then work offline too.
- Stats, badges, results stored locally (SQLite); synced to cloud save when online. Merge rule: stats/counters merge by max/sum per event log; settings last-write-wins.
- Offline scores queued with the seed + move log so the server can verify them later.
- **Ads offline:** if no rewarded ad is available, grant the reward anyway (limit N per hour). Rewards feel generous → better reviews; it's what JindoBlu does implicitly.
- Pro / Remove Ads entitlement cached locally; re-validated when online.
- Online-only buttons stay visible but show "Connect to play online"; never crash or spin.

## 9. Accessibility & polish
- Colorblind-safe piece colors, large text support, VoiceOver labels on menus (board-game accessibility later).
- Haptics on key events; sound on/off; left-handed mode.
- Same-device games: each player's UI rotated to face them (2P: top/bottom; 4P: four sides).
- Tablet layouts for iPad/Android tablets (boards grow, not stretch).
- Localization from launch: English, Hindi, Spanish, Portuguese (BR), Indonesian; then French, German, Turkish, Russian, Vietnamese, Arabic (RTL).

## 10. Non-goals (v1)
Free-text chat, photo avatars, real-money prizes, loot boxes, energy systems, pay-to-win anything.
