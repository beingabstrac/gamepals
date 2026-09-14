# Checkers

Status: brief (2026-09-14). Rules: English draughts, the American checkers most players know. Other national rules (flying kings, men capturing backward) can come later as options.

## The real game
- 8×8 board, played on the dark squares. Each side starts with 12 pieces on its three nearest rows. The darker side moves first.
- **Men** step one square diagonally forward. They capture by jumping over an enemy piece next to them onto the empty square beyond.
- **Captures are required.** If you can jump, you must. After a jump, if the same piece can jump again, it must keep going. You may choose any capture, not only the longest one.
- **Kings:** a man that reaches the far row is crowned. Kings move and capture one square diagonally, forward or backward. If a man is crowned in the middle of a jump, the move ends there.
- **You win** when the other side has no pieces left or cannot move. Perfect play from the start is a draw.
- Source: [English draughts, Wikipedia](https://en.wikipedia.org/wiki/English_draughts).

## Draws (our rule, following common tournament practice)
The game is a draw if 40 moves each go by with no capture and no man moving, or if the same position with the same player to move comes up three times.

## What makes it feel right
1. The chain jump: hop, hop, hop, and a row of pieces disappears.
2. Getting a king, and the swing in power it brings.
3. Forced captures that turn into traps.
4. Clean, clear pieces and legal moves that are easy to see.

## How the best apps do it
Good checkers apps highlight the pieces that can move, show where a tapped piece can go, animate multi-jumps step by step, offer undo against bots and several difficulty levels. Reviewers complain when forced captures are not explained ("why can't I move that?") and when bots are either too easy or unbeatable.

## Our design
- **Look:** a cream and mint board on a white tray; black (ink) pieces and red (tomato) pieces as chunky rounded discs with a lip; kings get a golden crown.
- **Controls:** tap one of your pieces; its moves glow; tap a glowing square to move. When a capture is required, only the pieces that can capture glow, with a short note: "You must jump." Keyboard: arrows move a ring, Enter picks.
- **Motion:** pieces slide diagonally; jumps hop in an arc, one landing at a time; a taken piece pops and flies off the board; a crown drops onto a new king with a bounce.
- **Players:** vs a bot, or 2 players on one device (black at the bottom, red at the top).
- **Bots:** search ahead with alpha-beta. Pip looks 2 moves ahead and makes mistakes; Bo 4; Zed 5; Nova 6. Zed and Nova also value kings, the back row and the center. (Deeper search waits for the bot Web Worker, so phones never freeze.) Bots never cheat.
- **Different from our other games:** the only capture-and-crown strategy game so far.

## Tests
7 legal first moves; captures are required and take priority; multi-jumps must continue; a man crowned mid-jump stops; kings move backward; men never move backward; win when the other side has no pieces or no moves; draw after 40 moves each without progress and on threefold repetition; illegal moves throw; bots play only legal moves; games replay exactly; Nova beats Pip.
