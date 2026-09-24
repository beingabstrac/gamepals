# Sand Fall

Status: brief (2026-09-25). From the catalog's chill toys (docs/12 F, "Kinetic sand" / sand art). Falling-sand toys are a generic genre (the cellular sand simulations people have made since the 1990s).

## The genre
Pour sand and watch it fall: each grain drops if there is room below, or slides off to one side if not, so it piles up in soft hills. Sand art in a jar is the calm version: layer after layer of color.

## Our design
- A tall jar, seven candy colors along the bottom, Shake and Done.
- **Drag in the jar to pour** the chosen color where your finger is; the grains fall and pile in slopes and stripes. Shake empties the jar with a shake of the phone's picture.
- The sand is a grid of 130 by 180 grains, each drawn four pixels square, updated every frame by the scene (a grain falls straight down if it can, else to one side, bottom rows first, alternating direction so it does not lean). The rules only count pours and shakes and know when it is done, as Zen Garden's rules keep only its stones; the pours are sent a few times a second, not per grain.
- Keyboard: 1 to 7 pick a color, Space pours a stream, S shakes, D is done.
- Done when you say so.

## Tests
Pours in any color and shakes are counted and done finishes it; an unknown color is not a move; the referee replays a jar.
