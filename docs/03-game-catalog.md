# 03 — Game catalog

## Selection rules
1. High search demand (classic names people type into the store, and current hits).
2. Works in as many modes as possible (see matrix).
3. Market-specific picks: Ludo & Carrom-style (India), Dominoes (LatAm), Truco-style card games (Brazil) later.
4. **Trademark-safe names only** (see §4). Game mechanics aren't copyrightable; names, logos and art are.
5. Small scope per game: 1–3 weeks each once the framework exists.

## 1. Launch 12

Legend: ● full support · ◐ via Race/Challenge (seeded) · — not applicable

| # | Game | Solo | Bot | Same device | Online live | Async | Players |
|---|---|---|---|---|---|---|---|
| 1 | Tic-Tac-Toe (+ Ultimate variant) | — | ● | ● | ● | ● | 2 |
| 2 | Four in a Row | — | ● | ● | ● | ● | 2 |
| 3 | Checkers (intl + US rules) | — | ● | ● | ● | ● | 2 |
| 4 | Chess | — | ● | ● | ● | ● | 2 |
| 5 | Ludo | — | ● | ● | ● | ● | 2–4 |
| 6 | Reversi | — | ● | ● | ● | ● | 2 |
| 7 | Dots & Boxes | — | ● | ● | ● | ● | 2–4 |
| 8 | Sea Battle | — | ● | ● (pass & hide) | ● | ● | 2 |
| 9 | Crazy Eights (card game) | — | ● | ● (pass & hide) | ● | ● | 2–4 |
| 10 | Air Hockey | — | ● | ● | ● (realtime) | — | 2 |
| 11 | Solitaire (Klondike) | ● | ◐ ghost | ◐ | ◐ Race | ◐ Challenge | 1 |
| 12 | Sudoku | ● | ◐ ghost | ◐ | ◐ Race | ◐ Challenge | 1 |

Why these: 1–7 are the most-searched board classics and pure turn-based (cheap to put online + async). Ludo is the India growth lever. 8–9 add hidden-information games. 10 is the signature 2-player reflex game. 11–12 are the biggest solo search terms.

## 2. Backlog (add ~2 per month)
- **Board:** Backgammon, Snakes & Ladders, Mancala, Nine Men's Morris, Gomoku (five in a row), Go 9×9, Chinese Checkers, Dominoes, Carrom-style disc game, Hex.
- **Cards:** Hearts, Spades, Go Fish, Rummy, Gin Rummy, War, Speed/Spit, FreeCell, Spider Solitaire, Pyramid Solitaire.
- **Party / 2–4 on one device:** Pong duel, sumo push, tank duel, tug of war, reaction tap, penalty shootout, snake battle, finger race, mini-golf, pool (8-ball physics), bomb pass.
- **Puzzle (solo + race):** Minesweeper, 2048, Water Sort, Nonogram, Mahjong solitaire, Block puzzle (NOT falling-block/Tetris-like), Nuts & bolts, Word search.
- **Word:** 5-letter word guess duel, word grid (find words), hangman, anagram race.
- **Brain / trivia:** Math duel, memory match, quiz duel (needs content — later).

## 3. Bot design
Common knobs every bot exposes: `thinkTimeMs`, `blunderRate`, `searchBudget`, `evalNoise`. Tier table is data (ScriptableObject/JSON), tunable via remote config without an app update.

| Family | Games | Algorithm | How tiers differ |
|---|---|---|---|
| Perfect-information, small | Tic-Tac-Toe, Four in a Row, Dots & Boxes, Reversi, Checkers, Gomoku | Alpha-beta minimax (iterative deepening, transposition table) | Depth 1 / 3 / 6 / max-in-time-budget; Easy also has 30% random-move rate, Medium 10% |
| Chess | Chess | **Own engine**: alpha-beta + piece-square tables + quiescence; opening book (own/permissive) | Target strengths ≈ 800 / 1200 / 1600 / 2000+ Elo via depth + blunder rate. **No Stockfish** (GPLv3 conflicts with App Store); if needed, evaluate permissively-licensed engines only after legal check |
| Dice + board | Ludo, Backgammon, Snakes & Ladders | Heuristic policy (capture > safe square > advance furthest); Expert = expectimax 1–2 plies | Easy picks randomly among legal moves 40% of the time |
| Hidden-info cards | Crazy Eights, Hearts, Spades, Rummy | Rule-based heuristics; Hard/Expert = determinized Monte Carlo (sample hidden hands consistent with what's been seen) | Easy forgets played cards; Expert tracks all cards. **Never looks at real hidden hands** |
| Hidden-info board | Sea Battle | Hunt/target with probability density map | Easy = random shots; Expert = full probability map + parity |
| Realtime physics | Air Hockey, Pong, Sumo, Tank | Predict puck/ball trajectory, move paddle to intercept | Reaction delay 350/220/140/80 ms, aim error, max speed cap |
| Solo puzzles | Solitaire, Sudoku, Minesweeper | Solver generates **solvable** deals; "ghost" plays the same seed at a target pace | Tier = ghost's pace + puzzle difficulty rating |
| Word | Word guess, word grid | Dictionary search | Vocabulary size by tier (common 3K words → full dictionary) |

Bots run on a background thread with a hard time budget (≤ 1s on low-end Android; Expert may use up to 2s with a "thinking…" indicator).

## 4. Trademark-safe naming
| Don't use | Use instead |
|---|---|
| Connect 4 (Hasbro) | Four in a Row |
| Uno (Mattel) | Crazy Eights |
| Battleship (Hasbro) | Sea Battle |
| Othello (trademark) | Reversi |
| Scrabble / Words With Friends | own word game name |
| Boggle | Word Grid |
| Wordle (NYT) | 5-Letter Word Duel |
| Yahtzee | Dice Poker / Five Dice |
| Monopoly, Risk, Catan, Tetris | don't make these; avoid lookalike trade dress for Tetris entirely |
| Carrom (generic in India but check) | Disc Pool / Carrom-style — verify locally |

Chess, Checkers, Ludo, Reversi, Solitaire, Sudoku, Mancala, Backgammon, Dominoes, Go, Gomoku, Hearts, Spades, Rummy, Minesweeper, 2048 are generic.

## 5. Per-game definition of done
- Rules engine + unit tests (legal moves, win/draw detection, edge cases).
- All supported modes from the matrix work, incl. offline.
- 4 bot tiers tuned (Easy beatable by a 7-year-old; Expert beats the dev).
- Tutorial (≤ 3 screens) + full rules page.
- Rewarded placements wired (undo/hint/extra try where it fits).
- Leaderboard + stats events.
- Phone + tablet layouts, rotated UI for same-device seats.
- Localized strings.
- Store screenshot + 15s trailer clip + YouTube Short.
