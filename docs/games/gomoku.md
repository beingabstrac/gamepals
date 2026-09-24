# Gomoku

Status: brief (2026-09-25). From the catalog's board list (docs/12 B). Gomoku is a traditional public-domain game (five in a row on a Go board); freestyle rules as described by the Renju International Federation's glossary and Pagat.

## The real game
Two players, black and white, take turns putting a stone on an empty point of a 15 by 15 board; black goes first. The first to make five in a row, across, down or diagonally, wins. In freestyle gomoku six or more also wins. Serious play adds opening rules (swap, swap2, renju's restrictions on black) because black's first move is a big advantage; the casual game has none.

## What makes it feel right
1. The open three: seeing one coming, and making one they miss.
2. The double threat: a four and an open three at once, which cannot both be blocked.
3. A clean, quick game: a few minutes, no pieces to capture, no dice.

## Our design
- Freestyle, 15 by 15, black first, five or more wins, a full board is a draw. No opening rule: this is the casual game, and the bots are not strong enough for black's advantage to matter much (in bot self-play the first player wins about half the time).
- A sunny board with its lines and star points; stones drop in with a squash; a red dot on the last stone; a line through the winning five.
- Tap a point; keyboard arrows move a ring, Enter places.
- This was parked on 2026-09-24 because a one-move bot played badly; built again here with a proper threat search.

## Bots
Every candidate point (empty and near stones) is scored by the windows of five through it: a window with none of the other side's stones is worth more the fuller it gets, for both attack and defence. Everyone wins at once when it can and blocks a five. Easy often plays a loose move from the top few; Medium plays the best score; Hard also searches for a **win by fours** (each four must be blocked at once, so the replies are forced and the search stays narrow), six deep; Expert searches ten deep and, when the other side has such a win, plays the best move that breaks it. Over ten games each way: Medium beats Easy 17 of 20, Hard beats Medium, Expert beats Hard about two to one. A game takes well under a second of bot thinking.

## Tests
Five in a row wins in every direction and six counts; four is not enough and a taken point is not a move; a bot blocks a four; a win by fours is found where there is one; the better bot wins and the referee replays a game. Invariant, every move: stones only go down, one a turn, black and white taking turns.
