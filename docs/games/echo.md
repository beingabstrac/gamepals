# Echo

Status: built (2026-09-14). Our own name and art for the classic "repeat the light and tone sequence" memory game. The best-known version is a trademarked toy, so we never use its name.

## The real game
- Four colored pads, each with its own tone. The game plays a sequence of pads; you repeat it. Every round adds one more step to the end.
- A wrong press, or taking too long, ends the game. Classic difficulty settings stop at 8, 14, 20 or 31 steps.
- The tones are chosen to sound nice together (a major chord), so the sequence is almost a tune.
- Versions also offer a party game where players take turns and each adds one step.
- Source: [the classic electronic memory game, Wikipedia](https://en.wikipedia.org/wiki/Simon_(game)).

## What makes it feel right
1. Bright flashes and clear tones that turn the sequence into a little song.
2. The tension as the sequence gets long and fast.
3. A crisp "you got it" before the next step, and a gentle "oops" on a mistake.
4. A best score to beat.

## How the best apps do it
Memory-sequence apps keep 4 big pads, sound on by default, a score and a best score, and speed up as you go. Reviewers want fair timing (no rushing on the first steps), clear feedback on mistakes and a way to play with friends.

## Our design
- **Pads:** 4 big rounded pads in tomato, sky, sunny and mint, each with a white shape (circle, triangle, square, star) so color is never the only cue; a lit pad glows, grows a little and plays its tone.
- **Tones:** a major chord (A, C sharp, E, high A) from our Web Audio synth; sound follows the sound setting, and the flash and shape always show.
- **Solo levels:** Short (8 steps), Classic (14), Long (20), Marathon (31). Reach the goal to win; the score is the longest sequence you repeated. The tempo rises as the sequence grows.
- **Party mode (2 to 4 players, people and bots):** players take turns. On your turn, repeat the whole sequence, then add one step of your own. A mistake knocks you out; the last player in wins. Everyone watches the same pads on one device.
- **Timing:** 5 seconds to make each press; a ring around the pads shows the time left.
- **Controls:** tap a pad; keys 1 to 4, or the arrow keys (up, right, down, left).
- **Bots never cheat:** they remember the sequence but can slip on longer ones. Pip slips often after 6 steps, Bo after 10, Zed after 16, Nova rarely before 25.
- **Different from our other games:** the only game about listening and sequence memory, not positions on a board.

## Tests
Each round adds exactly one step and follows the seed; the right presses advance, a wrong press ends the game (solo) or knocks the player out (party); running out of time counts as a mistake; reaching the goal wins; in party mode the last player in wins and each player adds one step; bots press only legal pads, replay exactly, and Nova lasts longer than Pip.
