# Basketball Hoops

Status: brief (2026-09-24). A two-on-one-phone duel from the catalog (docs/12 A): the arcade shootout, where you sink as many as you can against the clock. Basketball is generic; the name is plain.

## The real thing
Arcade basketball: a minute on the clock, throw as many as you can. Reference apps (flick-to-shoot basketball games) have you swipe the ball up at the hoop; a fast swipe throws hard, the ball arcs, hits the rim and the board, and drops or doesn't. The best ones move you to a new spot after each basket so it never becomes one memorised flick.

## What makes it feel right
1. The clang off the front rim and the swish that touches nothing.
2. The net swinging as the ball drops through.
3. The buzzer: racing the clock with one more throw in the air.

## Our design
- **Each player gets their own little court** in their half of the phone, seen side on: floor, pole, backboard, rim and net. The top one is turned round, so both players see the same court.
- **Flick to throw**: a flick upward anywhere in your half throws the ball from where it sits; the flick's speed over its last tenth of a second or so sets the throw (up to 1400 px a second). A flick down or sideways is not a throw.
- **Keyboard**: Space starts a power meter swinging, a second press throws at a good arc with that power; the middle of the meter is just right. Shift for the top player.
- Both players get the same run of spots, seeded, so it is fair.
- **One minute. Most baskets wins; level at the buzzer, the next basket wins** (golden basket).
- The ball bounces off both ends of the rim and the board, cannot come up through the net, and the middle of the phone is each court's ceiling.
- "Swish!" for a basket that touches nothing. The rim is drawn over the ball, so a basket drops behind the front of it.

## Bots
A bot holds the ball for its pace, then throws the arc that drops into the middle of the hoop from a seeded height, with a seeded error in the speed. Easy: 1.8 s and 8 percent; Medium: 1.4 s and 5.5; Hard: 1.1 s and 4; Expert: 0.85 s and 2.8. In a minute that is roughly 10, 14, 18 and 22 baskets.

## Tests
Every spot is on the court, left of the hoop and below it, the same for both; the perfect throw from any spot is a swish; a soft throw misses and the next ball waits at the next spot; a long one clangs and is never a swish; only an upward flick throws; a ball never leaves its court through the middle nor goes through the board; most baskets at the buzzer wins, level goes to a golden basket; the better bot wins and every match ends. Invariant, every step of bot play: scores climb one basket at a time, balls stay in their courts.
