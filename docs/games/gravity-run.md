# Gravity Run

Status: brief (2026-09-24). From the catalog's two-on-one-phone list (docs/12 A). Gravity-flip runners are a well-known one-button genre; the name is plain and the course is ours.

## The genre
A runner that never stops, in a corridor. The only control flips gravity: the runner falls to the ceiling and runs upside down, or falls back to the floor. Blocks stick out of one side or the other; be on the far side when one arrives. It gets faster.

## What makes it feel right
1. One tap, and the whole world turns over.
2. The fall across the corridor takes time, so the tap has to come early.
3. Two blocks close together on opposite sides: flip, flip.

## Our design
- **Each player runs their own corridor in their half of the phone**, turned round for the top one, like Road Dodge and Basketball Hoops. Both corridors have the same blocks, from the seed.
- **Tap anywhere in your half to flip.** A tap only counts with your feet on a floor or ceiling; mid-air it does nothing. Space and Shift on a keyboard.
- Speed starts at 300 px a second and climbs 6 a second to 620. Gaps shrink as the run goes on. Now and then (never twice running) two blocks come close together on opposite sides; that gap is sized to the speed the run will have there, so every block can be cleared with a good flip.
- A bump costs a heart and the runner blinks safe for 1.2 seconds. **Three bumps and you are out; the last one running wins.** Out together is a draw.
- **A two-minute cap**, as in Road Dodge: more hearts left wins, level is a draw.

## Bots
A bot flips when the next block on its side comes within its lead (which grows with the speed and wobbles a little each block, seeded); it never flips toward a block on the other side. Over ten seeds a pairing: Medium beats Easy 9 in 10, Hard beats Medium 7, Expert beats Hard 8. Two Experts clear everything and draw at the cap.

## Tests
A tap flips gravity and the runner stands on the ceiling; a tap in mid-air does nothing; blocks stand further along and a close pair is always on opposite sides; staying on the floor runs into a floor block and costs one heart; three bumps and you are out, the last running wins, time up goes on hearts; the better bot wins and every match ends. Invariant, every step of bot play: runners stay in the corridor, hearts go down one at a time.
