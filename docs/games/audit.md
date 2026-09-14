# Game audit: true to the real game?

Checked 2026-09-13. Each game is compared with its real rules (see its brief) and with the owner's rules for look and feel: clear controls, real motion and physics, plain words.

| Game | True to the real game | Controls | Motion and physics | Gaps fixed / left |
|---|---|---|---|---|
| Tic-Tac-Toe | Yes: 3×3, three in a row, draw when full | Tap a square | Marks drawn like a pen, winning line, small shake | None |
| Four in a Row | Yes: 7×6, discs fall, four in any line | Tap a column | Discs fall with gravity and bounce | None |
| Ludo | Yes: 6 to leave the yard, capture sends home, safe stars, exact roll home, extra roll on 6 | Roll, then tap a token | Tokens hop in arcs, capture spin | **Fixed:** three sixes in a row now ends the turn |
| 2048 | Yes: slide all tiles, one merge per tile per move, 90% 2s / 10% 4s | Swipe or arrow keys | Tiles slide, merges pop, new tiles spring in | None |
| Air Hockey | Yes: puck, mallets, goals, first to 7 | Drag your paddle | Real puck physics, rail bounces | None |
| Ping Pong | Yes: one bounce each side, serve rules, net, to 11 win by 2 | Swipe toward the net | Ball arcs with height and shadow | Spin is planned |
| Tug of War | Yes: pull the marker over your line | Tap fast | Rope with momentum and drag | None |
| Reflex Race | Yes (party game): wait for green, first tap wins, false start loses | Tap your half | Big light pops | None |
| Sumo | Yes: push out of the ring | Drag to move, tap to shove | Weight, momentum, clinch friction | None |
| Penalty Kicks | Yes: 5 kicks each, early finish, sudden death, roles swap | Swipe to shoot, drag and flick to dive | Curling ball, diving keeper | None |
| Snake Battle | Yes: grid snake, crashes lose, head-on draw | Turn buttons | Snakes glide between cells | None |
| Sudoku | Yes: 9×9, one answer, levels by solving tricks, notes, mirrored clues | Tap a square, tap a number | Numbers pop in, repeats shake, finished lines sparkle | Race mode is planned |
| Solitaire | Yes: Klondike, alternating colors down, King to empty column, foundations by suit, draw 1 or 3, unlimited redeals, standard scoring | Tap to auto-move, drag, tap the deck | Cards fly with ease-out, flip with a squeeze, lean while dragged, bounce down on a win | Winnable-deal solver, Race |
| Memory | Yes: Concentration rules, a match keeps your turn, most pairs wins, ties possible, solo counts turns | Tap two cards | Cards flip with a squeeze, pairs fly to the scorer, misses shake then flip back | Online play (M3) |
| Sliding Puzzle | Yes: 15 puzzle rules, tiles slide into the one space, whole rows push together, shuffled only by real slides so always solvable, moves counted per tile | Tap, swipe or arrow keys | Tiles glide and stop, blocked swipes nudge, a pop wave on solving | Race mode, best scores |
| Color Sort | Yes: water sort rules, pour onto the same color or an empty tube, as much as fits, every deal checked solvable by our solver | Tap a tube then another, or keys 1-9 and arrows | Tube lifts, tilts and streams the color across, corks pop on finished tubes | Race mode |
| Echo | Yes: classic sequence game, 4 pads with a chord of tones, one step added per round, wrong press or 5 seconds ends it, goals of 8, 14, 20, 31; party mode where each player adds a step | Tap pads, keys 1-4 or arrows | Pads glow and grow with their tone, a timer ring, the board shakes on a miss | Online party |
| Classic Snake | Yes: solo snake on a walled grid, eat to grow, walls and your own tail end it, speeds up as it grows | Swipe, arrow keys or W A S D, two turns remembered | Smooth gliding, fruit pops, crash shake, best score saved | Race mode |
| Checkers | Yes: English draughts, men forward, required captures and multi-jumps, crowning ends a jump, kings both ways, draw after 40 quiet moves each or threefold repetition | Tap a piece then a glowing square, arrows and Enter | Slides, arcing hops, taken pieces fly off, a crown drops on new kings | Other national rules as options |

Look and feel rules applied to every game (2026-09-13):
- Bright candy colors, no pastels, no gradients.
- Text faces the people playing. Against a bot, everything faces you, and the bot's controls and hints are hidden.
- A plain "How to play" card (goal, controls, how to win, draw) before each game.
- Plain words everywhere, no em dashes in the app.
