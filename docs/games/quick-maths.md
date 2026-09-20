# Quick Maths

Status: brief (2026-09-20). Rules: two people, one device, one sum at a time, first correct answer takes the point. The mechanic is the oldest one in a classroom and nobody owns it; JindoBlu lists a maths game among its two-player set.

## The real game
- **A sum appears** in the middle of the screen, the right way up for both players.
- **Four answers**, one right.
- **First correct tap takes the point.** A wrong tap costs you that question: you are out of it and the other player can answer at their leisure.
- **Nobody answers in time** and the question goes away with no point.
- **First to five** wins.

## What makes it feel right
1. Knowing the answer instantly and still being beaten to it.
2. Watching the other player's wrong tap and taking your time.
3. The sums getting harder as the game goes on.
4. Both hands hovering over the same screen.

## How the best ones do it
The question faces both players at once, so neither has to read upside down. A wrong answer has a real cost, or there is no reason not to hammer every button. The sums start easy enough that the first point is about speed rather than arithmetic.

## Our design
- **It is a real-time duel**, like Reflex Race, not a turn-based game: both players are live at the same time, so it uses the same phase-and-step shape (`stepQuick`) rather than `legalMoves`.
- **The sums get harder with the round**, so there are no levels to pick and no setup to get through. Round one is a small addition; by round seven there is multiplication in it.
- **A wrong answer locks you out** of that question. Without that, the best strategy is to hit all four buttons, which is not a game.
- **Both halves face their own player**, using the same `facing()` the other duels use.
- **Deterministic**: the seed and the round decide the sum and the order of the answers, so a game replays the same everywhere.
- **Bots** answer after a delay that depends on the tier, and the weaker ones get it wrong sometimes, which is what makes them beatable rather than just slow.

## Tests
The sum and its answers coming from the seed and the round; the four answers all different with exactly one right; the right tap scoring and the wrong tap locking that player out; both players locked out ending the question with no point; nobody answering in time ending it too; five points winning; the sums getting harder as rounds go by; and bot reaction times sitting in tier order.
