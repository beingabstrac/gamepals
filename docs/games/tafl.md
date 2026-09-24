# Hnefatafl

Status: brief (2026-09-24). Rules: the Norse "king's table" game, played across Scandinavia and the British Isles before chess arrived. The original rules are lost; we play the Copenhagen rules, the modern reconstruction used by the tafl federations and most online play, from [Aage Nielsen's Copenhagen rules](https://aagenielsen.dk/copenhagen_rules.php) (see also [Wikipedia, Tafl games](https://en.wikipedia.org/wiki/Tafl_games)). A thousand years old, nobody's product, and the name is the game's own.

## Not a reskin of chess or checkers
Two unequal sides with different aims: 24 attackers want to trap one king; 12 defenders want him to reach a corner. No piece has a special move, captures are by trapping between two, and the board's five restricted squares matter to both sides.

## The real game (Copenhagen)
- **11 by 11**, the king on the central throne with 12 defenders round him in a diamond, 24 attackers in four groups on the edges. **The attackers move first.**
- **Every piece moves like a rook**: any number of empty squares along a row or column, no jumping.
- **Restricted squares**: the throne and the four corners. Only the king may stop on them; anyone may pass over the empty throne.
- **Capture**: a piece (not the king) is taken when the moving side traps it between two of theirs on a line. Only the move that closes the trap captures. A corner, or the empty throne, can stand in for one of the two; the throne is always hostile to attackers. The king is armed and helps capture.
- **The king is taken** when attackers surround him on all four sides, or on three sides with the throne on the fourth. He cannot be taken on the edge.
- **Defenders win** when the king reaches a corner. **Attackers win** when the king is taken. **A player with no move loses.** Perpetual repetition loses for the defenders.

## Where we simplify, and say so
- **No shieldwall captures and no exit forts** (edge formations that take a row at once, or that win for an unbreakable king on the edge). Both are rare in casual play and hard to explain in a line; the how-to never mentions them.
- **No encirclement win** for the attackers. Instead, as in the rules, a player with no move loses, and a third repetition of a position loses for the defenders; 300 moves with no end is a draw.

## What makes it feel right
1. The king slipping between the attackers.
2. Trapping a piece against a corner.
3. The attackers' net closing.

## Our design
- **A warm board** with yellow restricted squares marked with a crown, attackers in red, defenders in blue, the king crowned in gold.
- **Tap a piece, then a lit square** on its row or column; pieces slide, a trapped piece pops with a small shake, the last move stays faintly marked. "Escaped!" and "Caught!" at the end.
- **Keyboard**: arrows move the ring, Enter picks and moves, Escape lets go.
- **Bots** use our negamax search: the king's open roads to a corner and the roads one move away, whose turn it is (a king with a road on his own turn, or two on the attackers', is gone), his distance to a corner, pieces on each side, attackers pressing him, and attackers sealing the corners with the diagonal of three that real attackers build. Weak players make tafl lopsided (the king just runs), so tiers are measured side by side: the better tier wins on either side. Easy and Medium look one ply ahead, Hard and Expert two (a third ply costs twenty seconds a move), Hard with the odd slip; both run in the worker.

## Tests
The starting count; rook moves with no jumping; restricted squares; capture only by the move that closes the trap; corners and the empty throne trap; the king escapes to a corner and wins; the king is taken on four sides, or three and the throne, and never on the edge; a player with no move loses; bots play legal moves and the stronger tier wins on either side. Invariant, every move of random games: at most one king, and the throne and corners hold nobody but him.
