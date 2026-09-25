# Marble Run

Status: brief (2026-09-25). From the catalog's chill toys (docs/12 F, "Marble run"). Built as M40a.

## The real thing
Marble runs are toys where you set ramps on a board and let a marble go: it rolls, drops off the end of one ramp onto the next and, if you set them right, lands in the cup at the bottom. The fun is the fiddling: tilt a ramp, drop, watch it miss by a whisker, tilt it again. Physics puzzle apps of the type (ramps and a ball, a goal to reach) all keep the same rules: the ball does what gravity says and you only change the ramps.

## Why it is its own game
Ball Run turns track tiles on a grid until a path joins up, and the ball follows the path. Here nothing snaps to a grid: the marble falls, bounces and rolls, and a ramp that is almost right is wrong.

## Our design
- A tall board with the marble at the top, a cup at the bottom, two fixed grey planks in the way, and four pegs where a ramp can go.
- **Tap a peg** to put a ramp there, tilted one way; tap again to tilt it the other way; again to take it off.
- **Drop** lets the marble go. It rolls, bounces and falls; into the cup and the level is done, off the bottom or stuck and you try again. Drops are counted.
- **Par** is the fewest ramps that get it in; the result says if you matched it.
- The physics is a fixed step in the rules (gravity, a marble against line segments with a little bounce and roll), so a drop is a move and the referee sees the same roll. The scene replays the same steps to draw it.
- Every level is made from the seed and checked by trying every set of ramps (three ways for each of four pegs, 81 in all): it must be solvable, and a drop with no ramps must miss.
- Keyboard: 1 to 4 turn a peg, Space or Enter drops.

## Tests
The marble falls straight with no ramps and lands where gravity says; a ramp turns it; the cup catches it; a level's recorded solution really lands; no-ramp drops miss; par is the fewest ramps of any solution; tapping cycles a peg; the referee replays a level.
