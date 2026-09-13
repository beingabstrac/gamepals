# 12 — Master catalog & design direction v2

Written 2026-09-13 after reading all four JindoBlu apps (App Store listings, version histories, reviews) and public board-game lists. **This doc supersedes the visual style in [11](11-visual-design.md)** (dark theme + gradients are out). Motion/feel principles from 11 still apply.

## Part 1 — What players say (JindoBlu reviews)
| App | Rating | Players love | Players complain / ask |
|---|---|---|---|
| Offline Games – No Wifi | 4.8 (54K CA) | Road trips, airplane mode, lots of games in one app | Wants **more instructions**; some doubt review authenticity |
| 2 Player Games | 4.8 (43K CA) | Playing friends/family on one phone, bots when alone, friendly rivalry ("can ruin friendships") | Often alone → needs good bots |
| 1 2 3 4 Player Games | 4.8 (12K CA) | Up to 4 on one device, graphics, solo options | — |
| Antistress | 4.7 (8K CA) | Calm toys, constant new content | **Privacy fears** (thought the app listened/whispered) |

What we do with it:
1. **Teach by playing**: every game opens with a 10-second interactive "try it" (ghost hand shows the move), rules always one tap away. No text walls.
2. **Great bots** with personalities, so playing alone is fun.
3. **Rivalry features**: rematch, running score between the same players, "revenge" button, family leaderboard.
4. **Trust**: no microphone/camera permissions ever; a plain "Your privacy" page; no creepy audio.
5. **Fresh content**: a new game or toy every 2 weeks.

## Part 2 — Master catalog (everything he has, plus more)
Legend: **1P** solo · **2P / 4P** same device · **B** bot · **O** online (M3). ✅ = built.

### A. Party duels on one screen (2–4 players, real-time)
Air Hockey ✅ · Ping Pong · Sumo push · Penalty Kicks · Tug of War · Reflex Race (tap first) · Spinner War · Snake Battle · Sword Duel · Racing Cars (top-down) · Slot Cars · Mini Golf · Golf Football · Pool (8-ball) · Cup Pong · Archery · Target Practice · Throw (darts-like) · Basketball Hoops · Sling Puck · Paint Fight (cover the floor) · Whack-a-Mole · Crash It (bumper arena) · Road Dodge · Wheelie · Stampede (dodge runner) · Gravity Run · Brick Blast (versus breakout) · Tank Duel · Bomb Pass

### B. Board classics (turn-based, B + O)
Tic-Tac-Toe ✅ · Ultimate Tic-Tac-Toe · Four in a Row ✅ · Ludo ✅ (2–4) · Snakes & Ladders (2–4) · Checkers · Chess (+ puzzles) · Reversi · Dots & Boxes · Mancala (Kalah, Oware) · Dominoes (+ Mexican Train) · Backgammon · Nine Men's Morris · Gomoku / Connect Six · Chinese Checkers (2–6) · Go 9×9 · Hex · Sea Battle · Guess the Person · Code Breaker (Bulls & Cows) · Shut the Box · Yatzy / Five Dice · Pachisi & Chowka Bhara (Indian classics) · Royal Game of Ur · Senet · Game of the Goose · Hnefatafl (Viking chess) · Fanorona · Tower (block pull, physics)

### C. Card games (1P + B + O)
Solitaire (Klondike) · Spider · FreeCell · Pyramid · TriPeaks · Crazy Eights · Hearts · Spades · Callbreak (India) · Rummy / Gin Rummy · Go Fish · Old Maid · War · Speed · Memory / Find Match · Pizza Memory

### D. Puzzles & brain (1P, Race/Challenge vs friends)
2048 · 2248 · Sudoku · Petdoku (picture sudoku) · Nonogram · Sliding Puzzle (15) · Jigsaw · Wood/Block Puzzle · Color/Water Sort · Nuts & Bolts · Animal Stack · Multi-Color Fill (flood) · Maze Paint · Sand Fall · Ball Run · Escape (room-lite) · Tap Match / Tile Match · Mahjong Solitaire · Minesweeper · Simon Says · Snake · Matching Numbers · Pointers (arrows) · Maths duel · Word Guess (5 letters) · Word Finder / Word Grid · Hangman · Fruit Merge

### E. Party & social (pass the phone)
Impostor / Werewolf (hidden roles) · Charades · Draw & Guess · Forehead guess (phone on head) · Truth or Dare (family-safe) · Would You Rather

### F. Chill toys (antistress, 1P)
Pop bubbles · Buttons & switches board · Newton's cradle · Bamboo chime · Pond with lotus · Kinetic sand · Clean the window / coin / rug · Straighten pictures · Neon paint · Wood carving · Phone-case DIY · Slime · Dominoes topple · Marble run · Zen garden rake · Bubble wrap

### Build waves
1. **Now:** new look (Part 3) applied to the 4 built games + table setup.
2. **Duels:** Ping Pong, Sumo, Tug of War, Reflex Race, Penalty Kicks, Snake Battle.
3. **Puzzles:** 2048, Sudoku, Solitaire, Snake, Simon, Sliding Puzzle, Memory, Color Sort, Nuts & Bolts.
4. **Board:** Checkers, Chess, Reversi, Dots & Boxes, Snakes & Ladders, Mancala, Dominoes, Ultimate TTT, Yatzy, Shut the Box, Backgammon.
5. **Cards:** Crazy Eights, Spider, FreeCell, Hearts, Spades, Callbreak, Rummy.
6. **Party:** Impostor, Charades, Draw & Guess, Guess the Person.
7. **Chill toys** (a "Chill" shelf).
8. **Heritage:** Ur, Senet, Tafl, Fanorona, Pachisi, Chowka Bhara, Go, Nine Men's Morris.

