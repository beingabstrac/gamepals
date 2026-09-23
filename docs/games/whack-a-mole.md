# Whack-a-Mole

Status: brief (2026-09-24). Rules: the arcade game (Creative Engineering's Mogura Taiji and its Western copies from the 1970s on), moved to a phone for two. "Whac-A-Mole" is a Bob's Space Racers trademark, so ours is Whack-a-Mole with the k, the generic name for the game, and our moles are our own.

## The real game
- **Moles pop out of holes** at random, one or a few at a time, and duck back after a moment.
- **Hit one while it is up** and you score. The game speeds up as it goes; a round lasts a fixed time.
- Some versions add things you must not hit (a bomb) and things worth more (a golden mole).

## What makes it feel right
1. The pop: a mole shooting up with a squash and a stretch.
2. The whack: a mallet coming down and the mole flattened.
3. The pace picking up, until you are hitting on reflex.
4. Pulling your hand back from a bomb just in time.

## How the best ones do it
The two-player phone packs give each player their own set of holes in their half, the same moles at the same moments for both, and a short round, so it is a straight race of reflexes. Bombs keep it from being mindless tapping.

## Our design
- **Each player has a board of nine holes** in their own half; the top one turned round for a second person.
- **Both boards get the same moles** at the same moments, dealt from the seed, so neither player is luckier.
- **A mole is 1 point, a golden mole 3, a bomb takes 2 away** and leaves your mallet dizzy for a moment. Tapping an empty hole does nothing.
- **Forty-five seconds.** Moles come faster and stay up for less time as the clock runs down. Highest score wins; a level score is a draw.
- **Keyboard**: the number keys 1 to 9 whack the holes, laid out like a phone keypad, for the bottom player; the top player has Q W E, A S D, Z X C.
- **Real time**, a pure fixed-step `step` in the rules like the other duels. Bots see a mole a reaction late, and Easy now and then swings at a bomb.

## Tests
A mole is up only between its pop and its duck; whacking it scores and puts it down on that board only; a golden mole is 3 and a bomb takes 2 and stuns; a stunned mallet cannot score; whacking an empty hole or the same mole twice scores nothing; both boards are dealt the same moles; the round ends at 45 seconds with the higher score winning or a draw; the same inputs give the same round; Expert outscores Easy. Invariant, every step of random rounds: a board never shows two things in one hole, and a score only changes by what was hit.
