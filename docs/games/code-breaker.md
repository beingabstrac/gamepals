# Code Breaker

Status: brief (2026-09-24). Rules: the code-breaking game of Bulls and Cows, played with pencil and paper long before Mastermind (a trademark, and a product) put it in pegs in 1970. Our name follows the naming rule in docs/03 (Mastermind to Code Breaker). Rules as in [Wikipedia, Bulls and Cows](https://en.wikipedia.org/wiki/Bulls_and_cows).

## The real game
- **A hidden code** of colored pegs.
- **Each guess is marked**: one mark for each peg that is the right color in the right place, another for each that is the right color in the wrong place, never counting a peg twice, and never saying which pegs the marks mean.
- **Crack it in as few guesses as you can**, before the rows run out.

## What makes it feel right
1. The first mark that is not nothing.
2. Reasoning out which peg a mark means.
3. The code popping up on top when you crack it.

## Our design
- **Three levels**: Easy (4 pegs from 6 colors, no repeats, 10 rows), Classic (4 from 6, repeats allowed, 10 rows) and Hard (5 from 8, repeats, 12 rows).
- **Tap colors to fill the row**, tap a peg to take it out, **Check** to mark it. Full dots for right place, open dots for right color. The covered code sits on top and is shown at the end.
- **Every peg carries its number** (the key that picks it), so nobody has to tell colors apart by hue.
- **Keyboard**: number keys, Backspace, Enter.
- **Any row is a guess**, even one the clues already rule out: the rules answer `allows` and never stop a person making a mistake. On Easy a repeated color buzzes rather than wasting a row, since the code has none.
- **Test play** always guesses a code the clues still allow and cracks Classic in about five.

## Tests
Marking counts right place first and never a peg twice; codes fit their level (Easy has no repeats); cracking it wins and running out loses; any row of the right shape is allowed and nothing else; the same seed hides the same code; test play cracks it well inside the rows. Invariant, every guess of random games: the real code is always among the codes the clues allow.
