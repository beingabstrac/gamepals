# Archery

Status: brief (2026-09-23). Rules: target archery as World Archery runs it, cut down to a phone game the way every archery app cuts it. Nobody owns archery; phone versions are sold as Archery King, Archery Battle and others, and we use none of their names or art.

## The real game
- **A target face of ten rings**, gold in the middle (10 and 9), then red, blue, black and white out to 1. The outdoor recurve face is 122 cm across at 70 m, so each ring is 6.1 cm wide. Inside the 10 is a smaller X ring, which scores 10 and breaks ties.
- **Arrows are shot in ends**, three or six at a time, and scored after each end by the ring they hit; an arrow on a line takes the higher ring.
- **Wind matters.** Outdoors the archer reads flags and aims off to let the wind carry the arrow in.
- **Highest total wins.** A tie goes to the most 10s and Xs, and then to a shoot-off.

## What makes it feel right
1. Holding the bow steady while the sight drifts, and letting go at the right moment.
2. Reading the wind and aiming off, and being right.
3. The thunk of an arrow in the gold.
4. The last arrow of a close match.

## How the best ones do it
The phone versions show the target down a long range with a wind arrow and speed, let you pull back and drag to aim, sway the sight while you hold (more when the wind is up or the range is long), and loose on release. The best keep a match short: a few ends of three arrows, players taking turns an arrow at a time.

## Our design
- **A match is ends of three arrows**, players taking turns an arrow at a time: 3 ends at the table's Quick length, 5 at Match. Ranges of 30, 50 and 70 metres as levels: the further, the more the wind carries the arrow.
- **Each arrow has its own wind**, from the seed: a direction and a speed shown before you shoot. It carries the arrow sideways (and a little up or down) by an amount that grows with the range. Reading it and aiming off is the skill.
- **The sway is yours, the wind is the rules'.** While you hold, the sight drifts in a slow loop, as a real bow arm does, and you let go when it is where you want it. That drift lives in the scene, so the move is simply where the sight was when you let go: a point on the face in whole millimetres. The rules add the wind and score the hit. Nothing random happens in the rules, so a server can replay a match.
- **Moves**: the aim point, `x,y` in millimetres from the middle of the face, inside a square a little bigger than the face so a very wide shot can miss. `allows` checks the numbers, the same contract as Pool and Mini Golf.
- **Scoring** by ring, 10 to 1, a miss is 0; the X counts for ties. The result sheet shows each player's ends.
- **Touch**: hold anywhere to draw, drag to move the sight, let go to shoot. **Keyboard**: arrows move the sight, Space holds and releases.
- **Bots** aim off for the wind with a tier's accuracy: Easy half-reads it and shakes, Expert reads it all and barely shakes.

## Tests
A hit in the middle scores 10 and counts an X; each ring scores its number and a line takes the higher; off the face is 0; the wind carries an arrow the way it blows and further at longer range; the same aim in the same wind always lands in the same place; players take turns an arrow at a time and a match ends after its last end; highest total wins, then most Xs, and a full tie is a draw; `allows` refuses aims off the square; replay reproduces a match; Expert outscores Easy. Invariant, after every arrow of random matches: every score is 0 to 10, each player's total is the sum of their arrows, and nobody has shot more arrows than the other plus one.
