# Sea Battle

Status: built (2026-09-18). Rules: the classic hidden-fleet guessing game (our own name, see docs/03).

## The real game
- Each player has a 10 by 10 grid of water and a fleet of five ships: lengths 5, 4, 3, 3 and 2, seventeen squares in all.
- **Placing:** ships go flat on the grid, straight across or straight down, and may not overlap. You keep your fleet hidden.
- **Firing:** players take turns calling one square. The answer is "miss" or "hit", and when every square of a ship is hit its owner says which ship sank.
- **Winning:** the first player to sink all five of the other fleet wins.
- Two house rules are common and we say plainly which we use: ships **may touch** (the strict version forbids it), and a hit does **not** give you another shot.
- Sources: [Battleship (game), Wikipedia](https://en.wikipedia.org/wiki/Battleship_(game)) (grid, fleet sizes, turn order, sinking); the no-touching and extra-shot variants are noted there too.

## What makes it feel right
1. The pause before the answer comes back.
2. Ringing in a hit, then working out which way the ship lies.
3. The call of a ship going down.
4. Hiding your own fleet well: spread out, or tucked in a corner.

## How the best apps do it
Good apps let you drag a ship and tap to turn it, offer a "place them for me" button, mark misses and hits clearly on both grids, keep a list of which ships are left, and never let you fire twice at the same square. Reviewers dislike fiddly placing, not being told which ship sank, and bots that clearly know where your ships are.

## Our design
- **Two grids:** the other fleet on top (your shots: white dots for misses, red bursts for hits), your own below (your ships, and the shots aimed at you).
- **Placing:** your five ships wait beside the grid. Tap a ship, tap a square to drop it, tap it again to turn it. A "Place them for me" button fills the rest at random. Keyboard: arrows move, Enter drops, R turns.
- **Firing:** tap a square on the top grid. Keyboard: arrows and Enter.
- **Motion:** a miss makes a small splash ring; a hit flashes and shakes; a sinking ship turns dark and its name pops up.
- **Messages:** plain words: "Hit!", "Miss", "You sank their cruiser", "Their carrier is down".
- **Players:** vs a bot, or 2 players on one device, where each fleet is hidden behind a "pass the phone" cover.
- **Bots (never cheat, and they never see your fleet):** they know only what their own shots told them, and which of their opponent's ships have sunk. Pip fires at random; Bo finishes off the squares next to a hit; Zed hunts on a checkerboard (a ship of 2 cannot hide from it) and then finishes; Nova works out, for every square, how many ways the ships that are still afloat could sit there, and fires at the most likely square.
- **Different from our other games:** the only game where you are guessing at a board you cannot see, and where your own fleet has to be hidden from the person next to you.

## Tests
The fleet is 5, 4, 3, 3, 2 and seventeen squares; ships must fit on the grid and may not overlap; placing runs one player then the other, then firing starts; a square can only be fired at once; hits, misses and sinkings are reported correctly; the game ends when all seventeen squares of a fleet are hit; the deal of a random placement comes from the seed so games replay exactly; bots play only legal moves and their choice never changes when the hidden fleet changes but the answers stay the same; Nova needs fewer shots than Pip.
