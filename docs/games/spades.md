# Spades

Status: brief (2026-09-19). Rules: the standard partnership game.

## The real game
- **Four players in two partnerships**, sitting across from their partner. Spades are always trump.
- The whole deck goes round, **thirteen cards each**.
- **Everybody bids the number of tricks they expect to take**, going round the table. **A partnership's two bids are added together**: that pair is the contract.
- **Nil is a bid of nothing.** Take no tricks and it is worth 100; take even one and it costs 100.
- The player to the dealer's left leads, and **spades cannot be led until one has been played to trump another trick.**
- **Follow the suit that was led if you can.** If you cannot, play anything, including a spade to trump it.
- **Making the contract scores ten for each trick bid**, plus **one for every trick over it**, which is a bag. **Falling short costs ten for each trick bid.** Every ten bags a partnership collects costs them 100.
- **First to 500 wins.**
- Sources: [Spades, Wikipedia](https://en.wikipedia.org/wiki/Spades_(card_game)) (partnerships, the deal, bidding round the table and adding partners' bids, nil at 100, the left of the dealer leading, no leading spades until broken, following suit and trumping, ten a trick with a bag each over, the 100-point sandbag penalty, and 500 to win).

## What makes it feel right
1. Deciding whether the hand in front of you is worth three or four.
2. Your partner bidding nil and you having to carry the whole contract.
3. Watching somebody's nil come apart on the last trick.
4. The bag you did not want, and the hundred it costs ten hands later.

## How the best apps do it
Good Spades apps show both partnerships' bids and what they have taken so far, mark nil clearly so nobody forgets whose it is, count the bags where you can see them, and warn before a bid that cannot be made. Reviewers dislike bots that bid nonsense, and not being able to see the running bag count.

## Our design
- **Levels:** one hand, to 200, or to 500, picked at the table. A full game to 500 is a long sitting.
- **Bidding is a row of numbers**, 0 to 13, with nil sitting apart from the rest so it is never a slip of the thumb.
- **The scoreboard shows both sides:** bid, taken so far, and bags, all the way through the hand.
- **Cards you cannot play sit back** and say why, the same as Hearts.
- **Hands are private**, with the cover when the phone is passed.
- **Bots** are handed a seat's view: their own cards, the bids, the trick, what has been played, the scores and bags. They count winners to bid, lead trumps when they are long, and duck when their partner is already taking it. A test shuffles the other hands behind each level to prove the same card comes out.
- **Messages:** plain words: "Blue bid 7", "Nova went nil", "Two bags".
- **Our one deviation:** the real game deals to a rotating dealer and bids from the dealer's left. We deal from a seed and bid from the first chair, because there is no dealer at a phone.

## Tests
Thirteen cards each and spades are trump; bidding goes round once and partners' bids add up; nil scores 100 made and costs 100 broken; spades cannot be led until one has trumped a trick; you must follow suit when you can; the highest spade takes a trick that has one, otherwise the highest card of the suit led; making the contract scores ten a trick with a bag each over, and falling short costs ten a trick; ten bags cost 100; the game ends at the target and the higher score wins; illegal moves throw; the deal comes from the seed so games replay exactly; and every bot plays the same card when the other hands are shuffled behind it.
