# Mahjong Solitaire

Status: brief (2026-09-24). Rules: the tile-matching patience game played with a mahjong set, made famous on computers by Brodie Lockard's 1981 game (sold later as Shanghai, a trademark). "Mahjong solitaire" is the generic name. Rules as in [Wikipedia, Mahjong solitaire](https://en.wikipedia.org/wiki/Mahjong_solitaire).

## Not a reskin of Tile Match
Tile Match takes three alike into a tray. This takes matching **pairs** straight off a stacked layout, and the whole game is the free-tile rule: a tile can only be taken when nothing lies on it and one of its long sides is open.

## The real game
- **144 tiles** in a layered layout, most famously the turtle: 36 kinds, four of each, with flowers and seasons as groups of four different pictures that match within their group.
- **Take two matching free tiles at a time.** Free: no tile on top of it, and no tile against its left side or no tile against its right side.
- **Clear the board to win.** A deal can get stuck; most apps give shuffles.

## Our design
- **Three layouts**: a 36-tile pyramid, a 72-tile pyramid, and the 144-tile turtle, picked at the table.
- **Our own tile faces**, no borrowed art: dots (three colors of pip), sticks, numerals with a small flower, arrows for the four winds, a heart, a clover and a frame for the three symbols, four flowers and four seasons (sun, rain, leaf, snow).
- **Every deal can be cleared**: it is built by playing a removal backwards, taking two free tiles at a time from the full layout and giving them a matching pair. Smaller layouts draw their kinds from the whole set.
- **Tap a free tile, then its match**: the pair lifts and flies off. A tile that is not free wobbles. **Hint** lifts a pair for a moment; **Shuffle** (twice a game) deals the tiles left again, also clearable. Stuck with no shuffle left, the game is over.
- **Keyboard**: arrows walk the free tiles, Enter picks, H hints, S shuffles.

## Tests
Layouts of 36, 72 and 144 with no two tiles in one place and every raised tile resting on one below; four of each face, with flowers and seasons each four different pictures; the free rule; a matching free pair comes off and anything else is refused; every deal on every layout is cleared in test play; a shuffle keeps the same faces. Invariant, every move of random play: the faces left always pair up.
