# 2248

Status: brief (2026-09-24). From the catalog's puzzle list (docs/12 D). "2248" is the common name for the number-chain merge genre (several apps use it and variants); numbers are not a trademark. Id `chain-merge`.

## The genre
A grid full of numbers, each a power of two. Drag a line through touching numbers (including corner to corner): the first two must be the same, and each number after that the same as the one before it or double it. Let go and the chain becomes one number at its end, worth its total rounded up to the next power of two; the others vanish, the column drops, and new numbers fall in from the top. The reference apps go on for ever, the numbers climbing into millions.

## What makes it feel right
1. The long chain: 2, 2, 4, 4, 8, 16 swept in one drag and a 64 popping out.
2. Seeing the result before you let go.
3. The grid falling into place after.

## How it differs from our other number games
2048 slides every tile at once with four swipes; Number Match crosses out pairs that match or make ten. Here it is one drawn chain, as long as you can make it, and the drag is the whole game.

## Our design
- A 5 by 7 grid, big candy tiles, each power of two its own color, 1K and up written as 1K, 2K, 4K.
- **Drag through the chain**; a thick line follows your finger, drag back over the last tile to take it off, and a bubble over the end shows what letting go will make.
- **A game has to end**, and the real one does not, so ours is **thirty chains to make 4K (4096)**. Run out of chains (or of any two touching numbers the same) and it is over, showing your best tile.
- New numbers are mostly small; the smallest on offer creeps up as your best tile grows, so the grid never fills with 2s you cannot use.
- Keyboard: arrows move a ring, Enter adds the ringed number to the chain (or starts one), Enter on the last number lets go, Backspace takes the last one off, Escape drops the chain.
- Moves are paths, thousands of them, so the state answers `allows` (like Code Breaker and Pool) and `legalMoves` is a spread for bots and tests: every touching pair and the longest easy chain grown from each.

## Bots
For tests and autoplay. Easy picks any chain; Medium the chain making the biggest tile, low on the grid; Hard and Expert also count how many chains the board is left with. Over thirty seeds, in thirty chains Medium and Hard make 4K or more about four times in five, Easy never gets past 1K.

## Tests
The chain rule; the rounded sum; neighbours across corners but not the edge, and bad moves parsed out; a chain leaves one tile at its end, the rest fall and new ones drop in; a chain that breaks the rule, jumps a gap or doubles back is refused; every move offered is one the rules take, and the referee replays a whole game to the same result; the goal wins and the thirtieth chain ends it; the greedy bot gets further than the random one. Invariant, every chain of bot play: every cell holds a number, the score only climbs, the best tile never shrinks.
