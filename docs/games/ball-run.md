# Ball Run

Status: brief (2026-09-25). From the catalog's puzzle list (docs/12 D). Pipe and track rotation puzzles are a long-standing generic genre (the "pipes" or "plumber" puzzle); the name is ours.

## The genre
A grid of pieces, each a bit of track or pipe: straight, bend, T or cross. Tap a piece to turn it. Join a continuous route from the start to the goal and whatever travels along it (water, a ball) goes through. The good ones show what already joins up, so the player can follow it and fix the first break.

## Our design
- A square grid of candy tiles with a sky blue groove; three sizes as levels: 5, 6 and 7 across.
- **Tap a piece to turn it a quarter turn** (a cross looks the same every way round, so it cannot be turned). The track that already runs on from the ball lights green.
- **Every board is laid from a real path first** (a random walk from a cell on the left edge to one on the right that never crosses itself), then every piece on it is turned the wrong way and the rest of the grid is filled with random pieces. So a board can always be joined, and **par** is the number of turns the laid path needs. Any route home counts, not only the laid one.
- When the track reaches the flag, the ball rolls along it and home.
- Keyboard: arrows move a ring, Enter turns.

## Tests
A quarter turn moves every side one step clockwise; every board of every size (forty seeds each) starts unjoined and is joined by turning its path, within par; a tap turns one piece and a cross is never a move; the referee replays a solved board.
