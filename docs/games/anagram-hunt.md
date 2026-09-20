# Anagram Hunt

Status: brief (2026-09-20). Rules: one set of letters, find every word hiding in it, and one word uses them all. The form is old and unowned: newspaper "target" puzzles have run it for decades and Ponder Club runs one.

## The real game
- **Seven letters**, in a ring or a row.
- **Make words from them.** A letter may be used only as many times as it appears.
- **One word uses all seven**, and finding it is the moment the puzzle is built around.
- **Short words count too**, from three letters up.
- There is no losing, only how many you found.

## What makes it feel right
1. The word you see immediately, before you have finished reading the letters.
2. Grinding through the three-letter words and then spotting a six.
3. Finding the long one, and the rest falling out of it.
4. The count going up.

## How the best ones do it
They set a target below the full list, so finishing is possible at all. They say how many are left rather than which. They accept a word the moment it is typed. They never ask for obscure words to clear the puzzle.

## Our design
- **Seven letters, because six is not a game.** Measured before building, against the words we already ship:

  | Base | Common words hiding in it (median) |
  |---|---|
  | Five letters | 3 |
  | Six letters | 6 |
  | **Seven letters** | **15** |

  A five-letter base leaves more than half of all bases with fewer than four words in them, which is not a hunt. Seven gives fifteen.
- **The bases are written here**, about a hundred and fifty common seven-letter words. That is the one thing our word lists did not already have, and it is a plain list with no clues to write, so it costs little.
- **What counts is what people know.** The findable pool is the crossword's clue dictionary and the word search's themes, 1,727 words of three to six letters, all chosen to be words a person knows. Nothing obscure is ever required.
- **The target is about half**, so the puzzle can be cleared rather than ground out. Reaching it finishes the puzzle; finding the seven-letter word along the way is called out on its own.
- **Deterministic**, so the date can set a puzzle and everybody gets the same letters.
- **Bots** are autoplayers for the test builds.

## Tests
A word made only of the letters available and only as often as they appear; a word not in the pool refused; the same word twice not counting twice; the target ending it, and the target being reachable; the seven-letter word noticed; every base having enough words in it to be worth playing; the same seed giving the same letters; and bots clearing it.
