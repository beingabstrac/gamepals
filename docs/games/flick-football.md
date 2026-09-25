# Flick Football

Status: brief (2026-09-25). The catalog's "Golf Football" (docs/12 A), given a core of its own. Built as M42b.

## The real thing
Penny football and table flick-football games (coins or discs on a table, flicked with a finger; the commercial "table soccer" flick games) are turn-based: each turn you flick one of your own men, and the ball moves only when one of the men hits it. Getting the ball through the other goal means lining up a man, the ball and the goal, or a bank off the side, while leaving your men where they block the other side's next flick.

## Why it is its own game
In Mini Golf and Pool you hit the ball yourself; here you never touch it. Air Hockey is real time with one mallet. This is a turn-based positional game: every flick moves your man as well as the ball, and where your men stop is your defence.

## Our design
- A pitch seen from above, three round men a side and a ball. Seat 0 attacks the top goal, seat 1 the bottom one. Only the ball fits through a goal mouth.
- **Your turn:** touch one of your men, pull back like a slingshot and let go: the further you pull, the harder the flick. Everything rolls and bounces until it stops, then it is the other side's turn.
- Physics in the rules (a fixed step: rolling friction, bouncy circles of different weights, walls), so a flick is a move and the same flick always plays out the same way; the scene replays it.
- **Goals:** first to 3. A goal puts everyone back in their places and the side that let it in kicks off. After 30 flicks a side, the most goals wins; level is a draw.
- **Bots** try flicks with each of their men over a spread of directions and strengths, run each through the same physics, and pick the one that leaves the ball best: a goal, then the ball moved towards the other goal and away from their own. Easy tries a few and flicks a little off; Expert tries them all, then fine-tunes the best one.
- Keyboard: 1 to 3 pick a man, arrows aim and set power, Space flicks.

## Tests
A flicked man rolls and stops; a man hitting the ball moves it; the ball through the top goal scores for seat 0, through the bottom one for seat 1; men cannot go through a goal; a goal resets the pitch and gives the kick-off to the side that let it in; first to three wins; turns alternate; each tier beats the one below; the referee replays a match.
