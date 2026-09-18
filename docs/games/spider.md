# Spider

Status: brief (2026-09-18). Rules: Spider solitaire, in its one, two and four suit forms.

## The real game
- Two packs (104 cards) in 10 columns: the first four hold 6 cards, the rest 5, and only the bottom card of each column is face up. The remaining 50 cards are the stock.
- **Moving:** you may move a card, or a run of cards in **descending order of the same suit**, onto a card one rank higher (any suit), or onto an empty column. Turning the top card of a column face up happens automatically.
- **Dealing:** when you are stuck, deal one card face up onto every column from the stock. **You cannot deal while any column is empty.**
- **Finishing a suit:** a full King-to-Ace run of one suit is lifted off the board. Clear all eight and you win.
- **Suits:** one suit is the gentle version, two suits the usual, four suits the hard one. All three use the same 104 cards.
- Sources: [Spider (solitaire), Wikipedia](https://en.wikipedia.org/wiki/Spider_(solitaire)) (layout, same-suit runs, dealing rule, the eight completed runs).

## What makes it feel right
1. Digging out the face-down cards one by one.
2. Building a long same-suit run and watching it fly off the board.
3. The dread of dealing a fresh row across a board you have not tidied.
4. Three difficulties from the same game, so it grows with you.

## How the best apps do it
Good Spider apps let you tap a run to move it, show which columns can take it, warn plainly when a deal is blocked by an empty column, and keep unlimited undo. Reviewers dislike unclear "why can't I deal", no undo, and runs that will not pick up as one piece.

## Our design
- **Levels:** 1 suit, 2 suits, 4 suits.
- **Look:** our Klondike felt and cards; ten columns, the stock in the corner with the number of deals left, and finished runs stacked at the side.
- **Controls:** tap a card to lift the run under it, tap a column to drop it. Tap the stock to deal a row. Keyboard: arrows pick a column, Enter lifts and drops, D deals.
- **Motion:** cards slide and turn face up with a flip; a completed run sweeps off the board with a flourish; a blocked deal shakes the stock.
- **Messages:** plain words: "Fill the empty column before dealing", "4 runs to go", "No moves left".
- **Players:** solo only. Unlimited undo.
- **Different from our other solitaires:** two packs, runs must be one suit to travel, and the stock deals onto every column at once instead of one card to a waste pile.

## Tests
The deal is 104 cards in 10 columns (6, 6, 6, 6, 5, 5, 5, 5, 5, 5) with one card face up each and 50 in the stock; a run only moves if it is descending and one suit; a card lands on one rank higher of any suit, or on an empty column; dealing puts one card on every column and is refused while a column is empty; a King-to-Ace run of one suit leaves the board; the game is won when eight runs are gone; illegal moves throw; the deal comes from the seed so games replay exactly; undo steps back through every move.
