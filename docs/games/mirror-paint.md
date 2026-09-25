# Mirror Paint

Status: brief (2026-09-25). The catalog's "Neon paint" (docs/12 F), made our own. Built as M40b.

## The real thing
Neon and symmetry painting toys (kaleidoscope drawing apps, spirograph-like doodle toys) share one trick: every stroke you draw is copied round a middle, turned and mirrored, so a scribble comes out as a snowflake or a mandala. The neon versions add a glow on black.

## Why ours is not neon
Our look is flat bright candy on white with no gradients anywhere (docs/12 Part 3), and a dark second look has already been tried and dropped. A glow is a gradient. What makes these toys fun is the symmetry, not the glow, so Mirror Paint keeps the symmetry, paints in our seven candy colors on white, and uses thick round strokes that read as bold without glowing.

## Why it is its own toy
Draw & Guess is drawing for others to guess, one stroke at a time, with a clock. Zen Garden rakes lines. Here the drawing makes itself beautiful: one stroke becomes up to sixteen.

## Our design
- A round white canvas. Choose how many ways it mirrors (2, 4, 6 or 8 slices, each also mirrored across its own middle), a color, and a brush size.
- Drag to paint. Every point is copied round the middle into each slice.
- Clear wipes it; Done finishes (done when you say, like Sand Fall).
- The painting lives on an offscreen 2D canvas drawn at twice the size and shown at half, so the lines stay crisp; the rules count strokes and know the settings.
- Keyboard: 1 to 7 colors, M changes the mirror, B the brush, arrow keys draw from the middle, C clears, D is done.

## Tests
Settings change, strokes count, clearing keeps the settings, nothing after done, and the referee replays test play.
