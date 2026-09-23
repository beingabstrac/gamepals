# Sweeper

Status: brief (2026-09-23). Rules: the mine-clearing puzzle that shipped with Windows 3.1 in 1992 and has been cloned everywhere since. The mechanic is not owned; the product name is Microsoft's, so ours is Sweeper ([03 §4](03-game-catalog.md#4-trademark-safe-naming)).

## The real game
- **A grid of covered squares, some hiding mines.** The classic sizes are 9 by 9 with 10 mines, 16 by 16 with 40, and 30 by 16 with 99.
- **Uncover a square.** A mine ends the game. Anything else shows how many of its eight neighbours are mines.
- **A zero opens its neighbours by itself**, and so on outward, which is why one lucky tap can clear half the board.
- **Flag a square** you believe is a mine. Flags are only notes: they stop an accidental uncover and nothing else.
- **Chording:** on an uncovered number whose flags around it already add up to it, uncover every other neighbour at once. A wrong flag makes that a mine, and you lose.
- **The first uncover is never a mine.** Windows moved the mine elsewhere; most modern versions clear the whole ring around the first square too, so the first tap always opens a region.
- **You win by uncovering every square that is not a mine.** Flagging is never required.

## What makes it feel right
1. The first tap opening a big region and giving you somewhere to start.
2. Seeing a 1 in a corner and knowing, with certainty, which square it means.
3. The chord: one tap on a finished number sweeping away its neighbours.
4. Being sure. The worst moment in the game is the 50-50 at the end of an otherwise perfect board, where logic runs out and a coin decides.

## How the best ones do it
Simon Tatham's Mines, the most respected free version, guarantees every board can be solved by logic alone from the first square: nobody ever loses to a coin. Good phone versions let you tap to uncover and long-press to flag, keep a visible toggle for people who cannot long-press, and chord when you tap a finished number. They show how many mines are left to find, count against your flags rather than against the truth, and never punish a flag.

## Our design
- **No guessing, ever.** When the first square is uncovered, mines are laid round it with its whole ring kept clear, and the board is checked by a logic solver from that first square; a board the solver cannot finish is thrown back and laid again. Measured before building: under a millisecond a board on average at every size, 30 redraws at the very worst on the hardest board, and first squares in a corner cost no more than ones in the middle.
- **The mines are laid on the first uncover**, from the seed and that square, so the same seed and the same taps always give the same board. That is what lets the server replay a game exactly.
- **Three sizes for a phone held upright**: 8 by 10 with 10 mines, 10 by 14 with 22, 12 by 18 with 40. The densities follow the classic three, and 12 across is as narrow as a square can go and still take a thumb.
- **Moves**: uncover (`r`), flag or unflag (`f`), and chord (`c`). `legalMoves` lists every uncover of a covered square that is not flagged, every flag toggle of a covered square, and every chord on a number whose flags already add up to it.
- **Touch**: tap to uncover, long-press to flag, tap a finished number to chord, and a Dig / Flag toggle beside the board for anyone who would rather not long-press. **Keyboard**: arrows move, Enter or Space uncovers, F flags.
- **The count** shows mines left to find as mines minus flags, like every version does, and can go negative.
- **Losing shows the board**: every mine, the one you hit marked, and any flag that was wrong.
- **Bots** are autoplayers using the same solver, flagging what they have proved and uncovering what they have proved safe. On a board built to need no guess, they never lose.

## Tests
The first uncover is never a mine and always opens a region; mines laid are exactly the count asked for; numbers match their neighbours; a zero floods outward and stops at numbers and at flags; a flag stops an uncover; unflagging works; a chord uncovers the right squares and loses on a wrong flag; winning needs every safe square and no flags; `legalMoves` lists exactly what `apply` accepts; the same seed and taps give the same board; and **no board ever needs a guess**, shown by the bot winning every board of every size with a random-number source that throws if it is touched. That proof only works because the solver reads nothing but the numbers on uncovered squares, so a separate test checks it cannot see through the covers: two boards that look alike from above get the same answer.
