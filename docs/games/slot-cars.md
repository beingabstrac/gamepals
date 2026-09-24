# Slot Cars

Status: brief (2026-09-24). A two-on-one-phone duel from the catalog (docs/12 A). Slot car racing is a generic toy and hobby (cars guided by a groove, each driver holding a hand throttle); the name is the generic one.

## The real thing
Two cars in two grooves round a track, each driver with a trigger that sets the power. There is no steering: the only skill is how much throttle, and when. Too fast into a bend and the car's guide flips out of the slot and it flies off; a marshal puts it back where it left. Real tracks have a lane crossover so both lanes are the same length; club races also swap lanes between heats.

## What makes it feel right
1. The one control: easy to start, hard to get right.
2. The tumble off a bend, and the wait while you watch the other car pull away.
3. Getting braver lap by lap, until you are one bend too brave.

## Our design
- A stadium track (two straights, two bends), one car each, each lane its own groove. **The lanes cross over halfway down each straight**, so each car takes one bend on the inside and one on the outside every lap and both laps are exactly the same length. The inside of a bend is tighter and slower (grip limit about 420 px a second against 492 outside).
- **Hold your half of the phone to speed up; let go to slow down.** Space for the blue car, Shift for the red, held.
- Speed builds at 600 px/s² to 800, brakes at 1200. A car over the grip limit on a bend flies off straight ahead, tumbles on the grass for 1.2 seconds, and goes back on the groove where it left, from a standstill.
- **Seven laps; first over the line wins**, the same step is a dead heat.
- Lap counters sit inside the track, one facing each player. The start line is chequered across the right straight.

## Bots
A bot holds on while it could still slow in time for the next stretch of track at its nerve (a fraction of the grip limit), and lets go otherwise; now and then, a bend at a time, it brakes too late. Easy dares 80 percent and slips 14 percent of bends; Medium 87 and 8; Hard 93 and 4; Expert 97 and 1.5. Over ten seeds: Medium beats Easy 9 in 10, Hard beats Medium 8, Expert beats Hard 10. A race takes about half a minute.

## Tests
Both lanes are the same length a lap and the track stays on the canvas; each car takes one bend outside and one inside (so the lanes cross); hold to speed up, let go to slow; flat out into a bend flies off and the marshal puts it back where it left, stopped; first over the line after the last lap wins; a careful bot never flies off and gets round; the better bot wins and every race ends. Invariant, every step of bot play: cars only go forward, never past top speed.
