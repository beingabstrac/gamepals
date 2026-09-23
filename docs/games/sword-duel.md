# Sword Duel

Status: brief (2026-09-24). Rules: fencing as the International Fencing Federation (FIE) runs it, cut down to a phone duel: two fencers on a strip, first to five touches, as a bout in the pool rounds is. Nobody owns fencing; JindoBlu's pack has a sword duel, and ours is drawn by us.

## The real game
- **Two fencers on a strip** (the piste) 14 metres long, starting at the en-garde lines four metres apart.
- **A touch is a hit with the point.** A fencer steps in and out of distance, and attacks with a lunge: a long step forward with the arm extended, fast, but it leaves the attacker stretched out and slow to recover.
- **A parry** knocks the attacking blade aside, and the fencer who parried then has the first chance to hit back (the riposte).
- **After a touch** both go back to the lines. In épée, both hitting within a split second scores both; in foil and sabre the right of way decides. First to five touches wins a pool bout.

## What makes it feel right
1. Dancing at the edge of distance, each waiting for the other to commit.
2. The lunge: all or nothing.
3. A parry at the last instant and the riposte straight after.
4. Being caught stretched out, and the touch that follows.

## How the best ones do it
The two-player phone sword games keep each player to one or two big actions in their half (attack and defend), make every hit ring, and keep bouts short. Top-down or side-on, both work; on a phone held upright, top-down lets each player own a half.

## Our design
- **Top-down on a strip held upright**, one fencer at each end, each player's half of the screen theirs.
- **Three things to do**: step (hold and drag toward or away), lunge (a tap), and parry (a quick sideways swipe). Keyboard: Up and Down step, Space lunges, Left or Right parries; the top player uses W and S, Shift, and A or D.
- **The lunge** reaches a sword's length and more for a moment, then leaves you stretched and slow for most of a second.
- **The parry** covers a short window. A lunge that meets it is knocked aside and the attacker is left open for a moment: the riposte.
- **A touch** is a lunge that reaches the other fencer while they are not parrying. Both reaching in the same instant is a double, and nobody scores (right of way decided by nobody, rather than a ruling a phone cannot explain). First to five.
- **Real time**, like Sumo: a pure fixed-step `step` in the rules. Bots hold distance, lunge when you are stretched or stunned, and parry your lunge after a reaction delay by tier.

## Tests
Stepping moves a fencer and never past the other; a lunge in distance on an open fencer is a touch and puts both back on their lines; a lunge out of distance misses and leaves the attacker slow; a parried lunge scores nothing and stuns the attacker, and a riposte on a stunned fencer scores; a double scores nobody; first to five wins; the same inputs give the same bout; Expert beats Easy. Invariant, every step of random bouts: the fencers never pass each other, stay on the strip, and touches never go down.
