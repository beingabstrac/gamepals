# Brick Blast

Status: brief (2026-09-24). A two-on-one-phone duel from the catalog (docs/12 A): versus breakout. Breakout-style paddle games are a genre; the name and the wall-between-two-paddles design are ours.

## Rules
- **A wall of bricks** stands across the middle of the table: eight across, six deep. The two middle rows are tough and take two hits.
- **A paddle guards each end** and **two balls are in play at once**, one served by each player.
- A ball bounces off the side walls, off bricks (breaking them) and off paddles. Off the middle of a paddle it goes straight back; off the end it goes out at an angle, up to sixty degrees. Every paddle hit speeds it up a little, to a cap.
- **A ball past a paddle is a point** to the player at the other end. It goes back to the player who let it by, who serves it again after a second.
- **When the wall is all gone it builds itself back up**, as soon as no ball is where the bricks go, so a long match never turns into plain pong.
- **First to five points wins.**

## What makes it feel right
1. The first ball through the gap you have been chipping at for ages.
2. Two balls: you can never watch only one.
3. Bricks popping into bits, with a crunch.

## Our design
- Portrait, split screen, each half tinted for its player, the big score faint in each half, facing them.
- Bricks in candy rows (sunny, peach, grape, grape, mint, bubblegum), a white crack across a tough one that has been hit.
- The balls take the color of whoever touched them last.
- Paddles squash a little on each hit. The camera shakes on a point.
- **Touch**: each finger drives the paddle of the half it came down in. **Keyboard**: Left and Right for the bottom paddle, A and D for the top.
- Paddles move at most 1100 px a second, for people and bots alike.

## Bots
Bots follow the ball that will reach their end first, and only once it is within their sight (they cannot see the future through the wall). Their guess wobbles by a set amount, a new wobble on every bounce, seeded. Hard and Expert take the ball off-center on purpose to angle it away from the other paddle. Measured over ten seeds a pairing: Expert beats Hard 10 of 10, Hard beats Medium 7, Medium beats Easy 7. Two Experts take about a minute and a half.

## Tests
The wall fits and sits clear of both paddles; balls sit on the paddles through the countdown then launch toward the wall; paddle speed is capped and paddles stay on the table; a brick breaks and turns a ball back, a tough brick cracks first; a paddle returns a ball, steeper off its edge; a ball past a paddle scores for the other end and goes back to be served by who let it by; first to five wins; the crossing prediction bounces off the sides; the wall builds back but never on top of a ball; the better bot wins. Invariant, every step of bot play: bricks only lose hits unless the whole wall rebuilds, scores climb one at a time, no ball sits inside a brick, balls stay on the table.
