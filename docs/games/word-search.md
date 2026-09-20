# Word Search

Status: brief (2026-09-20). Rules: the letter grid with words hidden in it, the puzzle every newspaper and school worksheet has carried since Norman E. Gibat printed one in the Selenby Digest in 1968. The format has never been owned by anybody.

## The real game
- **A square of letters** with a list of words hidden in it.
- **A word runs in a straight line**: across, down, diagonally, and in the harder ones backwards too. Eight directions in all.
- **Words may cross** and share letters. Every other square is filled with letters that mean nothing.
- **You are done when the list is empty.** There is no way to lose, only a clock if you want one.
- No rules to cite and no trademark to dodge: "word search" is what the puzzle is called.

## What makes it feel right
1. The word you have stared past four times, suddenly standing up off the page.
2. Dragging a finger and having the band snap straight instead of wobbling with your hand.
3. The list crossing itself out.
4. The last word, when you know it is there and the grid has stopped helping.

## How the best ones do it
A theme per puzzle rather than a bag of random words, a highlight that follows the finger but locks to the eight lines, found words staying coloured in the grid so the board fills up as you go, a word in the list that you can tap to have it flash, and sizes rather than "difficulty", because a bigger grid is the difficulty.

## Our design
- **Themes, not a dictionary.** Each puzzle is one theme (Animals, Food, Space, Weather, Sport, Music, Jobs, Colours, The house, The sea, Fruit, Travel). Hand-written lists, our own words, nothing licensed.
- **Three sizes** from the table, as levels: Small 8x8 with 6 words, Medium 10x10 with 8, Large 12x12 with 10 and backwards words turned on.
- **The drag decides, not the answer.** A move is a line: where it starts, which way it goes, how long. The rules read the letters along it and say which word that is, so a word found by accident counts, and nothing in the move says what the player was looking for.
- **Deterministic.** The theme, the words, the placement and the filler all come from the seed, so the date can decide a puzzle and everybody gets the same one.
- **Filler letters avoid accidents** where they can: the grid is filled from the letters the theme's own words use, so the noise looks like it belongs.
- **Bots** exist so the test builds can finish a puzzle: they see the grid and the list, same as a person, and the tiers differ in how many false lines they try first.

## Tests
Every word placed and readable along its line; words allowed to cross but never to overwrite a different letter; the eight directions, with backwards only on the large size; a line that spells nothing refused; a word found by dragging it backwards counting as the same word; the same seed giving the same grid; finishing when the list empties; and bots that clear every size.
