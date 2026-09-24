# Number Match

Status: brief (2026-09-24). Rules: the pencil-and-paper game known as Take Ten, Numberama and Seeds, popular again as phone "number match" games (those app names are other people's products). Rules as in [Wikipedia, Take Ten](https://en.wikipedia.org/wiki/Take_ten) and the common app form.

## Why this instead of Nuts & Bolts
The roadmap had Nuts & Bolts here, but sorting colored nuts onto bolts is Color Sort with different pictures: the same stacks, the same "only onto the same color" rule. A reskin, which this project does not ship. Number Match is a different mechanic entirely.

## The real game
- **Rows of digits, nine to a row.**
- **Cross out two numbers that are the same or add up to ten**, when nothing but crossed-out numbers lies between them: across a row, down a column, along a diagonal, or reading on from the end of one row to the start of the next.
- **A row with nothing left in it vanishes.**
- **Stuck?** Copy every number still standing onto the end, in order, and carry on. Apps limit how often.
- **Cross them all out to win.**

## Our design
- **36 digits to start** (four rows), from the seed, and **five Adds** a game.
- **Tap a number, then its partner**: a red line strikes through both and they fade. A wrong partner buzzes and becomes the picked number. An empty row closes up with a small shake and scores ten; each pair scores one.
- **Hint** lights a pair for a moment. **Add** copies the numbers still standing onto the end.
- **The grid shrinks to fit** as rows are added.
- **Keyboard**: arrows move, Enter picks, H hints, A adds.
- Careful play clears almost every deal (59 in 60 in testing), so every game is winnable with thought.

## Tests
Pairs are the same or make ten; only crossed-out numbers may lie between them, across, down, on a diagonal and reading on; a row with nothing left vanishes and scores ten; add copies every number standing; clearing everything wins and a grid with no pair is stuck; 36 numbers from the seed; test play finishes. Invariant, every move of random play: every crossing out takes exactly two, and add doubles what is standing.
