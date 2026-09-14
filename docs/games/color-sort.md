# Color Sort

Status: built (2026-09-14). Our name for the "water sort" / "ball sort" puzzle genre (generic genre; we use our own name and art).

## The real game
- Tubes hold up to 4 layers of colored water. Tap a tube, then another: the top color pours across, **only onto an empty tube or onto the same color**, and as much of that color as fits moves at once.
- You win when every tube is either empty or full of one color.
- Usually 2 extra empty tubes give room to work. Deciding if a layout can be solved at all is NP-complete, and finding the shortest solution is too, so good apps only give layouts they have checked.
- Sources: [Sorting Balls and Water: Equivalence and Computational Complexity (arXiv 2202.09495)](https://arxiv.org/pdf/2202.09495) · [optimal solver notes (Kociemba)](https://github.com/hkociemba/WaterBallSortPuzzleOptimalSolver)

## What makes it feel right
1. The pour: the tube tilts and the color flows across, landing with a little splash.
2. A tube filling with one color and "closing" with a pop.
3. Calm, no timer; unlimited undo.
4. Colors that are easy to tell apart at a glance.

## How the best apps do it
Water Sort Puzzle and similar apps: tap to lift a tube, tap to pour, undo, restart, an extra-tube power-up, levels growing from 3 to 12 colors. Reviewers complain about ads between levels, look-alike colors and unsolvable levels.

## Our design
- **Levels:** Easy (4 colors), Medium (7), Hard (10), each with 2 empty tubes. Every deal is checked by our solver before it is shown, so it can always be solved.
- **Look:** glass tubes in white with a soft outline; 4 layers per tube in our bright candy colors plus a distinct shape mark on each color for color-blind players.
- **Controls:** tap a tube (it lifts), tap another to pour. Keyboard: 1 to 9 and 0 pick tubes, or arrows and Enter.
- **Help:** unlimited undo, restart, and a hint (the solver's next pour) with a count of hints used.
- **Motion:** lifted tube floats; pour tilts the tube along an arc and the layers flow; a finished tube pops with a cork.
- **Bot:** the solver, used for hints and autoplay tests.
- **Different from our other games:** a pouring puzzle about order and space, with no numbers.

## Tests
Pours follow the rules (same color or empty, as much as fits); illegal pours throw; every dealt level is solvable and not already sorted; winning is detected; undo restores; the solver's hint is always legal and leads to a win; replay is exact.
