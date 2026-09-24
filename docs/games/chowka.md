# Chowka Bhara

Status: brief (2026-09-24). Rules: the south Indian race game played on a square chalked on the floor, known as Chowka Bhara in Karnataka and Ashta Chamma in Andhra Pradesh and Telangana. Rules as in [Wikipedia, Chowka bhara](https://en.wikipedia.org/wiki/Chowka_bhara). Nobody's product, and the name is the game's own.

## Not a reskin of Pachisi or Ludo
A small square floor rather than a cross or a track, a spiral path (round the outside one way, round the inner ring the other, into the middle), four cowries where none up is the big throw, and the rule that you may not go inside until you have knocked somebody off.

## The real game
- **A 5 by 5 board.** Four starting squares in the middle of each side and the middle square are safe, marked with a cross.
- **Two to four players, four pieces each.**
- **Four cowries**: the throw is how many land mouth up; all four up (chamma) is 4, none up (ashta) is 8. A 4 or an 8 brings a piece on and throws again.
- **Pieces go anticlockwise round the outside, then clockwise round the inner ring, and finish on the middle square** by the exact throw.
- **Landing on another player's lone piece** on a square that is not safe sends it back, and throws again.
- **Two of your pieces on one square are a double**, which a single piece cannot hit.
- **You may not enter the inner ring until you have hit somebody.**
- **First with all four pieces in the middle wins.**

## Where we have to decide
- **Before your first hit you go round the outside again** rather than stopping at the inner door. Many families play it this way, and it matters: with pieces stopping at the door, our invariant test found games where every piece ended up parked there in doubles nobody could hit, and nothing could ever move again.
- **One piece comes on per 4 or 8** (some play two and four); a double moves one piece at a time. Both keep the rule to one line.
- **A game that runs 3,000 throws is a draw**, which no real game comes near.

## Our design
- **A purple frame, white outer squares, pale inner ring, yellow crossed safe squares.** Each player's waiting pieces and shells sit beside their own side of the board.
- **Tap to throw** anywhere on your turn; the four shells tumble ("Chamma! 4", "Ashta! 8"); the pieces that can go glow with a ghost where they land; tap either, nearest wins. A piece going round again hops the whole way round.
- **Keyboard**: Space throws; number keys pick a move, or arrows and Enter.
- **Bots** see only the board and the throw and weigh progress, bringing pieces on, hits (more before the first), safe squares and danger. Mostly luck: Medium beats Easy about three in four, Hard beats Medium about three in five, and Expert plays about level with Hard.

## Tests
The path covers all 25 squares one step at a time for every side and ends in the middle; cowrie values; only a 4 or 8 brings a piece on and throws again; the inner ring is shut until you hit someone (you go round again); a hit sends the piece back, opens the ring and throws again; a double cannot be hit; home needs the exact throw and all four home wins; bots finish and the tiers come out in order; the same seed throws the same shells. Invariant, every move of random games: never two sides on one square that is not safe, and every game ends.
