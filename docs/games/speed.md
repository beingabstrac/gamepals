# Speed

Status: brief (2026-09-24). From the catalog's card list (docs/12 C). Speed (also Spit's cousin) is a traditional public-domain card game; rules as commonly played in the United States (Bicycle and Pagat describe the same deal).

## The real game
Two players, one deck, no turns. Each has a hand of five and a draw pile of fifteen; two cards face up in the middle start the two piles, with a side stack of five next to each. Both play at once: a card goes on either pile if it is one higher or lower than the top card, with king and ace next to each other. After playing, fill your hand back to five from your draw pile. When neither player can play, both turn a card from the side stacks onto the piles at the same moment; when the side stacks run out, the piles (all but their tops) are shuffled into new side stacks. The first player with no cards left wins.

## What makes it feel right
1. Both hands going at once, slapping cards down.
2. Beating the other player to a pile by a fraction of a second.
3. The stalemate, and both reaching for the side stacks.

## Our design
- Two on one phone: each player's hand in their half, the two piles and side stacks across the middle, each player's draw pile beside their hand with "N to go". The shared card face from the other card games.
- **Drag a card onto a pile, or just tap it** and it goes on the first pile it fits. Keyboard: Left and Right pick a card (a grape ring, only once keys are used), Space plays it on a pile it fits, Up and Down choose the left or right pile (A, D, W, S and Shift for the top player).
- A card that lands makes its pile busy for an eighth of a second, so two hands on the same pile at once is decided fairly: the first to arrive gets it, and who counts as first alternates step to step when it is a dead heat. The other card is a miss and bumps back.
- **When nobody can play for 1.2 seconds, the side stacks turn over by themselves** (there is no need to agree on a count), with "Flip!". Out of side cards, the piles are shuffled back into them ("Shuffle!").
- Against a bot, the bot's hand stays face down: nobody needs to read it.
- First with no cards left wins; both on the same step is a dead heat.

## Bots
A bot waits its reaction time after the table last changed for it, then plays a card that fits; now and then it is slow to notice (twice as long). Easy 1.5 s, Medium 1.0, Hard 0.7, Expert 0.45. It looks only at its own hand and the piles. Over ten seeds: Medium beats Easy 9 in 10, Hard beats Medium 10, Expert beats Hard 9. A race takes 20 to 60 seconds.

## Tests
The deal (five, fifteen, two side stacks of five, one on each pile, all 52 once); next-to in rank with king beside ace; a fitting play lands and the hand fills from the draw pile; a card that does not fit is a miss and changes nothing; when nobody can play the side stacks turn over; first with no cards left wins; the quicker bot wins and every race ends. Invariant, every step of bot play: all 52 cards are somewhere, once each.
