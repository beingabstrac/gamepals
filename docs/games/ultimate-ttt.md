# Ultimate Tic-Tac-Toe

Status: built (2026-09-15). Rules: the standard modern game of nine small boards inside one big board.

## The real game
- The big board is a 3 by 3 grid of small tic-tac-toe boards: 81 squares in all. X goes first.
- **Where you may play:** the square you pick inside a small board sends your opponent to the matching small board. Play the top-right square of any small board, and your opponent must play next in the top-right small board.
- **Winning a small board:** three in a row inside a small board wins it for you. It is then marked with your big X or O.
- **Closed boards:** if you are sent to a small board that is already won or full, you may play in any open small board instead.
- **Winning the game:** win three small boards in a row on the big board.
- **Draw:** when no moves are left and nobody has three big boards in a row, it is a draw. (Some people instead count who won more small boards; we use the common rule and call it a draw.)
- Squares in a small board that is already won can no longer be played.
- Sources: [Ultimate tic-tac-toe, Wikipedia](https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe) (rules, the "sent to" rule, the won-or-full board rule).

## What makes it feel right
1. Every move is two moves: where you play, and where you send your opponent.
2. Seeing clearly which small board is live right now.
3. The satisfying stamp when a small board is won.
4. Quick games (a few minutes) with real strategy, unlike plain Tic-Tac-Toe.

## How the best apps do it
Good apps light up the board (or boards) you may play in and dim the rest, show a big mark over each won board, and highlight the last move so you can see where it sent you. Reviewers complain about squares too small to tap on phones, unclear "why can't I play here" moments and bots that are either hopeless or impossible.

## Our design
- **Board:** a white card with nine small boards in rounded tiles; the live board(s) glow sunny, the others fade. X is tomato, O is sky (our duel colors). Won boards get a big mark that stamps in with a squash; a full board with no winner turns grey.
- **Controls:** tap a square in a glowing board. Keyboard: arrows move a focus ring over all 81 squares (it skips squares you can't play), Enter or Space plays.
- **Motion:** the mark pops in; a small-board win stamps a big mark; the next live board pulses once so your eye follows the send.
- **Messages:** "Play in the top-right board" and "That board is closed, play anywhere".
- **Players:** vs a bot, or 2 players on one device.
- **Bots (never cheat):** alpha-beta search over the whole game. Pip looks 1 move ahead and often plays at random; Bo 2 moves; Zed 3 and Nova 5 with a sharper evaluation (small boards won, center board, two-in-a-rows, where a move sends the opponent).
- **Different from Tic-Tac-Toe:** our Tic-Tac-Toe is one quick 3 by 3 grid that ends in a draw with good play. Here the sending rule makes a deep game with 81 squares and a big board to win.

## Tests
X moves first and may play anywhere; the next move must be in the board matching the last square; a won or full target board frees the next move to any open board; squares in won boards can't be played; three small boards in a row wins; a full big board with no line is a draw; illegal and out-of-turn moves throw; bots play only legal moves; games replay exactly; Nova beats Pip.
