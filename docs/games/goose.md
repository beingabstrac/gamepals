# Game of the Goose

Status: brief (2026-09-25). From the catalog's board classics (docs/12 B). Built as M38c.

## The real game
The oldest printed race game in Europe: a gift from Francesco de' Medici to Philip II of Spain in the 1570s, printed ever since in hundreds of versions (Parlett, *The Oxford History of Board Games*, 1999; Seville, *The Cultural Legacy of the Royal Game of the Goose*, 2019). The rules below are the common French and Spanish ones, which almost every modern set follows:
- 63 squares on a spiral, 2 to 4 players, two dice. You move forward by the total.
- **Geese** on 5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54 and 59: land on one and move on again by the same total, and again if that lands on another goose.
- **First throw:** 6 and 3 goes straight to 26; 5 and 4 goes straight to 53 (otherwise a 9 would ride the geese all the way home).
- **Bridge (6):** cross to 12.
- **Inn (19):** miss a turn.
- **Well (31)** and **Prison (52):** stay there until another player lands on the square and takes your place.
- **Maze (42):** lost, go back to 30.
- **Death (58):** back to the start.
- **Home (63)** must be reached exactly. Too much and you count back from 63 the rest of the way; counting back onto a goose sends you back again by the total.
- **Knocked back:** land where another player stands and they go to the square you started your move from (and anyone held in the Well or the Prison is freed that way).

## Why it is its own game and not Snakes & Ladders
There is no ladder: the geese double a throw and chain, the hazards are traps you wait in (the Inn, the Well, the Prison) rather than slides, and players knock each other back and free each other. It is still pure luck, and says so.

## What makes it feel right
- The spiral board, with a goose on its squares, drawn as a toy: the token hops square by square, flaps along goose to goose, and lands with a squash.
- Every special square says what happened in one plain line: "Goose! Fly on 7", "The Inn: miss a turn", "In the Well until someone comes".

## Our design
- 2 to 4 players, any mix of people and bots. Tap Roll (or press Space or Enter).
- The dice come from the seed, so the only move is `roll` and the referee replays a game exactly.
- Bots cannot choose anything, so every tier plays the same; the table still offers them so a family can fill seats.
- If every player left in the game is held in the Well or the Prison, they are all let out, so a game cannot stall.

## Tests
- Geese chain and send you on by the total; bouncing back past 63 counts back, onto a goose goes back again.
- First-throw rule for 6+3 and 5+4 only on the first move.
- Bridge, Maze and Death jumps; the Inn misses exactly one turn; the Well and Prison hold until someone arrives, who takes their place.
- Landing on another player knocks them to where you started.
- Home exactly wins; positions always stay between 0 and 63; the referee replays a game.
