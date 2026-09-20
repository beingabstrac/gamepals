# Word Guess

Status: brief (2026-09-20). Rules: the daily five-letter guessing game everybody knows, written from the mechanic rather than from anybody's implementation.

## The real game
- **A five-letter word, six goes.** Every guess must be a real word.
- **Each letter comes back one of three ways:** in the word and in the right place, in the word but somewhere else, or not in the word at all.
- **A repeated letter only counts while the secret has one spare.** Guess EERIE against CRANE and the E in the last place is right, while the other two Es are marked as absent, because the only E is already accounted for. This is the rule most copies get wrong.
- **One word a day** is how the game is usually played, and everybody gets the same one.
- No sources to cite for rules everybody knows, but the naming rule matters: the famous version is a trademark of the New York Times, so ours is Word Guess and the colours are our own ([03 §4](03-game-catalog.md#4-trademark-safe-naming)).

## What makes it feel right
1. The second guess, when three letters are yellow and none of them will sit still.
2. Realising a letter is doubled.
3. Getting it in three.
4. The last go, with two words left and no way to tell them apart.

## How the best ones do it
They colour the keyboard as well as the grid, shake a row that is not a word rather than ignoring the tap, keep the answer list to words people know while allowing any real word as a guess, and say the answer when the goes run out.

## Our design
- **Two lists.** 2,332 common words can be the secret; 8,585 can be typed. Both come from ENABLE, which is public domain, with plurals of four-letter words kept out of the answers and anything unpleasant kept out of both.
- **The keyboard is coloured** with the best thing known about each letter, and a letter that turns out right beats what an earlier guess said.
- **A word we do not know shakes the row** and says so, rather than swallowing the guess.
- **It fits the daily.** The secret comes from the seed, so the date decides the word and everybody gets the same one.
- **Bots** exist so the game can be played to the end in the test builds: they only see the guesses and the marks, never the secret, and the expert one picks the guess that splits what is left most evenly.

## Tests
Marking, including the repeated-letter rule that everybody gets wrong; six goes and a win that ends it; running out and losing; any real word allowed and nonsense refused; the keyboard knowing the best thing about each letter; both word lists sound and every answer guessable; the same seed giving the same word; bots that cannot see the secret; and the expert solving most of twenty games and replaying exactly.
