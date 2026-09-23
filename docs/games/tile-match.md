# Tile Match

Status: brief (2026-09-23). Rules: the triple-tile genre that phone stores are full of (Triple Tile, Zen Match, Tile Busters, Tile Master and many more, all from about 2021 on). No one owns the mechanic; we use none of their names or pictures.

## Why this and not pairs
The roadmap line said "matching free pairs". Taking free pairs off a stacked layout is Mahjong solitaire, which is its own entry in the catalogue ([12 Part 2](../12-catalog-and-direction.md)) and would make this a reskin of it. The tile-match genre is a different game: tiles go into a tray, three alike clear, and the tray filling up is how you lose. That is what we build, and Mahjong solitaire stays its own later game.

## The real game
- **A pile of tiles in layers**, each with a picture. A tile is free when no tile above overlaps it. Covered tiles show darker and cannot be taken.
- **Tap a free tile and it flies into the tray** at the bottom, which has seven places. It lands next to any tiles already there with the same picture.
- **Three alike in the tray clear** with a pop.
- **Fill all seven places without a three and you lose.**
- **Clear every tile and you win.**
- Most versions sell helpers: put the last tile back, shuffle the board, or take three tiles out of the tray to a shelf.

## What makes it feel right
1. The fly: a tile arcing from the pile into its place in the tray, and the others sliding aside to make room.
2. The pop of three, and the tray closing up after it.
3. Digging: taking a tile you do not need because of what is under it.
4. The tray at five or six, with one place left and a choice to make.

## Our design
- **Every board can be cleared.** The layout is laid first, then taken apart in a random order that only ever removes a free tile, and pictures are dealt along that order in threes, with at most two (Hard: three) threes in the tray at once. Playing that order clears the board and never holds more than seven, so a winning line always exists. Measured on the built generator over 300 boards a level: under two milliseconds a board, and a simple greedy player that takes whatever it holds most of, never looks underneath and never undoes wins 95% of Easy, 79% of Medium and 56% of Hard. So Easy is gentle, Hard needs you to dig on purpose, and every one can be won.
- **Layouts** are built in layers from the seed, mirrored left to right so they look designed, each layer half a tile in from the one below and every upper tile resting on at least two of the four it overlaps. Asking for all four was tried first and failed: upper layers almost never reached their counts, so boards came out a layer short. Easy is 42 tiles of 6 pictures in three layers, Medium 60 of 8 in four, Hard 78 of 10 in five, the same count on every board of a level (checked over 200 boards each).
- **Pictures** are our own flat vector drawings, each a shape nothing else has, so none relies on colour alone: cherry, lemon, leaf, drop, grapes, donut, carrot, star, heart, moon. Easy's six are six colours as well.
- **Moves**: take a free tile (`t<index>`), or undo the last take (`u`) while undos last. `legalMoves` lists every free tile and the undo when one is left.
- **Three undos a game.** Undo is the helper every version has; unlimited would take away the only way to lose. No shuffle and no shelf, which need more buttons than a small game wants.
- **Touch**: tap a free tile. A covered tile wobbles and stays put. **Keyboard**: arrows move between free tiles, Enter or Space takes one, U undoes.
- **Bots**: solo only, and the autoplayer plays the winning order it was dealt, so autoplay always clears.

## Tests
A tile is free exactly when nothing above overlaps it; taking a covered tile throws; a taken tile lands beside its own kind; three alike clear from the tray; seven without a three loses; clearing everything wins; undo puts the tile back where it was, restores the tray, costs one and is refused with none left; `legalMoves` lists exactly what `apply` accepts; replay reproduces a game; counts match the level and every picture comes in threes; **every board of every level is cleared by its dealt order**. Invariant, after every move of random games: every picture appears a multiple of three times across board, tray and cleared tiles; the tray never holds seven after a move that did not lose; a tile is never both on the board and in the tray.
