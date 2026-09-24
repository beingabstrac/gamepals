# Connect Six

Status: brief (2026-09-25). From the catalog's board classics (docs/12 B, "Gomoku / Connect Six"). Built as M38b.

## The real game
- Invented by I-Chen Wu (National Chiao Tung University) and published in 2005; played at the Computer Olympiad since 2006. Rules from Wu and Huang, "A New Family of k-in-a-row Games" (2005) and the Connect6 site.
- Two players, Black and White, on the points of a Go board (19 by 19).
- Black goes first and puts down **one** stone. After that each player puts down **two** stones a turn.
- The first to get **six or more** in a row, across, down or corner to corner, wins. A full board is a draw.
- The one-stone opening is what makes it fair: after it, each player always has one stone more than the other at the end of their turn, and neither side has the first-move edge Gomoku gives Black.

## Why it is its own game and not Gomoku
Two stones a turn changes everything that matters. A four-in-a-window is already a threat, because two stones finish it; one turn can block two threats, so a win comes from making **three** threats at once; and every turn is a pair of stones that have to work together. Gomoku's tactics (open threes, fours) do not carry over.

## What makes it feel right
- The turn is clearly two stones: the line says "first stone" and "second stone", and the pair from the last turn stays marked so you can see what they did.
- Stones drop in with a squash, the winning six gets a line through it.

## Our design
- A 15 by 15 board (fits a phone) or the full 19 by 19, from the table (`levels`). Black first with one stone, then two each.
- Tap a point to place; the second tap of a turn places the second stone. Keyboard: arrows and Enter.
- **Bots**, one stone at a time (the second after seeing the first):
  1. Win now if the stones left this turn finish a six.
  2. Block: every window of six holding four or five of theirs and none of ours must get a stone; put the stone where it covers the most of them.
  3. Otherwise score each point by the windows through it (worth more the fuller they are, for us and to stop them).
  - Easy plays loose from the top few; Medium blocks and plays the best point; Hard picks its first stone by looking at the best pair; Expert also counts how many stones the other player would need to stop it, and goes for three threats at once.

## Tests
- One stone first, then two a turn each; six wins, seven wins, five does not; a full board draws; an occupied point is not a move.
- Bots: win when two stones finish a six; block a four; Expert beats Hard beats Medium beats Easy.
- The referee replays a game.
