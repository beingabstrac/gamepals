# Snakes & Ladders

Status: built (2026-09-15). Rules: the classic 100-square race game, in the common modern form.

## The real game
- A 10 by 10 board numbered 1 to 100. The numbers wind back and forth: 1 to 10 left to right on the bottom row, 11 to 20 right to left on the next row, and so on up to 100 at the top.
- Every player starts off the board (on "square 0"). Players take turns rolling one die and move their token forward that many squares.
- **Ladder:** land on the foot of a ladder and you climb to its top.
- **Snake:** land on a snake's head and you slide down to its tail.
- Several tokens can share a square. Nobody is ever captured or knocked back.
- **Winning:** the first player to reach square 100 wins. Two house rules are very common: you need the exact roll to land on 100 (a roll that is too big bounces you back by the extra), and a 6 gives you another roll.
- It is pure luck. There are no choices to make, which is why it is loved by small children and families.
- Sources: [Snakes and ladders, Wikipedia](https://en.wikipedia.org/wiki/Snakes_and_ladders) (history, the 1-100 board, the exact-finish and roll-again house rules).

## What makes it feel right
1. The suspense of the roll: the die tumbles, then the token hops square by square so you can count along.
2. The joy of a long ladder and the groan of a long snake near the top.
3. Big, clear snakes and ladders that you can follow with your eye.
4. A short game with 2 to 4 people, where anyone can win.

## How the best apps do it
Popular apps animate the die, hop the token one square at a time, then slide it up the ladder or along the snake's body. They show whose turn it is in that player's color and let you tap anywhere (or the die) to roll. Reviewers complain about slow animations they can't speed up, boards that are hard to read on small phones and too many ads between turns. Some let a player turn off the exact-finish rule so games end faster.

## Our design
- **Levels (house rules):** *Classic* needs the exact roll for 100 and bounces back; *Quick* lets any roll that reaches 100 win. In both, a 6 gives another roll, but three 6s in a row end your turn so one player can't run away.
- **Board:** one fixed original board: bright numbered squares in a checker of two soft tones, 8 ladders (wooden, sunny) and 8 snakes (candy colored with faces), the same every game so players learn it.
- **Players:** 2 to 4, any mix of people and bots. Tokens are chunky pawns in the seat colors; tokens sharing a square sit side by side.
- **Controls:** tap the die (or anywhere on the board) to roll on your turn. Keyboard: Space or Enter rolls.
- **Motion:** the die tumbles and lands; the token hops one square at a time with a little arc; ladders lift it smoothly; snakes carry it along a curve down their body with a wobble; a bounce-back hops forward then back.
- **Messages:** "Ladder! Up to 38", "Snake! Down to 6", "Too far, bounce back", "Six! Roll again".
- **Bots:** there are no choices in this game, so every bot plays the same way: it just rolls. The levels only change the bot's name and face. How to play says this plainly.
- **Different from our other games:** Ludo also uses a die, but in Ludo you choose which token to move, you capture and you need a 6 to start. Here there are no choices at all, just one token each and the board's snakes and ladders.

## Tests
Tokens start at 0; a roll moves forward by the die; ladders lift and snakes drop; the Classic level bounces back from overshoot and the Quick level wins on any overshoot; a 6 rolls again but the third 6 in a row passes the turn; the first to 100 wins; the die is fixed by the seed so games replay exactly; moving out of turn throws; every bot plays only legal moves; the board has no snake or ladder on 1 or 100 and no square that is both.
