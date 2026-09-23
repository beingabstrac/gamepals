# Flood

Status: brief (2026-09-23). Rules: the colour-flooding puzzle best known as Flood-It (LabPixies, around 2009) and as Flood in Simon Tatham's Portable Puzzle Collection, plus the two-player territory version from the same idea that phone players know from iMessage game packs. The mechanic is not owned; the product names are, so ours is Flood ([03 §4](03-game-catalog.md#4-trademark-safe-naming)).

## The real game
- **A square grid of coloured squares**, usually six colours. The classic phone board is 14 by 14 with 25 moves.
- **You own the patch in the top-left corner**: the corner square and every square of its colour joined to it.
- **Each move, pick a colour.** Your whole patch turns that colour, and every square of that colour touching it joins, and the ones touching those, and so on.
- **You win by turning the whole board one colour** within the move limit. Run out of moves and you lose.
- **Finding the fewest moves is hard.** Clifford, Jalsenius, Montanaro and Sach showed in 2012 that it is NP-hard from six colours up, which is why every version sets its limit from a solver that is good rather than perfect, plus some room.

### Two players
- **The same board, owned from two corners**: one player starts bottom left, the other top right.
- **Pick a colour each turn, but not your own and not the other player's.** So there are four choices out of six, and taking the colour the other side wants next is a real move.
- **Nobody can take the other's squares.** The board is laid so that no square touches one of its own colour, which makes both corners start as one square each.
- **Whoever holds more than half the board has won**, since the other can never catch up. If it all fills and the counts are even, it is a draw.

## What makes it feel right
1. The first big swallow, when one colour pulls in a whole river of squares.
2. Planning two moves ahead: taking blue now because it opens a lake of red behind it.
3. The last few moves, counting what is left against the counter.
4. In the duel, stealing: picking the colour your opponent was reaching for, so they cannot have it next turn.

## How the best ones do it
Tatham's Flood sets the limit from its own solver plus a few spare moves and lets you click any square to pick its colour, not just a palette. The good phone versions animate the flood as a wave from the corner, so you see where the colour went, and draw your patch as one joined shape so you can tell what is yours at a glance. The two-player versions show both counts all the time and grey out the two colours you cannot pick.

## Our design
- **Every board is winnable.** The limit is what our solver needed on that board, plus room: 4 spare moves on Small, 3 on Medium, 2 on Large. The solver's own moves are a real way to win, so the limit can never be too tight. Measured before building, over 500 boards each: the solver takes 16.8 moves on average on 10 by 10, 19.8 on 12 by 12 and 23.1 on 14 by 14 (the classic app gave 25 for that board), in half a millisecond at most.
- **The solver** works on patches rather than squares. First it takes any colour it can finish off in one go (every patch of it touches ours), which never costs a move. Otherwise it picks the colour that brings the farthest patch on the board nearest, and the most squares when two tie. That is the rule Tatham's solver is built on.
- **Three sizes**: Small 10 by 10, Medium 12 by 12, Large 14 by 14, all six colours. The same three sizes serve the duel, where they mean a quicker or a longer game.
- **Moves** are a colour, `0` to `5`. `legalMoves` lists every colour but your own (and, in the duel, the other player's), including a colour that touches nothing: that wastes a move and is allowed, as it is in every version.
- **Touch**: tap a colour in the row under the board, or tap any square on the board to pick its colour. **Keyboard**: 1 to 6 pick a colour, or the arrows and Enter.
- **Your patch is drawn as one joined shape**, with no gaps between its squares, and a star marks where it started. The flood runs outward from that corner as a wave, and squares that join pop in.
- **In the duel** each player has their own row: the bottom player's under the board, the top player's above it and turned to face them. Your own colour shows a star and the other side's is greyed out with a cross. Against a bot, the bot's row shows only its count, and if the person is the second seat the board turns so their corner is at the bottom.
- **A duel cannot stall.** A colour you cannot take this turn because the other side is wearing it is free again next turn, since they must change. As a guard for two people just passing, twenty turns in a row that claim nothing end the game on the count.
- **Bots**: in solo the autoplayer is the solver, and it always wins inside the limit. In the duel, Easy looks one move ahead and often picks at random, Medium looks one move ahead, Hard two, Expert four, all counting squares held.

## Tests
A patch floods through every joined square of the new colour and stops at other colours; the starting patch is the whole joined area in solo and one square in the duel; the duel board has no two neighbours of the same colour and the corners differ; `legalMoves` leaves out exactly your own colour and, in the duel, the other player's; winning needs the whole board, and the last allowed move without it loses; more than half wins a duel at once and an even fill is a draw; twenty idle turns end a duel; replay reproduces a game; **every board of every size is won by the autoplayer inside its limit**; Expert beats Easy in most duels. Invariant, checked after every move of random games: each player's squares are one joined patch of one colour, no free square of that colour touches it (the flood is complete), and a square once owned never changes hands.
