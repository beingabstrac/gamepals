# Old Maid

Status: brief (2026-09-19). Rules: the standard children's game, as Wikipedia records it.

## The real game
- **One queen is taken out** of the deck, leaving 51 cards and three queens. Two of them will find each other; the third is the old maid.
- All 51 cards are **dealt out one at a time**, so some players hold one more than others.
- Everybody **throws away the pairs they were dealt** straight away. Three of a rank means throwing two and keeping one; four means two pairs.
- A turn is one thing: you **offer your hand face down to the player on your left, and they take a card from it**. If it pairs with something they hold, that pair goes down too.
- **A player with no cards left is out**, and safe.
- The game ends when only the odd queen is left. **Whoever is holding it is the old maid**, and everybody else has won.
- Sources: [Old maid (card game), Wikipedia](https://en.wikipedia.org/wiki/Old_maid_(card_game)) (removing one queen, dealing singly, discarding pairs at the start, offering a fan to the player on the left, dropping out when empty, and the holder of the single queen losing).

## What makes it feel right
1. Holding the queen and trying to look exactly as you did a minute ago.
2. The hand offered to you, all backs, and having to just pick one.
3. Getting rid of it, and watching the next person realise.
4. There is no skill in it at all, and it does not matter.

## How the best apps do it
Good Old Maid apps make the offered hand feel like a real fan of cards to choose from rather than a list, show pairs leaving the hand as it happens, and say who is out. Reviewers dislike bots that always take the right card, which is what a bot that can see the fan looks like.

## Our design
- **Players:** 2 to 4, any mix of people and bots.
- **Taking a card is one tap** on the fan the player before you is holding out. The fan is face down, and it stays that way: the card turns over only once it is yours.
- **Pairs leave on their own** the moment they meet, with both cards flying off together.
- **Hands are private,** the same as the other dealt-hand games: a cover comes down when the phone is passed.
- **Bots pick blind.** The rules hand a bot how many cards the fan holds and nothing else about it, so there is no card it could aim for. A test shuffles the offered hand behind each level to prove the same position still gets picked.
- **Messages:** plain words: "Bo is out", "Pair of sevens", "You are holding the old maid".
- **Our deviation:** pairs are by rank alone, as the standard says. Some houses pair by colour too, which halves the pairs and doubles the game; we do not.

## Tests
One queen is missing and 51 cards are dealt; pairs dealt at the start are thrown away before anybody plays, and three of a rank leaves one; a turn takes one card from the hand on the left; a pair made by that card goes down at once; a player with an empty hand is out and stays out; the game ends with one card left; the holder of the odd queen loses and everybody else wins; illegal moves throw; the deal comes from the seed so games replay exactly; and every bot picks the same position when the offered hand is shuffled behind it.
