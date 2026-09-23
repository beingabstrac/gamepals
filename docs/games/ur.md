# Royal Game of Ur

Status: brief (2026-09-24). Rules: the race game found in the royal tombs at Ur (about 2600 BC), played across the Middle East for three thousand years. The rules we use are Irving Finkel's, read from a Babylonian tablet in the British Museum and the version the museum and most modern sets play. Four and a half thousand years old: nobody's product, and the name is the game's own.

## The real game
- **Two players, seven pieces each**, on a board of twenty squares: a block of 4 by 3, a bridge of 2, and a block of 2 by 3.
- **Each player's path** runs four squares down their own side, eight along the shared middle row, and two back on their own side, then off the board: fourteen squares.
- **Four tetrahedral dice**, each with two of its four tips marked. The throw is how many marked tips point up: 0 to 4, with 2 the most likely (6 in 16) and 0 and 4 the least (1 in 16 each).
- **Move one piece** that many squares, or bring a new one on. You cannot land on your own piece. Bearing off needs the exact throw.
- **Landing on an opponent in the shared row** sends their piece back to the start.
- **Rosettes**, five of them. Landing on one gives another throw. The rosette in the middle of the shared row is safe: nobody can be knocked off it, so nobody can land on it while it is taken.
- **A throw of nought, or one nothing can use**, passes the turn.
- **First to bring all seven home wins.**

## What makes it feel right
1. The dice tumbling and a white tip coming up, or not.
2. A piece hopping along square by square.
3. Knocking a piece off in the middle row just before it got away.
4. Sitting on the middle rosette and blocking the road.

## How the best ones do it
The museum's own version and the good apps draw the board flat and wide with the rosettes as flowers, show the four dice and the throw, glow the pieces that can move, and show where a piece would land before you move it.

## Our design
- **The board on end** so it fits a phone held upright: Blue's own squares on the right, Red's on the left, the shared row up the middle. Small arrows show where each player comes on and goes off.
- **Tap to throw**, anywhere on your turn. The four little pyramids tumble, the white tips count. Then the pieces that can go glow and the square they would land on shows a ghost; tap either.
- **A piece hops square by square**; a knocked-off piece flies home in an arc with a shake; "Again!" on a rosette, "Home!" going off, "Nought!" or "No move" when the throw is lost.
- **Keyboard**: Space throws; number keys pick a piece, or arrows and Enter.
- **Bots** see only the board and the throw. Easy moves at random half the time; Medium and Hard judge a move by how far everyone has got, what it knocks off, rosettes, holding the middle rosette, and how likely the piece is to be hit where it lands. Expert also looks at the other player's best reply to every throw they might make. Ur is mostly luck, so Expert plays about level with Hard; Hard beats Medium about three games in four.

## Tests
The dice give 0 to 4 with 2 the most common; a nought or a useless throw passes; a rosette throws again; landing on the other player in the shared row knocks them back; the same number on the private rows is a different square; nobody can land on the middle rosette while it is taken, or on their own piece; bearing off needs the exact throw; all seven home wins; pieces waiting are one move, not seven; bots finish and the tiers come out in order; the same seed throws the same dice. Invariant, every move of random games: seven pieces each, never two of one color on a square, never two colors on a shared square.
