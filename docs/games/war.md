# War

Status: brief (2026-09-19). Rules: the standard two-player game, as Wikipedia records it.

## The real game
- The deck is **split evenly, 26 cards each**, face down.
- Each round both players **turn their top card over**. The higher card takes both and puts them at the bottom of their stack. **Aces are high**, and suits do not matter.
- **Equal cards mean war:** each player puts **one card face down and one face up**. The higher of the new face-up cards takes everything on the table. Another tie means another war.
- If a player cannot put down what a war needs, they lose. (The article records more than one house rule here; we pick this one and say so.)
- The winner is the player who ends up with all the cards.
- Sources: [War (card game), Wikipedia](https://en.wikipedia.org/wiki/War_(card_game)) (the even split, the battle, aces high, one down and one up in a war, and the note that a game "theoretically might be infinite").

## What makes it feel right
1. The flip. That is the whole game, and it is enough.
2. The word "war", and the four cards that come down with it.
3. Watching a stack that was nearly gone come all the way back.
4. Nobody has to think, so anybody can play, including at the end of a long day.

## How the best apps do it
Good War apps make the flip feel like a flip, count both stacks where you can see them, and make a war an event rather than four quiet cards. Reviewers complain about games that go on for twenty minutes with no end in sight.

## Our design
- **Players:** 2. Either of them taps to turn the cards over, so two people take it in turns to do the flipping and nobody just watches.
- **A war is the moment:** the table shakes, the face-down cards land in a row, and the two that decide it turn over last.
- **Both stacks are counted** on screen, so a comeback is something you can watch happening.
- **It ends.** Wikipedia says a game might theoretically never finish, and that is not a thing to ship, so after 300 battles the player holding more cards wins, and equal is a draw. The count is on screen from the start, so the finish is never a surprise.
- **Cards go back in a fixed order** (the winner's card, then the loser's, then the war cards as they lay), so the same deal always plays out the same way and a game can be replayed from its seed.
- **Different from our other card games:** nothing is hidden and nothing is chosen. It is the only game here that plays itself, and the only one where both players do the same thing at the same time.

## Tests
The deal is 26 cards each; the higher card takes both; an ace beats a king; equal cards start a war of one down and one up; the winner of a war takes everything on the table; a player who cannot finish a war loses; the game ends when somebody holds all 52; after 300 battles the bigger stack wins and equal is a draw; the deal comes from the seed so games replay exactly.
