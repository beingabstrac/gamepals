# Classic Snake

Status: built (2026-09-14).

## The real game
- One snake on a walled grid. It moves on its own; you steer it. Every piece of food makes it one longer, and the tail follows the head.
- Crash into a wall or your own body and the game is over. The longer you get, the harder it is to avoid yourself. Some classic versions speed up as the snake grows.
- It grew out of two-player *Blockade* (1976), where two snakes try to outlast each other. Our Snake Battle is that duel; Classic Snake is the solo score chase.
- Source: [Snake (video game genre), Wikipedia](https://en.wikipedia.org/wiki/Snake_(video_game_genre)).

## What makes it feel right
1. Crisp, instant steering that never misses a quick double turn.
2. The snake gliding smoothly between cells, not jumping.
3. Rising speed that makes every long snake feel tense.
4. A best score to beat.

## How the best apps do it
Classic snake apps keep a simple grid, swipe or arrow controls, a score and best score, and a little speed-up as you grow. Reviewers dislike lag between swipe and turn, and turns that get "eaten" when pressed quickly.

## Our design
- **Board:** the same bright checkered grass as Snake Battle, 16 by 22 cells, with our cute snake (eyes that look where it's going) and bouncing fruit.
- **Controls:** swipe in a direction, or the arrow keys (or W A S D). Up to two turns are remembered, so quick double turns always count. The snake can't reverse into itself.
- **Speed:** starts calm and gets faster with every fruit, up to a limit.
- **Score:** fruit eaten, plus your best score (saved on your device). Fill the whole board to win.
- **Motion:** smooth gliding, fruit pops, the snake squashes when it eats, and a crash shakes the board.
- **Bot:** only for autoplay tests; it takes the shortest safe path to the fruit, or else the move with the most room.
- **Different from our other games:** the solo score chase, where Snake Battle is a two-player duel.

## Tests
The snake moves one cell per tick and grows by one when it eats; food appears only on empty cells and follows the seed; it can't turn back into itself; up to two quick turns are kept; hitting a wall or itself ends the game; it speeds up as it eats; the bot plays legally and eats many fruit.
