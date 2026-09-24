# Hangman

Status: brief (2026-09-24). Rules: the pencil-and-paper word guessing game, known since the 1890s. The name is the generic name of the game; the picture we draw is not a gallows.

## Drawn kindly
The classic picture is a hanged man. That does not belong in a bright family app, so each wrong letter pops one of the balloons holding up a little basket with a face in it. When the last goes, the basket settles gently on the ground and the word is shown. The game is the same.

## The real game
- **A hidden word**, one blank per letter.
- **Guess a letter**: if it is in the word, every place it appears is filled in; if not, a mark goes against you.
- **Fill the word before the marks run out.**

## Our design
- **Three levels**: Easy (8 balloons, words of 4 to 6 letters), Classic (7 balloons, 5 to 8), Hard (5 balloons, 7 to 9).
- **Words from our own themed lists** (the Word Search themes), with the theme shown as the clue.
- **An on-screen alphabet** of big keys, right letters turning green and wrong ones fading; a physical keyboard types letters directly.
- **Right letters drop into their slots** with a bounce; a wrong letter pops a balloon in a burst of its color. Lost, the missing letters show in red.
- **Test play** guesses the commonest letters first.

## Tests
Every level has plenty of words of the right length; a right letter shows everywhere it is and a wrong one pops a balloon; the whole word wins and the last balloon going loses; no letter twice; the same seed hides the same word; test play finishes. Invariant, every guess of random games: balloons only go down, and only for a letter not in the word.
