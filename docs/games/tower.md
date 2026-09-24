# Tower

Status: brief (2026-09-24). From the catalog's board list (docs/12 B). The block-stacking game (a trademarked name elsewhere) is called Tower here, per the naming rule in docs/03.

## The real game
Fifty-four wooden blocks in eighteen rows of three, each row laid across the one below. Players take turns pulling one block out of any row below the top (one hand only) and laying it on top to build new rows. Whoever makes the tower fall loses. The skill is a steady hand and choosing blocks that are loose: a row can lose both side blocks and still stand on its middle one, but lose the middle first and both sides must stay.

## What makes it feel right
1. The slow, careful draw of a block, and holding your breath.
2. The tower getting taller and wobblier.
3. The crash.

## Our design
- **Side on, in 2D**: each row has three places, left, middle and right, drawn in warm wood with grain turned on alternate rows as a real stack is laid.
- **Drag a block sideways out of the tower** (not from the top row or the one under it), then tap a free place on the top row for it (a full top row starts a new one; with one free place it goes there by itself). Keyboard: arrows pick a block, Enter pulls it, Left, Right and Enter place it.
- **The tower stands or falls by its weight**: for every row, the middle of everything above must sit over the row's blocks (a middle block alone holds a centred load; one side block alone does not). If it does not, the tower falls and the player who pulled loses; everyone else wins.
- **A steady hand counts**: every pull has a small chance to wobble the tower over, higher the taller the tower and the thinner the row that carries the weight, and lower the more careful the pull. A person's care is how slowly they drew the block out (a draw over 0.7 s is fully careful, a yank barely counts); a bot's is its steadiness. The roll is seeded, so a game replays exactly.
- 2 to 4 players on one phone or with bots.
- The tower sways a little after every pull and topples block by block, the higher ones further, when it goes.
- Care makes the moves a large space (0 to 100 per pull), so the state answers `allows` and `legalMoves` is a spread at a middling care.

## Bots
Easy often grabs any block and pulls roughly; the others take the safest pull, more carefully the better they are. Hard and Expert take the sides of a full row before its middle (so the row can give two), and Expert also leaves the next player as few safe pulls as it can. Luck plays its part, as with a real one: Hard beats Medium about seven times in ten, Expert and Hard come out even.

## Tests
A full tower stands square, a side block alone under a centred load falls, a middle alone or two sides stand; pulls come from below the top two rows and land on top; the next block goes in a free place and a full top row starts a new one; a pull that leaves a row unable to hold what is above brings it down and that player loses; a careful pull wobbles less than a rough one, a taller tower more; any care is a move and the referee replays a game; careful bots last longer than careless ones. Invariant, every move: blocks are neither made nor lost, and no row below the top is empty.
