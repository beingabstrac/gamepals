# FreeCell

Status: brief (2026-09-18). Rules: standard FreeCell, the version shipped with Windows and played everywhere.

## The real game
- All 52 cards are dealt face up into 8 columns: the first four hold 7 cards, the last four hold 6. Nothing is hidden.
- Above the columns are **four free cells** (each holds one card) and **four foundations** (one per suit).
- **Moving:** you may move one card at a time. A card goes onto a column card of the **opposite colour and one rank higher**, onto an empty free cell, onto an empty column, or onto its foundation (Ace first, then up in suit).
- **Moving a run:** apps let you drag several cards at once as a shortcut for moving them one at a time through the free cells. The most you can move is **(free cells + 1) × 2^(empty columns)**, and half that when moving onto an empty column.
- **Winning:** every card on its foundation. Almost every deal is winnable (of the classic 32,000 Microsoft deals, only #11982 is not), so a lost game is your fault, not the shuffle's, which is why people like it.
- Sources: [FreeCell, Wikipedia](https://en.wikipedia.org/wiki/FreeCell) (layout, free cells, the supermove formula, the unwinnable deal).

## What makes it feel right
1. Everything is face up: it is a puzzle, not a gamble.
2. Planning a long chain of moves through the free cells and watching it work.
3. The satisfaction of a board that unravels all at once at the end.
4. Knowing that if you lose, there was a way through.

## How the best apps do it
Good FreeCell apps move a whole run when you tap it (and say so when there is not enough room), send cards home automatically once nothing can need them, highlight where a card can go, and offer unlimited undo. Reviewers dislike having to move cards one at a time, and no undo.

## Our design
- **Look:** the green felt and card faces of our Klondike, so the two look like one family. Free cells on the left, foundations on the right, eight columns below.
- **Controls:** tap a card to lift it, tap where it goes. Tap a card with an obvious home and it goes there. Keyboard: arrows pick a column, Enter lifts and drops.
- **Runs:** tap the top of a run and we move as many as the free cells allow, and say "Not enough free cells" when the run is too long.
- **Motion:** cards slide with a small arc; the foundations pop when a card lands; winning cascades the whole board.
- **Messages:** plain words: "Not enough free cells", "No moves left", "Solved in 63 moves".
- **Players:** solo only, like the other solitaires. Unlimited undo.
- **Different from Klondike:** nothing is hidden and there is no stock to draw from. Every card is visible from the first second; the whole game is planning.

## Tests
The deal is 52 cards, 8 columns of 7, 7, 7, 7, 6, 6, 6, 6; a card only lands on the opposite colour one rank higher; free cells hold one card each; foundations go up in suit from the Ace; the longest movable run follows (free + 1) × 2^empty, halved onto an empty column; the game is won when all 52 are home; illegal moves throw; the deal comes from the seed so games replay exactly; undo steps back through every move.
