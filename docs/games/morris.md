# Nine Men's Morris

Status: brief (2026-09-24). Rules: the mill game, played across Europe since at least Roman times (boards are cut into the roof of Kurna temple in Egypt and the stones of English cathedrals). Standard rules as in [Wikipedia, Nine men's morris](https://en.wikipedia.org/wiki/Nine_men%27s_morris) and every book of board games. Centuries old, nobody's product, and the name is the game's own.

## The real game
- **A board of three nested squares** joined at the middles of their sides: 24 points and 16 lines of three.
- **Nine pieces each.** First the players take turns placing a piece on any empty point.
- **Then they take turns moving** a piece along a line to the next point, if it is empty.
- **Three of your pieces in a row along a line is a mill**, whether made by placing or moving. It lets you take one of the other player's pieces, but not one that is in a mill unless they have nothing else.
- **Flying**: a player down to three pieces may move a piece to any empty point (the common rule, and in every modern set).
- **You lose** with two pieces left, or with no legal move.
- **A draw** by agreement or repetition in real play; we call it after a hundred moves with nothing taken.

## What makes it feel right
1. The placing phase, when you block their two in a row and set up your own.
2. Opening and shutting a mill: move out, move back, take again.
3. The pop of a taken piece.
4. The panic of flying with three.

## Our design
- **A bright yellow board with white lines**, pieces in Blue and Red with a lip.
- **Pieces to place sit in a row** along your edge and fly into place in an arc; moves slide along the line; a mill lights up pink with "Mill!", and the taken piece pops with a small shake.
- **Tap a point to place**; tap a piece then a point to move (the pieces that can move have a ring, the points they can reach a ghost); after a mill the pieces you may take glow red.
- **Keyboard**: arrows walk the points, Enter places, picks, moves or takes, Escape lets go.
- **Bots** use our negamax search with an evaluation of pieces, mills, open twos, room to move and blocked pieces. Depth 1 to 5 by tier, shallower while placing and while anyone flies, where every empty point is a move. Expert runs in the worker.

## Tests
The board: every line is one step and every mill three on a line; placing nine each then moving; a mill takes a piece; a piece in a mill cannot be taken while another is loose, and any can when none is; moves go only to an empty neighbor, until three are left and they fly; down to two pieces loses; no move loses; a long quiet spell is a draw; bots finish and the tiers come out in order. Invariant, every move of random games: never more than nine a side, and only a take ever removes a piece, exactly one.
