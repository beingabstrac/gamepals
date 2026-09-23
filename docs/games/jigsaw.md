# Jigsaw

Status: brief (2026-09-23). Rules: the jigsaw puzzle, which goes back to the dissected maps London mapmakers sold for teaching geography in the 1760s. Nobody owns it. Every picture is drawn by us.

## The real game
- **A picture cut into pieces** that interlock: along each join between two pieces one has a knob and the other the matching hole. Pieces on the outside have one flat side, corners two.
- **Put every piece back where it belongs** to finish the picture. There is no losing, only finishing.
- People start with the corners and the edges, then sort the rest by colour and by what is in the picture.

## What makes it feel right
1. The click of a piece going in, and the small certainty that it is right.
2. The picture coming together, the empty space getting smaller.
3. Finding the one piece that has been in front of you the whole time.
4. The last piece.

## How the best ones do it
Phone jigsaws (Jigsaw Puzzles Epic, Magic Jigsaw Puzzles and the like) keep loose pieces in a tray under the board, let you drag a piece anywhere, and snap it into place when you drop it close to where it belongs, with a click and a small bounce. A faint ghost of the picture on the board helps beginners and can be turned off; an edges-only filter helps the start. They go from 9 pieces to hundreds, and on a phone anything past about 50 is too small to hold.

## Our design
- **Three sizes for a phone held upright**: 12 pieces (4 by 3), 20 (5 by 4) and 35 (7 by 5). On the biggest a piece is about 8 mm wide on a small phone, about a keyboard key, which is as small as a thumb can place with care.
- **Pictures drawn by us**, in the same flat candy style as the rest of the app: a beach, a house with a tree, balloons over hills, a rocket, a fish bowl, a farm, a city at night, a snowman. The seed picks one, and the knobs and holes, so a seed is always the same puzzle.
- **Pieces are cut on the fly**: the picture is drawn once, and each piece is cut out of it along its own outline with its own knobs and holes, so the pieces fit because they are cut from the same picture along the same lines.
- **The tray** holds the loose pieces in a grid under the board, shuffled by the seed, smaller than they will be on the board so they all fit. **Edges first** is a toggle beside it, because that is how people start.
- **Touch**: drag a piece onto the board; dropped near where it belongs, it snaps in with a click and a bounce, anywhere else it springs back to the tray. Or tap a piece to pick it up and tap where it goes. **Keyboard**: arrows pick a piece in the tray, Enter lifts it, arrows move it over the board, Enter drops it.
- **A faint picture on the board** shows where things go, as every phone version does. On Hard it is fainter.
- **Moves**: put a piece in place (`p<index>`). A drop in the wrong place is not a move; the piece just goes back. `legalMoves` lists every piece not yet in place. There is no losing: the result is always a win, with the time and wrong drops shown.
- **Bots**: solo only; the autoplayer places pieces edges first and then in rows, the way people do.

## Tests
Every piece is in the tray at the start and none on the board; placing a piece puts it on the board for good; placing one twice throws; the puzzle is done exactly when every piece is in; `legalMoves` lists exactly what `apply` accepts; replay reproduces a game; each join has a knob on one side and a hole on the other, and outside edges are flat; the same seed gives the same picture, cuts and tray order. Invariant, after every move of random games: every piece is in exactly one of tray and board.
