# Balloon Bumpers

Status: brief (2026-09-25). The catalog's "Crash It (bumper arena)" (docs/12 A), given a core of its own. Built as M42a.

## The real thing
Balloon battles are a fixture of kart and bumper-car games and of real bumper-car parks: every car has a balloon tied on behind, and you win by popping the others' while keeping yours. What makes it work is that attack and defence are the same thing: the way you face protects your balloon and aims at theirs.

## Why it is its own game
Sumo is about pushing someone out of a ring: weight, position, the edge. Here there is no edge that loses; the arena walls just bounce you. The target is a small weak spot behind the other car, so the game is about getting round behind, and about how turning swings your own balloon out.

## Our design
- A walled arena, two round bumper cars, a balloon on a string behind each. Seat 0 at the bottom, seat 1 at the top; each half of the screen drives its own car (drag to drive, tap to dash), keys too.
- The car turns to face the way it is going (up to 4 radians a second) and the balloon trails straight behind. Cars bump like bumper cars (bouncy, equal weight) and bounce off walls.
- A balloon pops when the other car's body reaches it moving into it. Three pops wins.
- **Every match finishes.** Measured: two careful bots could circle each other forever. So after 20 seconds without a pop the walls close in (up to 170 pixels each side), then the balloon strings let out; a round with no pop ends empty after 40 seconds, and after seven rounds the most pops wins (level is a draw).
- **Bots**: they come round behind the other car rather than through it, aim a little ahead of the balloon, and dash when lined up. Tiers are reaction time, a steady hand and how far ahead they aim. Guarding (turning away from a car lining up on you) was tried and lost 12 of 12, because swerving shows your balloon; no tier does it.
- A model where cars never stop (cruising, steering only) was tried first and dropped: good bots chased each other's tails in circles and scored 0 pops in 20 matches.

## Tests
Nothing moves in the countdown; a car faces the way it drives with its balloon behind; walls bounce; driving into a balloon pops it, touching it alongside does not; the walls close in late in a round; each tier beats the one below; three pops wins and bot matches finish.
