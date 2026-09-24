# Bomb Pass

Status: brief (2026-09-24). A two-on-one-phone duel from the catalog (docs/12 A): hot potato with a bomb. Hot potato is a generic party game; the name is ours.

## The game
- **A bomb with a hidden fuse** is on one player's side. To throw it back, that player has to hit the button that lights up somewhere in their half.
- **It goes off on whoever has it** when the fuse runs out, even in the air on its way to them.
- **Three bangs on your side and you lose.**

## What makes it feel right
1. The sizzle of the fuse and nobody knowing how long.
2. Stabbing for the button and missing it.
3. The bang.

## Our design
- **Split screen**: the holder's half glows; the button pulses where they have to hit it, somewhere new every throw. The bomb flies over the middle in an arc (nobody can act while it is in the air). A bang shakes the phone and bursts in sunny, peach and red; a heart goes.
- **Fuses of four to eleven seconds**, dealt from the seed, never shown.
- **Hearts at each player's end**, facing them.
- **Keyboard**: Space throws for the bottom player, Shift for the top (straight at the button: the keyboard has no aim to miss with).
- **Real time**, a pure fixed step in the rules. Bots throw after a reaction time by tier and sometimes miss the button (Easy 0.9 s and three in ten wide, Expert 0.33 s and rarely wide).

## Tests
After the countdown someone holds it with a button in their own half; a tap on the button throws it and one beside it does not; only the holder can throw; the fuse goes off on the holder and three bangs lose; fuses are four to eleven seconds and every button sits on the canvas; the quicker bot wins. Invariant, every step of random play: lives only go down one at a time and never below nothing.
