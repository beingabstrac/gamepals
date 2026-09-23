# Mini Golf

Status: brief (2026-09-23). Rules: miniature golf as it is played on real courses, the way the course rules boards put it. "Mini golf" is the name of the game, not anyone's product; phone versions are sold as Golf Battle, Mini Golf King and others, and we use none of their names or holes.

## The real game
- **A course of holes**, usually nine or eighteen, each with a tee, a cup, walls and obstacles: banks, slopes, tunnels, bumpers, water.
- **Each player plays the hole in turn**, from the tee, until the ball drops. Every hit is a stroke.
- **A ball knocked off the course or into water** costs a stroke and is played again from where it was hit.
- **Most courses cap a hole**, commonly at six strokes: after the sixth, you pick up and write down seven, so a bad hole does not hold everyone up.
- **Fewest strokes over the course wins.** Each hole has a par, the number a good player needs, so a score can be read as over or under par.

## What makes it feel right
1. A bank shot off two walls that rolls up to the cup and drops.
2. The ball slowing on the lip and falling in at the last moment.
3. A slope that carries the ball somewhere you did not mean, and the next time bending it on purpose.
4. A hole in one.

## How the best ones do it
The phone versions aim by pulling back from the ball like a slingshot, with a dotted line for direction and the pull length for power; they show the course from above, and the good ones make every hole a small puzzle with one clever line. Scorecards show strokes against par after each hole.

## Our design
- **Nine holes of our own**, from a plain straight to a two-bank dogleg, a slope, sand, a water crossing and a hole with a narrow gap. Each is data (walls as line segments, areas for slope, sand and water, a tee and a cup), so more can be added without code.
- **Shots, like Pool**: a move is a direction as two whole numbers and a power, played out by a fixed-step simulation in the rules using only arithmetic and square roots, so a server can replay a round. The same `accepts` contract Pool uses, since shots cannot be listed.
- **One ball on the course at a time**, as on a real course: a player plays the hole out, then the next player tees off. That keeps balls from hitting each other and keeps the turn order simple for 1 to 4 players.
- **The cup** takes a ball that crosses it slowly enough; a fast ball skips over or lips out. Water costs a stroke and puts the ball back where it was hit. Six strokes and you pick up with seven.
- **Touch**: pull back from the ball and let go, the way every phone version does; the pull sets the power, and a dotted line shows the direction. **Keyboard**: left and right aim, up and down set power, Space hits.
- **Bots** try a spread of directions (straight at the cup, and off each wall they can see) at a few powers with the same simulation, and take the one that ends nearest the cup or in it. The tiers differ in how many they try and how much their hand shakes.
- **The scorecard** after each hole shows everyone's strokes against par; the table keeps the running score between the same players.

## Tests
A ball rolls straight on the flat and stops; it bounces off a wall at the angle it came in, a little slower; a slope curves it; sand slows it sooner; water costs a stroke and puts it back; a slow ball over the cup drops and a fast one does not; the sixth stroke ends the hole at seven; players play each hole in turn; fewest strokes wins and a tie is a draw; `accepts` takes every move in `legalMoves` and refuses malformed or out-of-range shots; replay reproduces a round; every hole can be holed by the bot within par plus two. Invariant, after every stroke of random rounds: the ball is inside the course walls, strokes never go down, and each player's total is the sum of their holes.
