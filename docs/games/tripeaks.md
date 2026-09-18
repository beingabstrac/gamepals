# TriPeaks

Status: brief (2026-09-18). Rules: Tri Peaks, invented by Robert Hogue in 1989 and played everywhere since.

## The real game
- 28 cards make three overlapping peaks: three rows of 3, 6 and 9 cards, sitting on a base row of 10. Only the base row starts face up. Of the other 24 cards one is turned onto the waste to start, leaving 23 in the stock.
- **Moving:** take any **uncovered** board card that is **one rank above or below** the top of the waste, and it becomes the new top. Ace wraps both ways, so it takes a King or a two.
- **Uncovering:** a card is free once both cards overlapping it are gone, and it turns face up as it is freed.
- **Stuck:** turn the next stock card onto the waste and carry on. There are no redeals.
- **Winning:** clear all 28 board cards. A long run without touching the stock is where the points are, which is why players hunt for chains.
- Sources: [Tri Peaks (game), Wikipedia](https://en.wikipedia.org/wiki/Tri_Peaks_(game)) (the three peaks over a base of ten, rank up or down, Ace wrapping, scoring by run length).

## What makes it feel right
1. The chain: one card after another without going back to the deck.
2. Peaks collapsing from the bottom up, each one a small win.
3. The gamble of spending a card now against saving it for a longer run.
4. Quick games. A deal is over in a couple of minutes either way.

## How the best apps do it
Good TriPeaks apps show the run you are on as it grows, mark which cards can be taken right now, keep unlimited undo, and say plainly when the deck is out. Reviewers dislike not knowing why a card will not move and having to count ranks by eye.

## Our design
- **Look:** our Klondike cards, three peaks over a base row, stock and waste at the bottom, cards left on the deck written on it.
- **Controls:** tap any card next to the waste card in rank. Tap the deck to turn a card. Keyboard: arrows walk the cards that can be taken, Enter takes one, D draws.
- **Help:** cards that can be taken sit a little proud of the rest, so the eye finds them without counting. Unlimited undo, and a hint that points at one.
- **Run:** the run counter grows with each card taken without touching the deck, and resets when you draw.
- **Motion:** the taken card flies to the waste and lands with a turn; the card it frees turns over behind it; a cleared peak sparkles out.
- **Messages:** plain words: "Run of 5", "Deck is out", "No moves left. Undo, or start a new deal."
- **Players:** solo only. Unlimited undo.
- **Different from Pyramid:** cards leave one at a time onto a single pile, not in pairs, and the game is about chains rather than arithmetic.

## Tests
The deal is 28 board cards in rows of 3, 6, 9 and 10 with 23 in the deck and one already turned; only the base row starts face up; a card is free when both cards over it are gone; a card moves only if it is one rank above or below the waste top; Ace wraps to King and to two; drawing turns one card and ends the run; the game is won when the board is empty; illegal moves throw; the deal comes from the seed so games replay exactly; undo steps back through every move.
