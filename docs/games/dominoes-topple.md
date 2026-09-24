# Dominoes Topple

Status: brief (2026-09-25). From the catalog's chill toys (docs/12 F, "Dominoes topple").

## The real thing
Domino toppling is a hobby of its own: people stand thousands of dominoes in lines, curves and forks and push the first. A standing domino falls when the one behind lands on it; it has to be closer than its own height, and a bend works as long as each step turns only a little. Lines split into two where one domino falls onto two standing side by side. The fun is the build and then the one push, and the groan when a gap stops the run halfway.

## What makes it feel right
- Laying is quick: draw a line with a finger and dominoes appear along it, facing the way the line runs.
- The fall is a ripple, one after another at a steady beat, each with a click.
- A gap stops it where it would really stop, so fixing the gap and trying again is the game.

## Our design
- A table seen from above. A standing domino is a thin candy bar; a fallen one lies flat and shows its pips.
- **Draw** to lay (every 24 units along the stroke), **tap** a standing domino to push it over. **Stand up** puts every fallen domino back; **Clear** empties the table.
- The chain is worked out in the rules (`toppleChain`), not the scene: a falling domino reaches 46 units from its base; it lands on the nearest standing domino in front of it within that reach and within its width, and on any other just as near (a fork). That one falls the way it faces, or backwards if it was hit from the front. Each fall comes 40ms plus a little per unit of distance after the one that hit it. The scene only plays the list out.
- Done when one push knocks down every domino on the table, with at least 20 there.
- Keyboard: Up lays the next domino straight on, Left and Right lay it turning 30 degrees, Enter pushes the first standing one, U stands them up, C clears.
- It is a toy: one seat, no bots needed. Test play lays a line with a U-turn and pushes the first.

## Tests
A straight line falls in order and each later than the last; a gap longer than a domino stops it; a push in the middle leaves the ones behind standing, and a domino hit from the front falls backwards; the U-turn path falls all the way, each domino once; crowding, the edge and tipping a fallen domino are not moves; all down with 20 or more is done, fewer or a gap is not; the referee replays test play.
