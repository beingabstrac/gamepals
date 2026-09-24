# Tank Duel

Status: brief (2026-09-24). A two-on-one-phone duel from the catalog (docs/12 A). One-button tank games are a well-worn genre in two-player phone collections: your tank turns by itself, and your one button drives it and fires. Tanks are generic; the name is plain and the arena is ours.

## The genre
Top-down arena with a few blocks. Each tank spins on the spot when you are not touching; hold and it drives straight the way it faces; each press fires a shell that bounces off the walls. Hit the other tank to win the round. The skill is timing: letting go at the right moment of the spin, and moving off a line before a shell comes down it.

## What makes it feel right
1. The one button: everybody knows how to play in a second, and it is still hard.
2. Bounces: the shot round a corner, the near miss off a wall.
3. The pop when a tank goes, and the scramble of the next round.

## Our design
- Portrait arena, five mint blocks laid out the same turned round for each player, the floor lightly tinted per half.
- **Each player's whole half of the phone is their button.** A finger that comes down in your half holds your button until it lifts, wherever it slides. **Keyboard**: Space (or Enter) for the bottom tank, Shift for the top.
- The tanks start at their ends, each turned a seeded way off straight, different every round, so no two rounds open alike.
- Holding through the countdown does not fire.
- Shells: three out at once at most, a quarter second to reload, three bounces, three seconds of life.
- **Your own shells never hurt you.** The genre usually lets them, and we tried it: in bot play four out of five rounds were lost to a tank's own shell coming straight back down the line it fired along, which reads as the game being unfair, not as a skill. A bounce back is a near miss here.
- A hit wins the round, both hit at once is nobody's point, and a round nobody wins in 40 seconds is played again. **First to five rounds.**
- Smoke puffs from the barrel and the barrel kicks back at every shot; a hit tank bursts in sunny and tomato and the phone shakes.

## Bots
One button like everyone else. A bot fires when it faces the other tank with a clear line (within its aim, with its trigger chance each step), gets out of the way of shells it sees coming (its look-ahead), leads a moving tank (Expert), keeps a little way off once it can see the other tank, and otherwise follows the road (a waypoint graph around the blocks, worked out once) to the nearest spot with a line of sight. Over ten seeds each way: Medium beats Easy about three times in four, Hard beats Medium about seven in ten, Expert only edges Hard (a little over half), like the luck games.

## Tests
The arena is the same turned round and both tanks start clear; let go and a tank spins on the spot, hold and it drives; each press fires one shell, three out at most, holding does not keep firing; holding through the countdown is not a press; a straight shot wins the round; shells bounce and your own never hurt you; first to five wins and the next round starts fresh; line of sight through the open, not through a block; the better bot wins and every match ends. Invariant, every step of bot play: tanks and shells never inside a block or off the arena.
