# Go 9×9

Status: brief (2026-09-24). Rules: the oldest board game still played in its first form, from China over 2,500 years ago (weiqi in Chinese, baduk in Korean, igo in Japanese). The 9 by 9 board is the standard small board for beginners and quick games. Rules as in [Wikipedia, Rules of Go](https://en.wikipedia.org/wiki/Rules_of_Go), scored by area in the Tromp–Taylor form ([Tromp, The game of Go](https://tromp.github.io/go.html)). Nobody's product.

## The real game
- **Black plays first**, then turns alternate, one stone on any empty point where the lines cross. Stones never move.
- **A stone or group with no empty point next to it is captured** and taken off.
- **No suicide**: you cannot play where your own group would have no liberty, unless the move captures.
- **Ko**: a move may not bring back a position that has been on the board before (positional superko; the simple ko rule is the common case of it).
- **Passing**: two passes in a row end the game.
- **Scoring by area**: your stones on the board plus the empty points that only your stones reach. White gets komi for going second; 7 on 9 by 9 under area scoring, which lets a game be drawn.

## Where we have to decide
- **Dead stones**: in a club game the players agree which stones are dead and take them off before counting. A phone cannot ask two people to agree, and guessing wrong would hand someone the game, so we count what is on the board (Tromp–Taylor): take dead stones off by playing. The how-to says so in plain words, and the bots always play it out.
- **A long game is counted where it stands** at 250 moves, far beyond any real 9 by 9 game.

## What makes it feel right
1. The click of a stone going down.
2. Taking a group off the board.
3. The shape of the territory at the end.

## Our design
- **A yellow board** with darker lines and the five star points, black and white stones with a lip and a highlight.
- **Tap a point** to place (a stone drops with a squash); a tap where you cannot play buzzes. Captured stones pop with a small shake. A red ring marks the last move. **Pass** is a big button under the board, and a pass is announced.
- **At the end** every empty point is marked with a small square in the color that owns it, and the line along the top gives the count with komi.
- **Keyboard**: arrows move, Enter places, P passes.
- **Bots** use Monte Carlo tree search over random playouts on a fast mutable board (simple ko inside the search, superko on the real move list at the root). 150, 600, 1,500 and 3,500 playouts by tier; Easy also plays a random point one move in five. They pass back when the other player has passed and they are ahead, and give up (pass) when every move looks lost. Expert runs in the worker.

## Tests
A stone with no liberties is taken; no suicide; ko cannot be retaken at once; two passes end it, scored by area with 7 for White; a pass then a move carries on; a stone on a stone is refused; bots play only legal moves and games end; more playouts win more. Invariant, every move of random games: no group on the board is ever without a liberty, and no position comes round twice.
