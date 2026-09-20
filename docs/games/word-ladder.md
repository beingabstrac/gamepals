# Word Ladder

Status: brief (2026-09-20). Rules: the puzzle Lewis Carroll invented as "Doublets" for *Vanity Fair* at Christmas 1877. Change one letter at a time, every step a real word, get from the first word to the last. Nobody owns it.

## The real game
- **Two words of the same length**, and you climb from one to the other.
- **One letter changes at a time**, and the letters stay in their places: no adding, no removing, no shuffling.
- **Every rung is a real word.** That is the whole constraint.
- **A word may not be used twice**, or a ladder can wander in circles.
- Carroll's own example is HEAD to TAIL, and the shortest is five rungs.

## What makes it feel right
1. Seeing the rung that opens the way, three moves before you need it.
2. Being one letter from the target and unable to make it a word.
3. Beating the par.
4. The moment a word you would never have thought of turns out to be the bridge.

## How the best ones do it
They say the shortest number of steps up front, so there is something to beat rather than just an end. They let you take a rung back without starting again. They keep the words to ones people know, because a ladder that only goes through obscure words is not a puzzle, it is a dictionary test.

## Our design
- **Three lengths as levels, and the lists were measured, not guessed.** A ladder needs a word list dense enough to connect, so the graph was built for each list we already ship before any of this was written:

  | List | Words | Biggest connected piece |
  |---|---|---|
  | Clue dictionary, three letters | 216 | 194 (89%) |
  | Clue dictionary, four letters | 582 | 481 (82%) |
  | Clue dictionary, five letters | 833 | **86 (10%)** |
  | Word Guess answers, five letters | 2,332 | 1,207 (51%) |

  So: Short is three letters and Medium four, both from the crossword's clue dictionary, and Long is five letters from the Word Guess answers. The crossword's own five-letter words are useless for this, which is exactly the kind of thing that is cheap to measure and expensive to find out later.
- **No new word list.** Every word already ships for another game, and all of them are words people know, because they were picked to be cluable or guessable.
- **Par is the shortest ladder there is**, worked out when the puzzle is laid, and shown from the start. Going over par still finishes.
- **A rung can be taken back** rather than starting again.
- **Deterministic**, so the date can set a ladder and everybody gets the same one.
- **Bots** are autoplayers for the test builds: a solo puzzle has no opponent to be fair to.

## Tests
Only one-letter changes accepted, and only into a word on the list; a word refused twice on the same ladder; taking a rung back; the target ending it; par being the real shortest, checked against a search; the same seed giving the same ladder; every level laying a ladder for many seeds; and bots finishing all three lengths.
