# Racing

Status: brief (2026-09-24). Rules: a top-down car race, the slot-car and Micro Machines kind of game that two-player phone packs all carry (JindoBlu lists racing cars). Nobody owns racing; we use no car makes, no tracks from any other game, and draw our own cars.

## The real game
- **Two cars on a closed track**, a lap line, a set number of laps. First over the line on the last lap wins.
- **Leaving the road costs you**: grass and gravel slow a car right down.
- **Cars bump**: a nudge on the inside of a bend takes the line, and a clumsy one sends both wide.
- The skill is the line: brake late, turn in, hit the apex, carry speed out.

## What makes it feel right
1. The countdown lights and both cars leaping off the line.
2. Sliding through a bend and just holding the road.
3. A bump that sends the other car into the grass.
4. Crossing the line half a car ahead.

## How the best ones do it
The two-player phone versions give each player a half of the screen with two big buttons, left and right; the car goes by itself, and all you do is steer. Top-down, the whole track on screen, three laps, a minute or two a race.

## Our design
- **Each car drives itself; you only steer.** Hold the left or right side of your half to turn that way. That is the whole control, so two people can race on one phone.
- **The track** is a closed loop drawn by us: a centre line and a width, with grass all round that slows a car to a crawl. Three tracks (an oval, a bean with a pinch in its side, and a hairpin), three laps each. Each race is on one picked by its seed, so a rematch is often a new track: real-time games have no level picker at the table, and adding one for this alone was more than the choice is worth. A test keeps every track's road from running over itself, which the first third track did.
- **Speed and grip**: a car accelerates to its top speed on the road; turning scrubs a little speed; on the grass the top speed drops to a third. Cars that touch push each other apart, the faster one losing a little speed.
- **Laps are counted by checkpoints** round the track in order, so cutting across the grass does not count as a lap.
- **Keyboard**: Left and Right for the bottom player, A and D for the top player.
- **Real time**, like Sumo and Air Hockey: a pure fixed-step `step` in the rules, the scene feeding it inputs. Bots steer for a point ahead on the centre line; Easy looks close and wobbles, Expert looks further and cuts the bends tighter.

## Tests
A car left to drive goes straight and speeds up to its top speed; steering turns it; on the grass it slows to its grass speed; a lap only counts after every checkpoint in order; three laps wins, and a car that has not finished cannot win; cars never overlap; the same inputs give the same race; Expert beats Easy in most races on every track. Invariant, every step of random races: laps never go down, a car's checkpoint is always the next one it needs, and speed never goes above top speed.
