# Impostor

Status: brief (2026-09-24). Rules: the pass-the-phone word party game, the family of Spyfall (a published card game) and the many "who is the impostor" phone games: everyone but one person knows the secret word, and the table has to find the one faking it. The published names are other people's products; ours is Impostor, with our own word lists.

## The real game
- **Everyone gets a card.** All but one show the same secret word; one says "impostor".
- **Round the table, each person says one word about the secret**, close enough to show they know it, vague enough not to give it away to the impostor.
- **Then everyone votes** on who the impostor is.
- **If the table picks the impostor, the impostor gets one guess at the word.** A right guess still wins it for them; otherwise the table wins. If the table picks the wrong person, the impostor wins.

## What makes it feel right
1. Looking at your card with your hand over the screen.
2. The impostor's first word, a bluff that has to sound like a clue.
3. The vote, and the reveal.
4. A caught impostor who works the word out from the clues and steals the win.

## How the best ones do it
The phone versions pass one phone round: a cover says whose turn it is to look, the card shows for as long as they hold it, then covers again for the next person. They show the category to everyone (the impostor included, which gives them a fighting chance), pick who starts, and keep the vote to one tap each.

## Our design
- **Three to eight people on one phone.** This needs a table the others do not: a count of players rather than four chairs, so games marked `party` in the registry get player-count chips and a row of faces instead of the chairs round a table.
- **Ten word sets of our own** (places, food, animals, jobs, sports, at home, weather, things to wear, travel, party), ten words each, and the set is shown to everyone.
- **The reveal**: "Pass the phone to Player 3", tap to look, the card shows, tap to hide and pass. Nobody sees anybody else's card.
- **Talk**: the phone says who starts and to go round once, each saying one word. A timer for as long as the table wants, and a button when they are ready to vote.
- **Vote**: the table agrees who to accuse and taps their name.
- **The guess**: caught, the impostor picks the word from six in the same set.
- **No bots.** A talking game needs people. The test mode plays it through like a quiet table so CI can finish it.

## Tests
One impostor, everyone else sees the word; the reveal goes round every seat in order and then opens the talk; accusing someone else hands the impostor the win; accusing the impostor opens the guess; a right guess wins for the impostor and a wrong one for everyone else; the six choices include the word and are all from its set; the same seed deals the same game; `legalMoves` lists exactly what `apply` accepts. Invariant, every move of random games: there is exactly one impostor, and only the seat whose turn it is can move.
