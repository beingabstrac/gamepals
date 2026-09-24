# Chinese Checkers

Status: brief (2026-09-24). Rules: the star-board race game, first published in Germany as Stern-Halma (1892) and renamed "Chinese Checkers" by American sellers in 1928; the name is generic and in the catalog. Rules as in [Wikipedia, Chinese checkers](https://en.wikipedia.org/wiki/Chinese_checkers).

## The real game
- **A six-pointed star of 121 holes**: a hexagon of 61 with a triangle of 10 on each side.
- **Two, three, four or six players**, ten marbles each, starting in a point of the star (two sit opposite; three take every other point; four take two opposite pairs).
- **A move is a step** to a neighboring hole, **or a run of hops**: over one marble (anyone's) to the empty hole straight beyond, as many hops as you like in one turn, any direction.
- **The first to fill the point opposite wins.** The usual anti-spoiling rule: if other marbles are left sitting in your target, it is enough that the target is full and at least one of the marbles in it is yours.

## What makes it feel right
1. A long run of hops right across the board.
2. Building a ladder for yourself, and using someone else's.
3. The last marble dropping in.

## Our design
- **The star on a hex grid**, each point washed in the color of whoever starts there and faintly in the color of whoever is heading for it. Marbles in Blue, Red, Green and Yellow.
- **Tap a marble**: every hole it can reach this turn lights up; tap one and the marble hops there hole by hole along its path, little arcs over each marble. The last move's path stays faintly drawn.
- **Two to four players for now**: the table seats four. The rules already know the six-player start.
- **Keyboard**: arrows walk your marbles that can move, then the holes the picked one can reach; Enter picks and moves; Escape lets go.
- **Bots** play greedy on distance gained toward the far tip, with a nudge to bring up the back marbles; Expert also looks at the other player's best reply in a two-player game. Easy slips often, Medium now and then. Hard beats Medium about seven in ten; Expert plays about level with Hard.
- **A stalled game** is settled at 800 moves by whoever is nearest home; in testing no bot game got near it.

## Tests
121 holes, six points of ten, each the mirror of the one opposite; ten marbles each on their own point for two, three and four players; a step goes to a neighbor, a hop over one marble, and hops chain; home is a full target with at least one of yours in it; bots race home and the tiers come out in order. Invariant, every move of random games: ten marbles each, never made or lost.
