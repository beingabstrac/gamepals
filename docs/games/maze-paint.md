# Maze Paint

Status: brief (2026-09-24). From the catalog's puzzle list (docs/12 D). Roll-and-paint maze puzzles are a genre (the best-known app is trademarked, so the name here is plain).

## The genre
A ball in a maze. A swipe sends it rolling until it hits a wall; every square it rolls over is painted. Paint the whole maze and the level is done. The ball can only stop against a wall, never in the middle of a corridor, so the puzzle is finding the order of rolls that reaches every square.

## What makes it feel right
1. The swipe and the whoosh of the ball, the paint streaming behind it.
2. The last unpainted corner, and working out how to get there.
3. Levels short enough to finish in a minute or two.

## Our design
- A square maze, white floor, chunky lilac walls with a lip, mint paint, a grape ball. Three sizes as levels: 7, 9 and 11 squares across.
- **Swipe** (or use the arrow keys) to roll. A roll into a wall is not a move: the ball nudges and bumps back. The paint follows the ball square by square and the ball squashes against the wall it stops at.
- **Every maze is carved by rolling a ball through it**: pick a direction and a length, open the squares, keep the one beyond as wall so the roll stops there. The carving rolls are a way to paint it, and the maze is kept only if replaying them on the finished maze paints every square (a later roll can open the wall an earlier one stopped at).
- **Nobody can get stuck**: the maze is also kept only if every place the ball can stop can reach every other, so however you wander, the rest can still be painted.
- The status line counts squares left and rolls made; fewer rolls is better. There is no loss.

## Bots
For tests and autoplay: a bot rolls the shortest way to a roll that paints something new (a search over resting places); Easy does that half the time and rolls at random otherwise.

## Tests
A roll goes to the wall and paints what it passes; a roll into a wall is not a move; painting every square finishes it; every maze of every size (forty seeds each) is big enough, fully connected and paintable; random rolls still finish (nobody gets stuck); the same seed carves the same maze and the referee replays a game. Invariant, every roll: painted squares stay painted, walls are never painted, the ball sits on floor.
