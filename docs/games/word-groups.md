# Word Groups

Status: brief (2026-09-20). Rules: sixteen words, four secret groups of four, four wrong guesses. The form is the one Ponder Club runs and the New York Times made famous as Connections; the mechanic is not owned, the name is, so ours is Word Groups ([03 §4](03-game-catalog.md#4-trademark-safe-naming)).

## The real game
- **Sixteen words in a grid**, hiding four groups of four.
- **Pick four and submit.** Right and the group locks, with its name shown. Wrong and you lose one of four lives.
- **"One away"** when three of the four belong together, because being told you were close is most of the tension.
- **Four wrong guesses and it is over**, and the remaining groups are shown.
- **The groups are ranked**, from the one anybody sees to the one nobody does.

## What makes it feel right
1. Seeing five words that fit a group of four.
2. "One away", and knowing instantly which one it was.
3. The last eight words resolving at once when the trick lands.
4. Realising the obvious group was never a group at all.

## How the best ones do it
The whole game is the overlap. A puzzle where each word belongs to exactly one group is a vocabulary quiz; a good one puts two or three words where they look like they belong somewhere else, and the hard group is usually the one made of the words left over. They shuffle the board on demand, they say "one away", and they show the groups you did not get.

## Our design
- **The puzzles are written, not generated, and there is a fixed number of them.** This is the opposite call from the mini crossword, and for a good reason: a crossword's difficulty is in the grid, which a search can lay, while this game's difficulty is entirely in the traps, and a generator cannot write a red herring on purpose. So the count is finite and honest, and the seed picks one.
- **Every puzzle has at least two words that look like they belong to another group.** A puzzle without that is not finished.
- **Groups are ranked** from plain to sly, and the colour follows the rank rather than the order they were found.
- **"One away"** on three of four, because it is the best thing in the genre.
- **Shuffle** whenever you like: the board reorders, nothing else changes.
- **Deterministic**, so the date can set a puzzle and everybody gets the same one.
- **Bots** are autoplayers for the test builds, a solo puzzle having no opponent to be fair to.

## Tests
Four right words locking a group and the wrong four costing a life; "one away" on exactly three; four lives and the reveal; a guess repeated not costing twice; shuffling changing the order and nothing else; every written puzzle having sixteen different words in four groups of four; every puzzle having the overlap that makes it a puzzle; the same seed giving the same board; and bots finishing.
