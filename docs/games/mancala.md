# Mancala

Status: built (2026-09-14). Rules: Kalah, the most common Mancala game in homes and apps.

## The real game
- Each player has 6 small pits (houses) on their side and a big store at their right-hand end. Each house starts with the same number of seeds (usually 4).
- On your turn, scoop all the seeds from one of your houses and sow them counter-clockwise, one per pit. You sow into your own store but skip your opponent's store.
- **Last seed in your store:** you move again, as many times as it happens.
- **Capture:** if your last seed lands in one of your own empty houses and the house straight across has seeds, you take both into your store.
- **End:** when one player's houses are all empty, the game ends. The other player puts all their remaining seeds into their store. Most seeds wins; a tie is a draw.
- Source: [Kalah, Wikipedia](https://en.wikipedia.org/wiki/Kalah).

## What makes it feel right
1. The rhythm of sowing, seed by seed.
2. Chaining extra turns by landing in your store again and again.
3. The swing of a big capture.
4. Seeing every seed: no hidden information, pure planning.

## How the best apps do it
Good Mancala apps count seeds for you (a number on every pit), animate each seed, highlight the pit you can play, explain extra turns and captures, and offer a few seed counts and bot levels. Reviewers dislike pits too small to tap and not being told why they got another turn.

## Our design
- **Levels:** 3, 4 or 6 seeds per house (4 is classic).
- **Look:** a warm peach board on a white tray; round pits with a number on each; seeds as chunky candy pebbles in our bright colors.
- **Controls:** tap one of your houses (they glow when you can play them). Keyboard: 1 to 6 picks a house from left to right, or arrows and Enter.
- **Motion:** seeds hop from pit to pit one at a time; the store bumps as seeds land; a capture slides both piles into the store with a little burst.
- **Messages:** plain words: "Last seed in your store, go again!" and "Capture! 5 seeds."
- **Players:** vs a bot, or 2 players on one device (you sit on the bottom row; the top row belongs to the other player).
- **Bots (never cheat):** search ahead with alpha-beta. Pip looks 1 move ahead and makes mistakes; Bo 3; Zed 5; Nova 7. Extra turns count as more of the same player's moves.
- **Different from our other games:** the only sowing game; nothing moves except seeds, and every move changes the whole board.

## Tests
48 seeds at the start with 4 per house; sowing skips the opponent's store; the last seed in your store gives another turn; captures need your own empty house and seeds across; no capture when the house across is empty; the game ends when one side is empty and the other side's seeds go to its owner's store; most seeds wins, a tie is a draw; playing an empty house or the other player's house throws; bots play only legal moves; games replay exactly; Zed beats Pip.