Naming rule stays ([03 §4](03-game-catalog.md#4-trademark-safe-naming)): Parcheesi → Pachisi, Jenga → Tower, Mastermind → Code Breaker, Guess Who → Guess the Person, Pictionary → Draw & Guess, Yahtzee → Yatzy. Skip meme names (e.g. "Brainrot").

## Part 3 — Design direction v2 (cute, soft, bubbly, crisp)
### Look
- **Light app.** Warm white background `#FFFDF8`, cards `#FFFFFF`, ink text `#2B2A3A`, soft ink `#7A7890`.
- **Flat colors only — no gradients anywhere.** Depth comes from a solid, slightly darker "bottom lip" under each bubble (like a toy button) and one soft shadow, never from color ramps.
- **Candy palette (flat):** tomato `#FF6B6B`, sunny `#FFC93C`, mint `#3DDC97`, sky `#4DA8FF`, grape `#9B7BFF`, peach `#FF9F6B`, bubblegum `#FF8CC6`. Each game owns one color.
- **Shapes:** everything rounded (24–32 px radius), pill buttons, circular icons. Generous white space. Big, friendly type (Fredoka for headings/numbers, Nunito for text).
- **Games are colorful**, sitting on white "trays" with rounded edges — like real toys on a table.
- **Illustration over emoji:** each game tile shows a tiny vector drawing of the actual game (the real board, discs, puck) so the grid looks like a toy shelf, not a generic app. Bots are cute blob characters with faces.
- **Crisp:** vector drawing only (Phaser Graphics, SVG, fonts). Render at the device pixel ratio (canvas sized × DPR, camera zoom = DPR) so nothing is blurry on retina screens. No scaled bitmaps, no pixel art.

### Motion that feels real
- **Springs, not linear tweens:** UI bubbles use spring physics (mass/stiffness/damping) so they overshoot and settle.
- **Real physics where things fall or bounce:** discs fall with gravity and bounce with restitution; tokens hop in arcs and squash on landing; dice tumble and settle; marks are *drawn* like a pen stroke.
- **Animation principles:** anticipation (tiny wind-up before a big move), squash & stretch (keep volume), follow-through, slow-in/slow-out, arcs. UI transitions 200–500 ms.
- Nothing appears instantly: every new thing grows, drops or slides in; every removal shrinks or flies away.

### Decisions are actions, not forms
- **Home = toy shelf.** Tap a game tile → it pops up and flips into the game's **table**.
- **Table setup (replaces the form):** the game board sits in the middle; seats are arranged around it like chairs at a table.
  - Tap an empty seat → a friend (on this phone) sits down.
  - Tap again → a bot joins; the bot's face shows its level: 😴 Pip (easy), 🙂 Bo (medium), 😎 Zed (hard), 🤓 Nova (expert). Tap to swap bots.
  - Long-press / swipe a seat away to leave it empty. Min/max seats come from the game.
  - One big **Play** bubble. Last setup per game is remembered, so a returning player taps Play once.
- **Quick play:** long-press a tile on the shelf to start instantly with the last setup.
- Hick's law: never more than ~5 choices on screen; defaults are always playable.
- **Result = celebration + one obvious next action** (big "Again!" bubble, small "Change players").

### Psychology we use (ethically)
- Early win in the first game (easy bot first time), clear progress (badges per game/bot beaten), rivalry scoreboard between the same players, variable delight (random confetti shapes, bot reactions). No dark patterns, no energy timers, no fake urgency.

## Sources
- JindoBlu App Store pages: [Offline Games](https://apps.apple.com/ca/app/offline-games-no-wifi-games/id6448104157) · [2 Player Games](https://apps.apple.com/ca/app/2-player-games-offline-games/id1465731199) · [1 2 3 4 Player Games](https://apps.apple.com/ca/app/1-2-3-4-player-games/id1635978552) · [Antistress](https://apps.apple.com/ca/app/antistress-relaxing-games/id1207565651)
- [Wikipedia – List of board games](https://en.wikipedia.org/wiki/List_of_board_games) · [Emory/Oxford College game collection](https://guides.libraries.emory.edu/c.php?g=696701&p=4942151)
- [Claymorphism / soft UI trends 2026](https://trends.daisyui.com/) · [Pastel UI on Dribbble](https://dribbble.com/tags/pastel-ui) · [Pixune – mobile game UI examples](https://pixune.com/blog/best-examples-mobile-game-ui-design/)
- [Casual game UX secrets](https://medium.com/@taraneyarahmadi/why-we-keep-playing-the-ux-secrets-behind-casual-game-giants-500832430c77) · [Mobile game onboarding](https://medium.com/@amol346bhalerao/mobile-game-onboarding-top-ux-strategies-that-boost-retention-6ef266f433cb) · [Hypercasual UI/UX guide](https://pixune.com/blog/hypercasual-games-ui-ux-design-guide/)
- [Disney's 12 principles for games](https://gamejuice.co.uk/articles/disney-12-animation-principles-games) · [Squash & stretch (Josh Comeau)](https://www.joshwcomeau.com/animation/squash-and-stretch/) · [12 principles for UI (IxDF)](https://ixdf.org/literature/article/ui-animation-how-to-apply-disney-s-12-principles-of-animation-to-ui-design)
- [Phaser retina/DPR issue](https://github.com/phaserjs/phaser/issues/3198) · [Support retina with Phaser 3](https://supernapie.com/blog/support-retina-with-phaser-3/)
