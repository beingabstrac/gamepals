# Mini Crossword

Status: brief (2026-09-20). Rules: the 5x5 crossword, the small daily kind. The crossword itself has been in newspapers since Arthur Wynne's "word-cross" in 1913 and the form has never been owned; the famous small one is the New York Times Mini, so ours is Mini Crossword and everything in it is written here.

## The real game
- **A square with black squares in it.** Every white square belongs to one word across and one word down.
- **Words are numbered** where they start, and the clues are listed under Across and Down.
- **A letter is shared** by the across word and the down word that cross on it, which is the whole point: a clue you cannot get is given to you by the one that crosses it.
- **A 5x5 holds about ten words**, three to five letters each, and takes a minute or two.

## What makes it feel right
1. One clue you cannot get, solved by the letters of the two that cross it.
2. Typing a letter and watching the other clue become obvious.
3. The grid filling from the corners inward.
4. Finishing without ever asking for help.

## How the best ones do it
The clue for the word you are standing in sits right under the grid, so you never look away. Tapping a square you are already in switches between across and down. Typing runs on to the next square by itself and skips the ones already filled. Wrong letters are not called out unless you ask, because being told immediately takes the puzzle away.

## The source decision (2026-09-20)
**A clue dictionary of our own, not written puzzles.** Hand-writing whole puzzles caps the game at however many were written, and the daily would run out. Hand-writing one clue per word does not: the same words fill an unlimited number of grids, and the date picks one. A permissive dictionary is no help, because a dictionary definition is not a crossword clue. So: 1,631 words of three, four and five letters, each with a clue written here, and a filler that lays a grid out of them.

## Our design
- **The filler is a backtracking search** over the clue dictionary. It always fills the slot with the fewest words left, tries words in the order the seed shuffles them, and after every placement checks that every unfinished word still has something it could become and every finished one is a word we can clue. That last check matters: a crossing can finish a word the filler never chose, and without it those come out as whatever the letters happened to spell.
- **The block patterns were chosen by measurement, not by eye.** A 5x5 with six five-letter words needs a far bigger vocabulary than a clue dictionary can hold: those patterns failed to fill half the time, took half a second when they worked, and forty seeds gave the same grid five times over. The six patterns we kept always fill, in under two hundred milliseconds, and forty seeds give thirty-four different grids. They are also the shape a mini really has: blocked corners, short outer words, one long word through the middle.
- **Deterministic**, so the date can pick a puzzle and everybody gets the same one.
- **No repeated word** inside one grid, which reads like a mistake.

## Tests
Every word three to five letters with exactly one clue, and no clue that says its own word; every pattern five by five with no word of one square, and every white square in both an across and a down word; every laid grid made only of words we can clue; the same seed giving the same grid; forty seeds giving at least thirty different ones, against thirty-four measured; and a puzzle laid in well under the time a person would notice.
