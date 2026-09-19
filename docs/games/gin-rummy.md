# Gin Rummy

Status: brief (2026-09-19). Rules: the standard two-player game.

## The real game
- **Two players, one 52-card pack, ten cards each.** The twenty-first card is turned face up to start the discard pile; the rest is the stock.
- **The first turn is its own little dance:** the non-dealer may take the upcard, and if they refuse the dealer may take it. If both refuse, the non-dealer draws from the stock. Whoever takes a card discards, and then the turn passes.
- **A turn is draw one, discard one.** Draw the top of the stock or the top of the discard pile. A card taken from the discard pile cannot be thrown straight back.
- **Melds are sets and runs.** Three or four of a rank, or three or more in sequence in one suit. **Aces are low**, so A-2-3 counts and Q-K-A does not. A card belongs to one meld at a time.
- **Deadwood is what is left over.** Face cards are ten, aces are one, everything else its number.
- **Knock with ten or less.** The knocker discards face down and lays their hand out. **Gin is no deadwood at all**, worth **20** plus everything the other player is holding.
- **Laying off:** against a knock that is not gin, the other player may add their own loose cards to the knocker's melds before counting.
- **Undercut:** if the other player ends up level or lower, they score **the difference plus 10** instead.
- **The stock is not played out.** When two cards are left and the player who took the third from last discards without knocking, the hand is cancelled and nobody scores.
- **A game runs to 100.** The winner then adds **20 for each hand they won** and **100 for winning the game**, doubled to 200 if the loser never scored.
- Sources: [Gin Rummy, pagat.com](https://www.pagat.com/rummy/ginrummy.html) (two players, ten cards each, the twenty-first card turned up, the first-turn procedure, draw and discard, sets and runs with aces low, card values, knocking at ten or less, gin at 20, the undercut at 10 plus the difference, laying off, the hand cancelled with two cards left, 100 to finish, and the 20-a-hand and 100 game bonuses).

## What makes it feel right
1. Watching what the other player takes and works out what they are collecting.
2. Holding a high card one turn too long.
3. The knock at nine when you could have waited for gin, and the undercut that follows.
4. Seeing your loose cards vanish onto somebody else's melds when they lay off.

## How the best apps do it
Good Gin Rummy apps sort the hand into its best melds for you and keep it sorted, show the deadwood count at all times, only light the Knock button when it is legal, and lay the hands out side by side at the end so you can see where the points went. Reviewers complain about apps that hide the count, that make you arrange melds by hand, and about bots that seem to know what you are holding.

## Our design
- **Levels:** one hand, or a game to 100, picked at the table.
- **The hand arranges itself.** `packages/rules/src/games/melds.ts` works out the arrangement with the least deadwood, and the screen groups the cards that way, so nobody has to drag cards into order.
- **The count is always on screen**, and the Knock button only appears at ten or less. Gin says gin rather than knock.
- **Laying off is worked out for us**, taking the other player's deadwood as low as it will go against the knocker's melds. There is nothing to choose, so there is nothing to get wrong.
- **Hands are private**, with the cover when the phone is passed.
- **Bots** are handed a seat's view: their own hand, the discard pile, what the other player has taken from it, and the size of the stock. They never see the stock or the other hand. A test shuffles what they cannot see and proves they play the same card.
- **Our one deviation:** the real game deals to a rotating dealer. We deal from a seed and give the first turn to the seat that did not deal, changing seats each hand, because there is no dealer at a phone.

## Tests
Ten cards each and a face-up twenty-first; the first-turn offer goes to the non-dealer, then the dealer, then the stock; a turn is one draw and one discard; a card taken from the discard pile cannot go straight back; sets and runs with aces low; the arrangement found is the one with the least deadwood; knocking needs ten or less; gin scores 20 plus what the other player holds; laying off reduces the other player's count; an undercut scores the difference plus 10; the hand is cancelled when the stock runs down to two; a game to 100 adds 20 a hand and 100 for the game, 200 for a shutout; illegal moves throw; the deal comes from the seed so games replay exactly; and every bot plays the same card when what it cannot see is shuffled.
