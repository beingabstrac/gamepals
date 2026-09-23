# Senet

Status: brief (2026-09-24). Rules: the Egyptian race game, played from before 3000 BC and found in tombs (Tutankhamun had four sets). No rulebook survives; every modern set plays a reconstruction. We play the one most sets and apps use, after Timothy Kendall (1978), with R. C. Bell's as the other well-known version. Sources: [Wikipedia, Senet](https://en.wikipedia.org/wiki/Senet); [Masters of Games, Senet rules](https://www.mastersofgames.com/rules/senet-rules.htm); [RoyalUr.net, Rules of Senet](https://royalur.net/senet). Five thousand years old, nobody's product, and the name is the game's own.

## The real game (Kendall's reconstruction)
- **A board of thirty squares** in three rows of ten, played as a snake: along the first row, back along the second, along the third.
- **Five pieces each** start mixed along the first row, one of each in turn.
- **Four throwing sticks**, white on one side. The throw is the number of whites showing, 1 to 4; no whites is 5.
- **A 1, 4 or 5 throws again**; a 2 or 3 ends the turn.
- **Move one piece forward** by the throw. You cannot land on your own piece. Landing on a lone opposing piece swaps the two. Two pieces side by side guard each other and cannot be landed on; three in a row form a wall nothing can pass.
- **If no piece can go forward, one must go back** by the throw; if none can do that either, the throw is lost.
- **Square 15, the House of Rebirth** (the ankh).
- **Square 26, the House of Beauty**: every piece must stop here exactly before going further. A 5 from here bears the piece off.
- **Square 27, the House of Water**: a piece that lands here is washed back to 15, or the first free square before it.
- **Squares 28, 29 and 30** need exactly a 3, a 2 and a 1 to bear off. 26, 28 and 29 are safe from swaps.
- **First to bear all five off wins.**

The sources differ on small things (Bell's version captures rather than swaps and scores the pieces borne off); where they do, we follow Kendall and the common apps, and the rules file says so.

## What makes it feel right
1. The sticks clattering and the count coming up.
2. Swapping someone back just before the end.
3. The water washing a piece back down the board.
4. A wall of three holding the other player up.

## Our design
- **The board on end** so it fits a phone held upright: the three rows as three tall columns, a dotted line showing the snake. The last houses are marked: an ankh, a flower, waves, and three, two and one strokes for the throw each needs.
- **Blue spools, Red cones**, different shapes as well as colors.
- **Tap to throw**: four sticks tumble on your side, then the pieces that can move glow (orange when they have to go back) with a ghost where they would land. Tap either.
- **Pieces hop square by square**; a swapped piece slides back past the mover; a piece in the water splashes and is washed back; "Again!" on a 1, 4 or 5.
- **Keyboard**: Space throws; number keys pick a piece, or arrows and Enter.
- **Bots** see only the board and the throw. Easy moves at random more than half the time; the others judge how far everyone has got, walls and guarding pairs, swaps, and how likely a piece is to be swapped where it stands. Senet is mostly luck: each tier beats the one below it about six games in ten, and Expert plays about level with Hard.

## Tests
The sticks throw 1 to 5 with no whites counting five; five pieces each start mixed along the first row; landing on a lone piece swaps; two side by side are safe; you cannot land on your own piece; three in a row cannot be passed; with no move forward a piece must go back; every piece must stop on 26; the water washes a piece back to 15 or the first free square before it; the last houses bear off only with their own throw; 1, 4 and 5 throw again; all five off wins; bots finish and the tiers come out in order; the same seed throws the same sticks. Invariant, every move of random games: five pieces each, never two on one square, nobody left in the water.
