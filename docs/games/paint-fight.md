# Paint Fight

Status: brief (2026-09-24). Rules: the paint-the-floor duel, the arcade idea behind territory games like Splatoon's Turf War mode and every "paint.io"-style phone game: cover more of the floor in your colour than the other side before the time runs out. Nobody owns painting a floor; we use none of their names or art.

## The real game
- **Two painters on one floor**, each leaving their colour wherever they go.
- **Painting over the other's colour takes it back.** What counts is who owns the most floor at the end.
- A short, fixed time, and the floor as it stands at the buzzer is the score.

## What makes it feel right
1. The trail: a fat stripe of colour behind you as you go.
2. Painting over their work and watching their share drop.
3. A big splat covering a whole patch at once.
4. The last seconds, both racing for the gaps.

## How the best ones do it
The two-player phone packs keep it to a minute, one thumb to steer each, a bar at the side showing the split, and something to grab now and then that paints a big blob at once.

## Our design
- **A floor of 12 by 18 tiles**, two rollers that go where you steer: hold and drag in your half, like Sumo. The roller always moves; you only steer it.
- **Every tile a roller passes over turns its colour**, over the other's colour too.
- **Paint pots** appear now and then from the seed; roll over one and it splats your colour over the tiles round it.
- **Rollers bump** off each other and off the walls.
- **Sixty seconds**; the most tiles wins, a level count is a draw. The split shows as a bar across the middle all the time.
- **Keyboard**: arrows steer the bottom roller, W A S D the top one.
- **Real time**, a pure fixed-step `step` in the rules. Bots head for the nearest tiles that are not theirs, the other player's first, and for pots, steering late and wobbly by tier.

## Tests
A roller paints the tile under it and paints over the other's colour; a pot splats the tiles round it and goes; rollers stay on the floor and do not pass through each other; the round ends at sixty seconds with the most tiles winning or a draw; the same inputs give the same round; Expert beats Easy. Invariant, every step of random rounds: every tile is one colour or neither, the two counts and the unpainted tiles add up to the floor, and the clock only runs forward.
