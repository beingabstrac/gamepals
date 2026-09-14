# Sliding Puzzle

Status: built (2026-09-14).

## The real game
- The 15 puzzle and its cousins: numbered tiles in a square frame with one empty space. Slide tiles into the space until they are in order, 1 in the top left and the space in the bottom right.
- Tiles in the same row or column as the space can be pushed along together. Moves are usually counted one tile at a time.
- **Only half of all layouts can be solved** (a parity rule). Physical puzzles are always solvable because they start solved and are only ever slid.
- Sizes: 3×3 (8 puzzle), 4×4 (the classic 15), 5×5 (24 puzzle). The hardest positions need 31 single-tile moves on 3×3 and 80 on 4×4.
- Source: [15 puzzle, Wikipedia](https://en.wikipedia.org/wiki/15_puzzle).

## What makes it feel right
1. Tiles that glide and stop, never teleport.
2. Pushing a whole row at once, like a real puzzle.
3. Seeing each finished row click into place.
4. A move counter to beat next time.

## How the best apps do it
Classic 15-puzzle apps offer 3 sizes, a move counter, tap or swipe controls and color hints for rows. Reviewers complain about unsolvable shuffles in badly made clones and tiny tiles on phones.

## Our design
- **Board:** white frame, big rounded tiles colored by the row they belong in (tomato, peach, sunny, mint, sky), bold white numbers.
- **Levels:** 3 by 3, 4 by 4, 5 by 5.
- **Shuffle:** hundreds of random real slides from the solved puzzle (never undoing the last one), so every puzzle is solvable, like a real one.
- **Controls:** tap a tile in the space's row or column (the tiles between slide too), swipe a tile toward the space, or use the arrow keys.
- **Motion:** tiles glide with ease-out; a blocked swipe nudges; solving sends a pop wave across the board.
- **Bot:** only used for autoplay tests; it solves by retracing the path back from the solved puzzle.
- **Different from our other games:** the only spatial puzzle where every tile moves through one empty space.

## Tests
Shuffles are solvable (parity check) and not already solved; tapping along a row slides several tiles and counts each; tiles outside the space's row and column can't move; retracing solves it and wins; the bot finishes every size and games replay exactly.
