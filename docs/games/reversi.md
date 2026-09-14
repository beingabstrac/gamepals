# Reversi

Status: built (2026-09-14). "Othello" is a trademarked name for this game, so we use the generic name Reversi.

## The real game
- 8×8 board. Four discs start in the middle: two dark and two light, crossed (dark on the upper right and lower left). Dark moves first.
- On your turn, place a disc so it traps one or more straight lines (across, down or diagonal) of the other color between it and another of your discs. Every trapped disc, in all eight directions, flips to your color.
- If you have no legal move, you pass. If neither player can move, or the board is full, the game ends.
- Most discs showing wins. Equal counts are a draw.
- Source: [Reversi, Wikipedia](https://en.wikipedia.org/wiki/Reversi).

## What makes it feel right
1. The ripple as a whole line of discs flips at once.
2. Big swings late in the game: the score can turn over in a few moves.
3. Corners: once taken, they can never flip back.
4. Clear legal squares, so nobody hunts for a move.

## How the best apps do it
Good Reversi apps show legal squares as soft dots, animate flips one after another, show the disc count all game long, explain passes, and offer undo and several bot levels. Reviewers dislike bots that play instantly and never make mistakes on easy levels.

## Our design
- **Look:** a mint board with cream grid lines on a white tray; chunky ink (dark) and white (light) discs with a colored lip.
- **Controls:** tap a glowing dot to place a disc. Keyboard: arrows move a ring, Enter places.
- **Motion:** the new disc drops in with a bounce; trapped discs flip with a squeeze turn, rippling outward from the new disc.
- **Passing:** when you have no move, a message says so plainly ("No moves, you pass") and play passes on.
- **Score:** both disc counts show under the board all game.
- **Players:** vs a bot, or 2 players on one device.
- **Bots:** search ahead with alpha-beta and value squares like strong players (corners are gold; squares next to an empty corner are risky). Pip looks 1 move ahead and makes mistakes; Bo 2; Zed 4; Nova 5, and Zed and Nova also count how many moves they leave the other side. Near the end they count discs exactly. Nova thinks about 0.1 seconds a move (0.4 at most) on a laptop; the bot Web Worker will keep phones smooth.
- **Different from our other games:** the only game where every move can change who owns half the board.

## Tests
4 legal first moves; a move must flip at least one disc; flips go in every direction and stop at the first disc of your own color; passing when you have no move; the game ends when neither side can move or the board is full; most discs wins, a tie is a draw; illegal moves throw; bots play only legal moves; games replay exactly; Zed beats Pip.
