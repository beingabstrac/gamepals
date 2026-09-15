# Dots & Boxes

Status: built (2026-09-14).

## The real game
- A grid of dots. On your turn, draw one line between two dots that sit next to each other, across or down.
- If your line closes the fourth side of a box, you claim that box and **must draw again**. One line can close two boxes at once.
- When every line is drawn, the player with the most boxes wins. Ties are possible. Usually two players, sometimes more.
- Beginners play small grids; experts like 5×5 boxes.
- **Strategy:** late in the game the open boxes join into *chains*, where any line gives the whole chain away. Strong players sacrifice small chains to control who must open the long ones, and use the *double-cross*: taking all but the last two boxes of a chain so the other player has to open the next one.
- Source: [Dots and boxes, Wikipedia](https://en.wikipedia.org/wiki/Dots_and_boxes).

## What makes it feel right
1. The pencil feel: a line snapping between two dots.
2. The chain run: claiming box after box in one go.
3. Tension late in the game, when every line gives something away.
4. Clear ownership: each box fills with its claimer's color.

## How the best apps do it
Good apps offer several grid sizes, 2 to 4 players, bots that sacrifice and double-cross at the top level, and a running score. Reviewers dislike tiny tap targets for lines and bots that are either random or perfect.

## Our design
- **Sizes (levels):** 3 by 3, 4 by 4, 5 by 5 boxes.
- **Look:** round dots in ink on a white tray; drawn lines in the player's color; a claimed box fills with a soft block of that color and pops with the player's initial.
- **Controls:** tap between two dots (the tap area is the whole space between them, not just the thin line); a faint line shows where it will go. Keyboard: arrows move a ring between line spots, Enter draws.
- **Motion:** lines draw from one dot to the other like a pencil; claimed boxes pop in; a chain run fills box after box with a little rhythm.
- **Players:** solo against bots, or 2 to 4 people and bots on one device. Score chips across the top light up for the player whose turn it is.
- **Bots (never cheat):** Pip often takes boxes but hands them out carelessly; Bo always takes free boxes and never gives one away if it can help it; Zed also gives away the smallest chain when it has to; Nova plays the endgame out to the end for every choice, which finds sacrifices and double-crosses like strong players. Measured: Nova beats Zed 8 of 10 on 5 by 5, but only about half the time on 4 by 4, where there are rarely enough long chains for the double-cross to matter. Next step for Nova: control the long-chain count in the middle game.
- **Different from our other games:** the only game about lines and who is forced to give.

## Tests
Line and box counts per size; closing a box scores and gives another turn; one line can close two boxes; drawing an existing line throws; the game ends when every line is drawn; most boxes wins, ties are a draw or a shared win; 3 and 4 players work; bots play only legal moves; games replay exactly; Bo beats Pip; Nova beats Pip.
