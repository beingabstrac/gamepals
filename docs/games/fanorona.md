# Fanorona

Status: brief (2026-09-24). Rules: the national board game of Madagascar, played since at least the 1600s. Standard Fanoron-Tsivy rules as in [Wikipedia, Fanorona](https://en.wikipedia.org/wiki/Fanorona). Nobody's product, and the name is the game's own.

## Not a reskin of checkers
Pieces never jump. A piece captures by moving: step up to an enemy piece along a line (approach) or step straight away from one (withdrawal), and the whole unbroken line of theirs goes with it. Openings are all captures and whole rows vanish at once, which is the game's feel and nothing like draughts.

## The real game
- **A board of 9 by 5 points** joined by lines; "strong" points (every other one) also have diagonals.
- **22 pieces each** on every point but the center. White moves first.
- **Approach**: move to the point next to an enemy piece in the direction of travel. **Withdrawal**: move directly away from an adjacent enemy piece. Either way the enemy piece and every enemy piece in an unbroken line beyond it are taken. A move that could do both must choose one.
- **Capturing is compulsory**; a move with no capture (paika) is only allowed when no capture is.
- **A capture run**: after a capture the same piece may capture again, but never in the same direction twice in a row and never onto a point it has already visited in the run. Continuing is optional.
- **Win** by taking all of the other player's pieces.

## Where we have to decide
- **The middle row**: sources draw it alternating with the center empty; we use a pattern that is the same seen from either side of the board, so neither player starts better.
- **Draws**: real games are drawn by agreement; we call it after a hundred moves with nothing taken.

## What makes it feel right
1. The opening: whole lines disappearing.
2. A capture run zig-zagging across the board.
3. Choosing between the line in front and the line behind.

## Our design
- **A mint board with white lines**, bigger dots on the strong points, Blue and Red pieces.
- **Tap a piece, then a lit point**: the taken line ripples off one piece after another, with a count when three or more go. If the move could take either way, both lines ring pink and you tap a piece in the one you want (no menu). In a capture run the piece stays picked and **Stop here** appears.
- **Keyboard**: arrows and Enter; A or W to choose front or behind; S stops.
- **Bots** use our negamax search on pieces and strong points, depth 1 to 5 by tier (a run counts as more moves by the same player, which the search handles). Expert runs in the worker.

## Tests
22 each with the centre empty and strong points where they should be; captures are compulsory from the start; approach takes the unbroken line in front; withdrawal the line behind; weak points have no diagonals; a capture run keeps the same piece, bars the same direction and visited points, and can stop; taking the last piece wins; bots finish and the stronger tier wins. Invariant, every move of random games: pieces only ever go down, and only by the ones the move took.
