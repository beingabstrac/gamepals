# Nonogram

Status: brief (2026-09-24). Rules: the picture logic puzzle published by Non Ishida and Tetsuya Nishio in 1987 and known as Griddlers, Picross (a trademark) and Paint by Numbers. The name nonogram is generic. Rules as in [Wikipedia, Nonogram](https://en.wikipedia.org/wiki/Nonogram).

## The real game
- **A grid with numbers beside each row and above each column.** The numbers are the runs of filled squares in that line, in order, with at least one empty square between runs.
- **Fill the squares** so every line matches its numbers. Players mark squares they know are empty with a cross.
- **Good puzzles have one answer and never need a guess.**

## What makes it feel right
1. The first line you can fill completely.
2. A clue graying out as its line comes right.
3. The picture appearing.

## Our design
- **Three sizes**: 5 by 5, 10 by 10 and 15 by 15, picked at the table.
- **Pictures mirrored left to right**, like little sprites, a bit over half filled, with no empty lines. Each is only dealt if pure line logic (every line on its own, round and round) solves it completely, which also proves it has exactly one answer: like Sweeper, it never needs a guess.
- **Tap or drag to paint**: the first square decides what the drag does (fill blanks, or clear fills). **Fill** and **Mark ×** are two big buttons, so nothing needs a long press. Clues gray out as their line matches. Heavier lines every five squares on big grids, as on paper.
- **Keyboard**: arrows move, Space fills or clears, X marks.
- **Solved** when the filled squares are the picture; marks count as empty. The picture turns pink and confetti goes up.

## Tests
Runs in a line; line logic finds the squares every fit agrees on and spots a contradiction; every picture is mirrored, has no blank lines, and line logic alone solves it; filling the picture wins and marks do not count; a wrong square blocks the win until cleared; a line lights up when it matches; test play solves it; the same seed deals the same picture. Invariant, every move of random play: the picture never changes and only one square changes a move.
