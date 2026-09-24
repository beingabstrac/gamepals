# Darts

Status: brief (2026-09-25). From the catalog's party duels (docs/12 A, "Throw (darts-like)"). Built as M38a.

## The real game
- The board (World Darts Federation / BDO measurements): twenty sectors numbered 20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5 clockwise from the top. From the middle: the inner bull (50) to 6.35mm, the outer bull (25) to 15.9mm, singles, the treble ring from 99 to 107mm (three times the number), singles again, the double ring from 162 to 170mm (twice the number). Past 170mm scores nothing.
- **x01** (301 or 501): each player starts on the number and throws three darts a turn, taking off what they score. The last dart has to be a **double** (the inner bull counts as double 25) and bring the score to exactly zero. Going below zero, landing on exactly 1 (no double can finish it), or reaching zero without a double is a **bust**: the turn scores nothing and the score goes back to where it was when the turn began.
- The most that can be checked out in three darts is 170 (T20, T20, bull). Players remember "checkouts", the darts that finish a given score.
- Sources: WDF playing rules (board dimensions, x01, bust); the standard checkout chart.

## What makes it feel right
- The aim is never still. A real hand sways, and the skill is letting go at the right moment.
- The dart flies in a small arc and thuds into the board, sticking at an angle where it landed.
- The number you need is always shown, and near the end the checkout is suggested, the way a scorer calls it.
- Busts hurt: the score flips back with a buzz.

## Reference apps
Mobile darts games put the board front-on and use drag to aim with a sway, or flick to throw. The flick gets tiring over a whole leg, and aiming with a finger covers the board. We aim with a reticle that floats **above** the finger.

## Our design
- **301** (quick) or **501** from the table (`levels`). 1 to 4 players, or bots at four tiers. Solo: finish 301 in as few darts as you can.
- **Aim:** press on the board and a ring appears a little above your finger, swaying gently like a hand (a smooth figure-eight, larger the longer you hold after about two seconds). Let go to throw. Keyboard: arrows move the aim, Space throws.
- The rules take the **landing point** in millimetres (`x,y`), so the sway lives in the scene and a bot's shake in its tier. Bots never see anything a person cannot: they choose a target the way a player would, then their arm shakes.
- **Bot tiers** (spread of the throw in mm, a bell shape): Easy 42, Medium 26, Hard 16, Expert 10. They aim at treble 20 until a finish is in reach, then follow the checkout they know, leaving an even number for a double where they can.
- The line under the board shows the score to get and, from 170 down, a checkout that finishes it.

## Tests
- Scoring: the middle of each ring and each sector scores what the board says; the edges fall where the measurements say.
- x01: a double to zero wins; below zero, 1 left, and zero on a single are busts that put the score back to the start of the turn.
- Three darts a turn, then the next player; a finish ends the turn at once.
- Every checkout from 2 to 170 that can be done has a route found by `checkout`, and none for 169, 168, 166, 165, 163, 162 and 159.
- Bot tiers: Expert beats Hard, Hard beats Medium, Medium beats Easy over many legs.
- The referee replays a leg.
