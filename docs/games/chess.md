# Chess

Status: built (2026-09-17). Rules: standard chess (FIDE laws), the version everyone plays.

## The real game
- 8 by 8 board, light square on each player's right. White moves first, then players alternate.
- **Moves:** king one square any way; queen any distance straight or diagonal; rook straight; bishop diagonal; knight in an L (and it jumps over pieces); pawn one square forward, or two from its starting row, and captures one square diagonally.
- **Castling:** king and rook move together (king two squares towards the rook, rook hops over). Only if neither has moved, the squares between are empty, and the king is not in check, does not pass through an attacked square, and does not land on one.
- **En passant:** a pawn that has just moved two squares can be captured, that turn only, by an enemy pawn beside it, as if it had moved one.
- **Promotion:** a pawn reaching the far row becomes a queen, rook, bishop or knight (the player chooses).
- **Check and checkmate:** you may never leave your king attacked. Checkmate (in check with no legal move) ends the game.
- **Draws:** stalemate (no legal move, not in check); the same position three times; 50 moves by each player with no capture and no pawn move; and not enough pieces to mate (king alone, or king and one bishop or knight).
- Sources: [Rules of chess, Wikipedia](https://en.wikipedia.org/wiki/Rules_of_chess) (moves, castling, en passant, promotion, draw rules); [FIDE Laws of Chess](https://handbook.fide.com/chapter/E012023) (the official wording); [perft results, Chess Programming Wiki](https://www.chessprogramming.org/Perft_Results) (the move counts our tests check against).

## What makes it feel right
1. Picking up a piece and seeing exactly where it may go.
2. The jolt of check, and the finality of mate.
3. Watching a plan work two or three moves later.
4. Bots that are beatable at the bottom and genuinely good at the top.

## How the best apps do it
Good chess apps show legal squares as dots (and captures as rings), highlight the last move and the checked king, let you drag or tap-tap, ask which piece a pawn becomes, and keep a move list. Reviewers dislike pieces too small to tap, no legal-move hints for beginners, bots that are either random or crushing with nothing in between, and long waits while the bot thinks.

## Our design
- **Look:** flat candy board (peach light squares, grape dark squares) with chunky original piece shapes, not a font. The piece you lift gets a shadow and the squares it can reach get dots; captures show a ring.
- **Controls:** tap a piece, then a dot. Tap it again to put it down. Keyboard: arrows move a focus ring, Enter picks up and puts down. Promotion asks with four big buttons.
- **Motion:** pieces slide with a little arc and land with a squash; a capture makes the taken piece pop; castling slides both pieces; check flashes the king's square red and shakes it.
- **Messages:** plain words: "Check!", "Checkmate. White wins", "Stalemate, it is a draw", "Draw: the same position three times", "Draw: 50 moves with no capture or pawn move", "Draw: not enough pieces to mate".
- **Players:** vs a bot, or 2 players on one device.
- **Bots (never cheat):** our own engine, alpha-beta with piece-square tables; captures are searched first, and the sharper levels keep looking while captures are still hanging (quiescence), so they don't fall for cheap tricks. Pip looks 1 move ahead and often plays something else; Bo 2; Zed 3; Nova 4 with quiescence. They think in the bot worker, so the board never freezes.
- **No GPL code:** the engine is ours. No Stockfish, no imported tables from GPL projects.
- **Different from our other games:** the only game with six kinds of piece and a king that can never be left in danger; Checkers is forced captures on one diagonal colour, Ultimate Tic-Tac-Toe is nine small boards.

## Tests
Move generation is checked against published perft counts (start position to depth 4, plus two tricky positions), which covers castling, en passant, promotion and pins at once. On top: castling is blocked through check and after the king or rook moves; en passant only on the turn it is offered; promotion to each piece; checkmate and stalemate; the three draw rules; illegal and out-of-turn moves throw; games replay exactly; the strong bots find mate in one and take a free queen; Nova beats Pip.
