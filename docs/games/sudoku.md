# Sudoku

Status: brief.

## The real game
- 9×9 grid in nine 3×3 boxes, some cells given. Fill every row, column and box with 1–9 exactly once. A proper puzzle has **exactly one solution**.
- Difficulty comes from **which deductions are needed**, not the number of clues: easy puzzles fall to naked/hidden singles, medium need pairs, hard need X-wings and chains. The minimum for a unique puzzle is 17 clues.
- Sources: [Generating difficult Sudoku puzzles (D. Beer)](https://dlbeer.co.nz/articles/sudoku.html) · [How puzzles are generated](https://finalsudoku.com/sudoku-generator)

## What makes it feel right
1. Calm focus; nothing rushes you.
2. The satisfying **cascade** when one number unlocks several.
3. Pencil **notes** for candidates.
4. Clean highlighting: same numbers, row/column/box of the selected cell.
5. Finishing with no hints.

## Our design
- **Generator:** full grid by randomized backtracking (seeded) → remove clues while a solution-counting solver confirms uniqueness → a human-technique solver rates it; levels Easy / Medium / Hard / Expert by technique needed. Daily puzzle from the date seed.
- **Interaction:** tap a cell, tap a number on the big pad; a Notes toggle for pencil marks; long-press a number to highlight all of it. Undo, erase, 3 hints (a hint explains the deduction in one line).
- **Look:** white paper grid, soft grape box lines, given numbers in ink, yours in grape, notes small and soft; conflicts wiggle gently in tomato (optional "show mistakes").
- **Motion:** numbers pop in; completing a row/column/box sends a sparkle wave along it.
- **Modes:** solo; **Race** — two players on the same seed (online later), side-by-side progress.
- **Different from our other games:** pure logic, no luck.

## Tests
Generated puzzles have exactly one solution; given cells can't change; completion detected; difficulty rater orders sample puzzles; hints are always correct.
