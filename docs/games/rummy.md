# Rummy

Status: brief (2026-09-19). Rules: basic Rummy, the one most families play.

## The real game
- **Two to four players, one 52-card pack.** Ten cards each with two players, seven with three or four. The next card goes face up to start the discard pile, and the rest is the stock.
- **A turn is four things in order:** draw one card from the stock or the discard pile, put down a meld if you want to, add cards to melds already on the table if you want to, and throw one card away.
- **Melds are sets and runs:** three or four of a rank, or three or more in sequence in one suit. Aces are low.
- **Melding is optional.** Nobody has to put anything down just because they can, and holding a meld back to go out in one turn is a real way to play.
- **Laying off** means adding a card to any meld already on the table, your own or anybody else's.
- **You go out** by getting rid of your last card, by melding it, laying it off or throwing it away. A final discard is not required.
- **If the stock runs out**, the discard pile is turned over, without shuffling, and play carries on.
- **Scoring:** the winner takes the total of every other player's remaining cards. Face cards are ten, aces one, the rest their number. **Going rummy** means putting your whole hand down in one turn, having put nothing down before, and it doubles what you score.
- Sources: [Rummy, pagat.com](https://www.pagat.com/rummy/rummy.html) (two to six players, the deal sizes, the upcard and stock, the four parts of a turn in order, melding optional, sets and runs, laying off on anybody's melds, going out with no final discard, the discard pile turned over when the stock runs out, the card values, the winner taking everybody else's cards, and going rummy doubling).

## What makes it feel right
1. Holding a run back for one more turn to try to go out in one go.
2. The card somebody throws away that finishes the meld you were one short of.
3. Watching the table fill with melds you can quietly feed your loose cards to.
4. Being caught with a hand full of court cards when somebody else goes out.

## How the best apps do it
Good Rummy apps put the melds on the table where everybody can see them, show which of your cards can be laid off, sort your hand for you, and never make you prove a meld is legal. Reviewers complain about fiddly drag-and-drop melding, about not being told why a card will not go down, and about scores that appear without saying where they came from.

## Our design
- **Levels:** one deal, or a game to 100, picked at the table.
- **No dragging.** The game works out every meld your hand can make and offers them as buttons: "Put down 5-6-7 of spades". Laying off is a tap on the card, which goes to the meld it fits.
- **Melds sit in the middle** with the owner's colour on them, so the table reads as a table.
- **Hands are private**, with the cover when the phone is passed, and the count of what you are holding is always on screen.
- **Bots** are handed a seat's view: their own hand, the melds on the table, the discard pile and the size of the stock. They never see anybody's hand or the stock order. A test shuffles what they cannot see and proves they play the same card.
- **Our two deviations:** the real game deals to a rotating dealer, and we deal from a seed and start each deal one chair further round, because there is no dealer at a phone. And the rules say the pile is turned over when the stock runs out, but say nothing about what happens when that runs out as well: we throw the hand in and nobody scores, because two players taking each other's discards would otherwise sit there for ever.

## Tests
Ten cards each with two players and seven with three or four; a turn draws then throws, with melds and lay-offs in between; melding is optional; sets and runs with aces low; a lay-off has to leave the meld legal; going out ends the hand however the last card goes; the winner scores everybody else's cards; going rummy doubles it; the discard pile turns over when the stock runs out; a game to 100 stops at the target; illegal moves throw; the deal comes from the seed so games replay exactly; and every bot plays the same card when what it cannot see is shuffled.
