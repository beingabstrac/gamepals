# Pyramid

Status: brief (2026-09-18). Rules: standard Pyramid solitaire, the version shipped with Windows and played everywhere.

## The real game
- 28 cards are dealt face up in a pyramid of seven rows: one card at the top, seven along the bottom. Each card is overlapped by the two below it. The other 24 cards are the stock.
- **Ranks count:** Ace is 1, numbers are themselves, Jack 11, Queen 12, King 13.
- **Moving:** take away any two **uncovered** cards that add up to **13**, or a King on its own. A card is uncovered once both cards overlapping it are gone; the bottom row starts uncovered.
- **The stock:** turn one card at a time onto a waste pile. The top of the waste can pair with an uncovered pyramid card, or with the card turned next. Most versions allow two redeals, so three passes through the stock in all.
- **Winning:** clear the whole pyramid. Many deals cannot be won, which is why the redeals matter.
- Sources: [Pyramid (solitaire), Wikipedia](https://en.wikipedia.org/wiki/Pyramid_(solitaire)) (the pyramid of 28, pairs to 13, Kings alone, stock and redeals).

## What makes it feel right
1. Reading the pyramid for which pair frees the most.
2. The pyramid coming apart row by row, each card opening two more.
3. Kings going off on their own, free of charge.
4. Deciding whether to spend a pair now or save a card for the next pass.

## How the best apps do it
Good Pyramid apps highlight every card that pairs with the one you tapped, take a King with a single tap, show how many passes are left, and offer unlimited undo. Reviewers dislike having to hunt for the pair by eye, no undo, and a stock that runs out with no warning.

## Our design
- **Look:** our Klondike cards, pyramid centred, stock and waste along the bottom, passes left written on the stock.
- **Controls:** tap a card to pick it up, tap its partner to take them both; a King goes with one tap. Tap the stock to turn a card. Keyboard: arrows walk the uncovered cards, Enter picks up, D draws.
- **Help:** the moment a card is picked up, every card that adds to 13 with it lifts a little. Unlimited undo, and a hint that points at a pair worth taking.
- **Motion:** paired cards fly together and pop out; the cards they uncover settle down a step.
- **Messages:** plain words: "No moves left. Undo, or start a new deal.", "Last pass through the deck".
- **Players:** solo only. Unlimited undo.
- **Different from our other solitaires:** nothing is built up or stacked. Cards only leave in pairs, and the shape of the board decides what you can reach.

## Tests
The deal is 28 cards in rows of 1 to 7 with 24 in the stock; a card is only free when both cards below it are gone; a pair must add to 13; a King leaves on its own; the waste top pairs with a pyramid card; drawing moves one card; the third pass is the last; the game is won when the pyramid is empty; illegal moves throw; the deal comes from the seed so games replay exactly; undo steps back through every move.
