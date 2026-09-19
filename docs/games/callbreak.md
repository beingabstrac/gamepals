# Callbreak

Status: brief (2026-09-19). Rules: the game as it is played across India, Nepal and Bangladesh, and in the phone apps everybody there plays.

## The real game
- **Four players, each for themselves.** A standard 52-card pack, **thirteen cards each**, and **spades are always trump**.
- **Everybody calls** how many tricks they will take before a card is played. **The smallest call is one**, so nobody can sit a hand out.
- **Follow the suit that was led if you can, and beat the highest card of that suit if you can.** Holding the suit but nothing higher, play any card of it. This is the part that makes Callbreak its own game: you are not allowed to keep a winner back.
- **With none of the suit led, you must trump**, and the spade has to beat any spade already on the trick. If no spade of yours can beat them, play whatever you like.
- **The highest spade takes the trick**, and with no spade in it, the highest card of the suit led. The winner leads the next one. Spades may be led whenever you like, unlike Spades, where they have to be broken first.
- **Scoring**: make your call and you score it, plus **a tenth of a point for every trick over it**. Fall short and your call is taken off your score.
- **A game is five rounds**, and the highest total wins.
- Sources: [Call Bridge, pagat.com](https://www.pagat.com/auctionwhist/call_bridge.html) (four players, thirteen each, spades permanently trump, following suit, the must-beat-the-spades-already-played rule, the highest spade taking the trick, calls added or subtracted, five deals, and the tenth of a point for overtricks as a listed variation), [catsatcards.com](http://www.catsatcards.com/Games/Call-Break.html) (the smallest call of one, exactly five rounds, and the scoring: the call made, 0.1 a trick over, the call subtracted when short), [callbreak.org](https://callbreak.org/call-break-card-game-rules/) (must play a higher card of the suit led if you hold one; any card of the suit if not; a trump when void).

## What makes it feel right
1. Being forced to spend a winner early because the rules will not let you hold it back.
2. Counting the spades that have gone and knowing yours is now the highest.
3. The last trick of a hand where a call of four is sitting on three.
4. Watching somebody who called seven quietly lose seven.

## How the best apps do it
Callbreak apps show everybody's call and tricks taken next to their seat, run five rounds with a table of scores between them, and grey out the cards the rules will not let you play. Reviewers complain about bots that make impossible calls, about not being told why a card was refused, and about scores that only show at the end.

## Our design
- **Levels:** one round or the full five, picked at the table. Five rounds is the real game, and it is a long sitting on a phone, so one round is what the table offers first, the same as Hearts and Spades.
- **Scores are kept in tenths** inside the rules (a score of 4.1 is 41) so nothing rounds badly, and shown as one decimal place.
- **Cards you cannot play sit back and say why**, the same as Hearts and Spades, and here that matters more: the reason is usually "beat the ten of hearts", which is not obvious to somebody new.
- **The calls row is one to thirteen**, no nil, because the smallest call in this game is one.
- **Hands are private**, with the cover when the phone is passed.
- **Bots** are handed a seat's view: their own cards, the calls, the trick, what has been played and the scores. They count winners to call, take a trick with the cheapest card that does it, and duck when they cannot win. A test shuffles the other hands behind each level to prove the same card comes out.
- **Our one deviation:** the real game deals counter-clockwise to a rotating dealer, and the dealer's right-hand player leads. We deal from a seed and start each round one chair further round the table, because there is no dealer at a phone.

## Tests
Thirteen cards each and spades are trump; the smallest call is one; you must beat the highest card of the suit led when you hold a higher one, and may play any card of that suit when you do not; a void player must trump, and must beat the spades already played when able; the highest spade takes the trick, otherwise the highest card of the suit led; spades may be led at any time; making a call scores the call plus a tenth for each trick over; falling short takes the call off; a game is five rounds and the highest total wins; illegal moves throw; the deal comes from the seed so games replay exactly; and every bot plays the same card when the other hands are shuffled behind it.
