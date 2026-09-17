# Backgammon

Status: built (2026-09-17). Rules: standard backgammon, the version played everywhere.

## The real game
- 24 points in four quarters, 15 checkers each. The two players move in opposite directions, each towards their own home quarter (the last six points).
- **Rolling:** roll two dice and move two checkers, or one checker twice, by the numbers shown. **Doubles give four moves** of that number.
- **Where you may land:** any point that is empty, has your own checkers, or has exactly one enemy checker. A point with two or more enemy checkers is closed to you.
- **Hitting:** landing on a lone enemy checker (a blot) sends it to the bar.
- **The bar:** if you have a checker on the bar you must bring it back into the opponent's home quarter before doing anything else. If it can't come in, your turn is over.
- **Using both dice:** you must play both numbers if there is any legal way to do it. If only one can be played, you must play the higher one.
- **Bearing off:** once all 15 of your checkers are home, you take them off with exact rolls. A number higher than your highest occupied point takes a checker off that point.
- **Winning:** the first to bear off all 15 wins.
- Sources: [Backgammon, Wikipedia](https://en.wikipedia.org/wiki/Backgammon) (movement, hitting, the bar, bearing off, the both-dice rule); [Backgammon rules, US Backgammon Federation](https://usbgf.org/backgammon-basics-how-to-play/).

## What we leave out, and why
- **No doubling cube.** It is a betting device, and this app has no stakes. Told plainly in How to play.
- **No gammon or backgammon scoring.** One game, one winner, like the rest of our catalogue. A match ladder can come later with online play.
- **No opening roll-off.** Who starts is decided at the table, like every other game here.
- **No undo inside a turn** for now: each part of a move is played as you tap it. Worth adding later.

## What makes it feel right
1. Rolling, then seeing exactly which checkers can move.
2. The sting of being hit and sent back to the bar.
3. Building a wall the other player cannot pass.
4. The run home and the last checkers coming off.

## How the best apps do it
Good apps highlight the checkers you can move, show where each die can take you, let you undo a part-moved turn before you confirm it, and say plainly when you cannot move at all. Reviewers dislike having to drag exactly onto a point, no legal-move hints, and bots that seem to roll better than you.

## Our design
- **Look:** a flat candy board, long triangles in two tones with a bar down the middle; chunky round checkers in the two seat colours; the tray at the side fills as checkers come off.
- **Controls:** tap Roll. Tap a checker, and the points it can reach light up; tap one to move. Keyboard: Space or R rolls, arrows pick a point, Enter moves.
- **Motion:** dice tumble; checkers hop from point to point; a hit flicks the checker to the bar with a spin; bearing off slides it into the tray.
- **Messages:** "Roll the dice", "You must come in from the bar", "No move, turn over", "Hit!", "5 to bear off".
- **Players:** vs a bot, or 2 players on one device.
- **Bots (never cheat, they see the same dice you do):** Pip moves at random; Bo runs for home and takes any hit; Zed counts pips and avoids leaving blots; Nova scores each choice by pip count, points made, blots left and how likely they are to be hit next roll, looking at every one of the 21 possible rolls.
- **Different from our other games:** the only race where the dice say what you may do but you choose how to use them, and where a hit sends you all the way back.

## Tests
The opening position is the standard one; a checker on the bar must come in first; hitting sends a blot to the bar; you must use both dice when possible and the higher one when only one fits; doubles give four moves; bearing off needs an exact roll or a higher one from the top point; a blocked player passes; the first to take off 15 wins; dice come from the seed so games replay exactly; bots play only legal moves; Nova beats Pip.
