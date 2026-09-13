# Snake Battle

Status: brief.

## The real game
- **Snake** (1970s arcade *Blockade*, made famous on Nokia phones): a snake moves continuously on a grid; eating food makes it longer; hitting a wall or itself ends the game.
- **Light-cycle / multiplayer snake:** two or more snakes share the board; crashing into a wall, your own body or the other snake loses; head-on collisions are a draw.
- Sources: [Wikipedia – Snake (video game genre)](https://en.wikipedia.org/wiki/Snake_(video_game_genre)) · [Two-player snake on one screen](https://2playersnake.com/)

## What makes it feel right
1. Constant forward motion — you can only steer, never stop.
2. Growing longer makes you stronger (you can wall people off) **and** more dangerous to yourself.
3. Cutting off the other snake — the "trap" moment.
4. Speed slowly ramping up.

## How others do it
- Same-screen versions give each player their own control zone (split screen); keyboard versions use WASD vs arrows ([Two Player Snake](https://www.twoplayergames.org/game/two-player-snake)).
- Touch versions often turn the nearest snake on tap — confusing with two players.

## Our design
- **View:** a rounded grid board (mint) in the middle; snakes are chunky rounded tubes in each player's color with a cute face on the head; fruit pops in with a bounce.
- **Controls (one phone):** each player gets two **big turn buttons** in their own corners — ↺ turn left / ↻ turn right (relative to where the snake faces), so it works for the player sitting on the other side of the phone. Big, thumb-sized, always in the same place.
- **Movement:** grid-based and deterministic in the rules package (e.g. 7 moves/s, speeding up as snakes grow), but **drawn smoothly** — heads glide between cells with easing, bodies follow, tails shrink smoothly. No jumpy cells.
- **Round rules:** crash into a wall, yourself or the other snake = lose the round; both heads into the same cell = draw round. Best of 5.
- **Bots:** look ahead with flood-fill (avoid moves that leave little space), chase fruit, and try to cut off the opponent. Tiers: look-ahead depth, fruit greed vs. safety, turn mistakes (Pip sometimes turns into walls; Nova traps you).
- **Feel:** squash when eating, sparkle burst on fruit, wobble on near-misses, a tumble when crashing.
- **Clearly different from our (future) solo Snake:** it's a duel about space control, not a high-score chase.

## Tests
- Grid: moves, turning left/right relative to heading, growth on eating, fruit respawns on empty cells (seeded).
- Crashes: wall, self, other snake, head-on draw.
- Bots: Nova beats Pip; bots don't turn into an immediate wall at Hard/Expert.
- e2e: start vs bot, tap the turn buttons, no errors.
