# Shut the Box

Status: built (2026-09-15). Rules: the traditional pub dice game with numbered tiles.

## The real game
- A box with tiles numbered 1 to 9, all open (up) at the start. Two dice.
- On your turn you roll, then shut (flip down) any open tiles whose numbers add up to the roll. A roll of 8 could shut the 8, or 5 and 3, or 1, 3 and 4.
- Keep rolling and shutting until you roll a total you can't make from the open tiles. Then your turn ends.
- **One die:** once the 7, 8 and 9 are all shut, you may roll just one die. This is the most common house rule.
- **Score:** the sum of the tiles still open. Lower is better. Shutting every tile is called **shutting the box**: you win outright.
- With several players, each takes one full turn on a fresh box. The lowest score wins; equal lowest scores share the win.
- A common longer version uses tiles 1 to 12.
- Sources: [Shut the box, Wikipedia](https://en.wikipedia.org/wiki/Shut_the_box) (rules, the one-die rule, scoring by open tiles, the 12-tile version).

## What makes it feel right
1. The clack of wooden tiles flipping down.
2. Choosing which tiles to shut: keep the ones that are easy to make later.
3. The tension of each roll as fewer tiles are left.
4. The rare joy of shutting the box.

## How the best apps do it
Good apps let you tap tiles to pick them, show the running sum of your pick against the roll, confirm automatically when it adds up, and say plainly when no move is possible. Reviewers dislike having to confirm every pick with extra taps, unclear "why did my turn end" moments and no choice of one or two dice.

## Our design
- **Levels:** 9 tiles (classic) or 12 tiles.
- **Look:** a warm wooden-toned box drawn flat (peach and sunny, no gradients) with chunky number tiles; shut tiles flip down with a squash and turn darker.
- **Controls:** tap Roll; tap open tiles to pick them (they lift); when your pick adds up to the roll, the tiles shut. Tap a picked tile again to drop it. If the 7, 8 and 9 (and 10 to 12) are shut, you choose: roll 1 die or 2 dice. Keyboard: Space, R or 2 rolls two dice and 1 rolls one (when allowed); after a roll, number keys pick tiles (0, - and = for 10, 11 and 12) and Backspace clears the pick.
- **Motion:** dice tumble; tiles lift when picked and flip down with a clack; the turn ends with a little shake of the box; shutting the box gets confetti.
- **Messages:** "Pick tiles that add up to 8", "No way to make 11. Turn over, 14 points", "You shut the box!"
- **Players:** solo (aim for the lowest score), vs bots, or 2 to 4 on one device.
- **Bots (never cheat):** Pip picks any split at random; Bo shuts the biggest tiles first; Zed picks the split that leaves the best chance of making the next roll; Nova works out the exact best choice for the tiles left (expected final score, including when to roll one die).
- **Different from our other dice games:** Yatzy is about which dice to keep and which box to score; Snakes & Ladders has no choices. Here each roll asks which tiles to shut, and your turn lasts until you get stuck.

## Tests
A roll can shut exactly the open tiles that add up to it; an illegal pick throws; the turn ends when no split is possible and the score is the sum of open tiles; one die is allowed only when the high tiles are shut; shutting every tile wins at once; the lowest score wins and ties share the win; dice come from the seed so games replay exactly; bots play only legal moves; Nova gets a lower average score than Pip.
