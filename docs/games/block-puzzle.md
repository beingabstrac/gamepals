# Block Puzzle

Status: brief (2026-09-24). Rules: the grid-filling puzzle behind the "wood block" and "1010!" family of apps (their names are other people's products): place pieces on a square grid, and full rows and columns clear. No falling pieces and no turning, so it is not a falling-block game (docs/03 keeps us away from those).

## The real game
- **An 8 by 8 grid** and **three pieces dealt at a time**, of a couple of dozen shapes: bars, squares, Ls, Ts and so on. Pieces cannot be turned.
- **Place them anywhere they fit**, in any order. When all three are down, three more come.
- **A full row or column clears**, and clearing several at once scores more.
- **The game ends when none of the pieces in hand fits.**

## What makes it feel right
1. A piece snapping into place.
2. Two lines going at once.
3. Holding out for the long bar.

## Our design
- **Drag a piece up from under the grid**: it rides above your finger so you can see where it will go, and the grid shows green where it fits and red where it does not. Or tap a piece and then a square for its top-left corner.
- **Scoring**: a point per square placed, and ten times the square of the lines cleared at once, more on a streak of clearing moves (up to three times). "Double!" and "Amazing!" when several go.
- **A goal of 500 points** counts as a win, like reaching 2048; the score shows either way.
- **Pieces in hand that fit nowhere fade**, so you can see the end coming.
- **Keyboard**: 1 to 3 pick a piece, arrows move it, Enter drops it, Escape puts it back.
- **Test play** takes the move that clears most, else the one that leaves the most room.

## Tests
Shapes start at their top-left and never repeat a cell; a piece fits only on empty squares inside the grid; a full row clears, a full column clears, and both at once count each square once; three placed deals three more from the seed; the game ends when nothing in hand fits; test play goes on a long while; the same seed deals the same pieces. Invariant, every move of random games: the board holds what was placed less what was cleared, and the score only goes up.
