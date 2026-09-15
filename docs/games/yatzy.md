# Yatzy

Status: built (2026-09-15). Rules: the Scandinavian public-domain dice game (our name follows docs/03: never the trademarked name).

## The real game
- Five dice. On your turn you roll up to three times. After each roll you may keep any dice and reroll the rest.
- After your rolls you must write a score in one empty box of your score card, even if it scores 0. Every box is used once, so a game is 15 turns.
- **Upper section:** Ones, Twos, Threes, Fours, Fives, Sixes: the sum of the dice showing that number. If the six boxes add up to 63 or more (three of each), you get a **bonus of 50**.
- **Lower section (Scandinavian Yatzy scoring):**
  - One Pair: sum of the highest pair. Two Pairs: sum of two different pairs.
  - Three of a Kind, Four of a Kind: sum of those dice.
  - Small Straight 1-2-3-4-5: 15. Large Straight 2-3-4-5-6: 20.
  - Full House (three of one number and two of another): sum of all dice.
  - Chance: sum of all dice.
  - Yatzy (all five the same): 50.
- Highest total wins. Equal totals share the win.
- Sources: [Yatzy, Wikipedia](https://en.wikipedia.org/wiki/Yatzy) (Scandinavian scoring, the 63 bonus of 50, the 15 boxes); [Yahtzee, Wikipedia](https://en.wikipedia.org/wiki/Yahtzee) for how the American version differs (we don't use its rules or name).

## What makes it feel right
1. Shaking and throwing the dice, then choosing what to keep.
2. Seeing every box's score before you pick it.
3. Chasing the upper bonus and gambling on a Yatzy.
4. Tension over which box to "waste" a bad roll on.

## How the best apps do it
Good dice apps show a preview score in every open box after each roll, let you tap a die to keep it (it slides to a keep row), count the rolls left clearly and total the card for you. Reviewers dislike unclear scoring, no preview, slow dice animations and bots that roll instantly without showing what they kept.

## Our design
- **Players:** solo (beat your best), vs bots, or 2 to 4 on one device, each with their own score card column.
- **Look:** chunky white dice with candy pips tumble on a felt-free soft tray (flat color, no gradient). Kept dice lift up and get a sunny outline. The score card is a clean list of boxes with the preview score in grey and written scores in the player's color.
- **Controls:** tap Roll; tap a die to keep or free it; tap a box to score it. Keyboard: Space or R rolls, 1 to 5 keep dice, Tab to a box and press Enter.
- **Motion:** dice tumble with real bounce and spin, landing one after another; a written score pops; a Yatzy gets confetti.
- **Messages:** "2 rolls left", "Pick a box to score", "Bonus! +50", "Yatzy!"
- **Bots (never cheat, can't see future dice):** Pip keeps pairs and scores the highest box; Bo keeps the best-looking set and prefers the upper bonus; Zed and Nova choose which dice to keep by trying every choice against simulated rerolls (Monte Carlo with their own random dice, never the game's), and pick boxes by expected value, with Nova looking further at the bonus and the boxes still open.
- **Different from our other dice games:** Ludo and Snakes & Ladders race tokens on a board. Here there is no board, only dice, a score card and choices every turn.

## Tests
Every box scores right (pairs pick the highest, two pairs need different numbers, straights, full house needs 3+2, Yatzy 50); the upper bonus comes at 63; three rolls at most; keeping dice leaves them unchanged; a box can only be used once; the game ends after 15 turns each; dice come from the seed so games replay exactly; bots play only legal moves; Nova scores more than Pip on average.
