# Go Fish

Status: brief (2026-09-19). Rules: the standard children's game, as Wikipedia records it.

## The real game
- **Two or three players get seven cards each; four or more get five.** The rest goes face down in the pool.
- On your turn you **ask one player for a rank**, and **you must already hold a card of that rank**. No asking for what you have not got.
- If they have any, **they hand over all of them** and you **ask again**. If they have none they say "go fish": you draw one card from the pool and your turn ends.
- Four of a rank is a **book**, laid face up in front of you the moment you have it.
- The game is over when all thirteen books are down. **Most books wins.**
- Sources: [Go Fish, Wikipedia](https://en.wikipedia.org/wiki/Go_Fish) (the deal by player count, holding the rank you ask for, handing over all of them, going again, drawing on "go fish", books, and the winner being the one with the most books).

## What makes it feel right
1. Remembering what somebody asked for three turns ago and taking it off them.
2. The run of three or four asks in a row when you are on a roll.
3. Laying a book down.
4. A small child can play it, and beat you.

## How the best apps do it
Good Go Fish apps show what everybody has asked for, so remembering is possible without a notebook; they make asking two easy taps rather than a menu; and they say out loud what just happened ("Bo had two sevens"). Reviewers dislike bots that ask for a rank they cannot possibly want, which is what a bot that has been peeking looks like.

## Our design
- **Players:** 2 to 4, any mix of people and bots. Two or three get seven cards, four get five, as the real game says.
- **Asking is two taps:** tap a rank in your own hand, then tap the player you want it from. Ranks you do not hold are not offered, because the rules do not allow it.
- **Everybody's asks are on the table.** Every ask and what came of it is public, shown as a short line under each player, because in the real game you heard it said out loud.
- **Hands are private,** the same as Crazy Eights: your cards fan at the bottom, everybody else shows a count, and a cover comes down when the phone is passed.
- **Bots** are handed a seat's view: their own cards, the books down, how many cards everybody holds, the pool size, and the asks everybody has heard. The better levels remember the asks; the easy one forgets. A test shuffles the hidden cards behind each level to prove none of them are peeking.
- **Messages:** plain words: "Go fish", "Bo had two sevens", "That is a book of kings".
- **Our one deviation:** the standard says your turn ends when you go fish, and that is what we do. Some houses let you carry on if you draw the very rank you asked for; we do not, because the rule people know is the plain one.

## Tests
Seven cards each for two or three players and five for four; you may only ask for a rank you hold; a player with the rank hands over all of it and the asker goes again; a player without it sends you fishing and the turn passes; four of a rank becomes a book at once; the game ends when thirteen books are down and the most books wins; a draw is possible; illegal moves throw; the deal comes from the seed so games replay exactly; and every bot picks the same ask when the hidden cards are shuffled behind it.
