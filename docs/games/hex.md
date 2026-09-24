# Hex

Status: brief (2026-09-24). Rules: the connection game invented by Piet Hein (1942) and independently by John Nash (1948), on the standard 11 by 11 board, with the swap (pie) rule. Rules as in [Wikipedia, Hex (board game)](https://en.wikipedia.org/wiki/Hex_(board_game)). The name is the generic name of the game; nobody's product.

## The real game
- **A rhombus of 11 by 11 hexagons.** Red owns the top and bottom edges, Blue the left and right.
- **Players take turns placing one stone** on any empty cell. Stones never move.
- **Join your two edges with an unbroken chain** to win. Somebody always does: a full board has exactly one winner.
- **The swap rule**: going first is a big advantage, so after the first stone the second player may take it over (reflected across the long diagonal, as the colors swap edges) instead of playing.

## What makes it feel right
1. The bridge: two stones with two shared empty neighbors, which cannot be cut.
2. Racing and blocking at the same time.
3. The chain lighting up when it gets through.

## Our design
- **Red bands along the top and bottom, blue down the sides**, white cells, stones with a lip that drop with a squash, the last stone dotted, the winning chain dotted white.
- **Tap a cell**; after Red's first stone Blue sees **Swap: take that stone**.
- **Keyboard**: arrows move, Enter places, S swaps.
- **Bots** use Monte Carlo with all-moves-as-first: fill the board at random thousands of times and score each cell by how often the fills where it was ours were won (a filled Hex board always has one winner, so the playouts need no rules at all). They take a win and block one, and swap a first stone near the middle. 200 to 40,000 playouts by tier; Expert runs in the worker. Flat sampling levels off, so Expert is only a little ahead of Hard.

## Tests
Red joins top to bottom and wins; chains bend along the six hex neighbors and not along the wrong diagonal; the swap is only for Blue straight after the first stone, and reflects; a full board always has exactly one winner; a bot takes a win and blocks one; more playouts win more. Invariant, every move of random games: the game ends exactly when someone joins their edges, and never before.
