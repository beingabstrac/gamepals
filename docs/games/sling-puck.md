# Sling Puck

Status: brief (2026-09-24). A two-on-one-phone duel from the catalog (docs/12 A). The real thing is a wooden tabletop game sold under several names (sling puck, slingpuck, fast sling); the elastic-band-and-slot design is generic. Ours is drawn and named on its own.

## The real game
- A board split by a wall with one small slot in the middle. Each player has an elastic band across their end.
- Each side starts with five pucks. On "go", both players at once pull a puck back against their band and let go, trying to fire it through the slot.
- Pucks come back the other way the whole time. **The first player with no pucks on their side wins.**
- There is no turn order and no clock: speed and aim against a moving target.

## What makes it feel right
1. The stretch of the band and the snap when it lets go.
2. The clack of pucks hitting each other and jamming in the slot.
3. Frantic both-at-once shooting, with the last puck bouncing off the wall edge.

## Our design
- Portrait, a light wood board framed in darker wood, the wall in two pieces with the slot between, a band tied to two pegs at each end in the player's color.
- **Touch**: touch one of your pucks (it must be nearly still), pull back and let go. The band stretches back to the puck while it is pulled. A pull is capped (150 px) and fires harder the further it goes, up to 1500 px a second, and only ever toward the wall. A puck knocked away while you hold it slips out of the band.
- **Keyboard**: Left and Right pick one of your pucks (a grape ring), Space fires it straight at the slot (A, D and Shift for the top player). Keyboard shots are aimed for you but fire one at a time.
- **A two-minute clock** runs as a bar across the slot, which the real game does not have: a match between two people who shoot evenly can go on forever, and a phone duel should end. When it runs out, fewer pucks on your side wins, and equal is a draw. The howTo says so.
- The score shown is how many pucks sit on the other side, so higher is better and ten wins.
- Every puck is the same wood; it is yours only while it is on your side.

## Physics (pure, in the rules)
Fixed step 1/120 s. Friction slows pucks smoothly; pucks bounce off each other (equal weights, a little give), the board edges and both pieces of the wall, corners included. A puck belongs to the side its center is on.

## Bots
A bot picks a still puck on its side, fires it at the middle of the slot hard enough to carry well past, with a seeded wobble in the aim, one shot every so often. Hard and Expert pick the puck with the clearest line to the slot. Pace: Easy one shot every 2.2 s, Medium 1.6, Hard 1.2, Expert 0.9, all human speeds. The faster bot wins nearly always; two bots of the same tier usually run the clock out.

## Tests
Five pucks a side, nothing moves until shot; a pull fires back the way it was pulled, capped, only toward the wall; you shoot only your own nearly still pucks; a straight shot crosses and stays; the wall stops a shot away from the slot; pucks never end up inside each other; an empty side wins and time up goes to fewer pucks (draw if equal); an expert against nobody empties its side in under 30 s; the better bot wins. Invariant, every step of bot play: ten pucks, all on the board, none inside the wall.
