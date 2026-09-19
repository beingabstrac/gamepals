# Crazy Eights

Status: brief (2026-09-19). Rules: the standard game, as played everywhere and as Wikipedia records it.

## The real game
- One 52-card deck. **Two players get seven cards each; three or more get five.** The rest is the stock, and its top card is turned face up to start the discard pile.
- **A legal play matches the top card by suit or by rank.** An **eight is wild**: play it at any time and say which suit the next player must follow.
- **If you cannot play, you draw from the stock until you can**, or until the stock runs out.
- **When the stock runs out**, the discard pile is turned over and shuffled back into a new stock, all but the card on top.
- **The first player to empty their hand wins.** The others count what is left in their hands: an eight is 50, a picture card is 10, an ace is 1, everything else is its own number. Low score is the aim, so the winner takes nothing.
- Sources: [Crazy Eights, Wikipedia](https://en.wikipedia.org/wiki/Crazy_Eights) (the deal, matching by suit or rank, eights as wild, drawing until playable, reshuffling the discard, the scoring values).

## What makes it feel right
1. Holding an eight back until it gets you out of trouble.
2. Watching one player's hand grow while they hunt for a heart.
3. The turn where you change suit and cut somebody off.
4. It is quick, everybody knows it, and nobody has to learn anything.

## How the best apps do it
Good Crazy Eights apps show which of your cards can be played right now, ask which suit you meant the moment you put an eight down, say plainly why a card will not go, and keep the other players' hand sizes on screen. Reviewers dislike having to guess what is playable, and bots that seem to know what is in your hand.

## Our design
- **Players:** 2 to 4, any mix of people and bots.
- **Hands are private.** Yours fans out at the bottom; everybody else shows a count and card backs. When the phone passes to another person, a cover comes down first: nobody sees a hand that is not theirs.
- **Controls:** tap a card to play it. Cards that cannot go sit lower and do not answer. Put an eight down and four big suit buttons ask which suit you meant. Tap the deck to draw when you have nothing. Keyboard: left and right walk the hand, Enter plays, D draws.
- **Drawing:** the rule is that you draw until you can play, so the app does exactly that, one card at a time so you can see it happen. Drawing when you already have a play is not offered: it only slows the game down and every app we looked at leaves it out.
- **Motion:** cards fly from hand to pile and turn as they land, the drawn card slides into the fan, and a changed suit paints the pile's edge in the new colour.
- **Messages:** plain words: "Bo is out of cards", "Suit is hearts", "Nothing to play, so you draw".
- **Bots:** four levels, and none of them can see your hand. The rules hand a bot only what that seat can see, and a test shuffles everyone else's cards behind its back to prove the same move comes out.

## Tests
The deal is seven cards each for two players and five for more; a play matches suit or rank; an eight is always legal and names the next suit; a player who cannot play draws until they can; the stock refills from the discard when it runs out; the game is won when a hand is empty; the score counts eights as 50, pictures as 10, aces as 1; illegal moves throw; the deal comes from the seed so games replay exactly; and every bot picks the same move when the hidden cards are shuffled behind it.
