# Stampede

Status: brief (2026-09-25). The catalog's "Stampede (dodge runner)" (docs/12 A), given a core of its own. Built as M42c.

## The real thing
Endless-runner dodging games (lanes, oncoming traffic or animals, swipe to change lane) are one of the biggest casual genres, and all of them are one player against a pattern. The party-game twist that makes a duel of it is to hand the pattern to the other player, as in asymmetric playground games like "British Bulldog" and the herder-and-runner party games.

## Why it is its own game
Road Dodge has both players dodging the same traffic; whoever lasts wins. Here one player **makes** the danger: they choose which lane, when, and can set up a trap. The two roles swap each round, so each player is tested at both.

## Our design
- Five lanes on a field. The runner stands at the bottom and slides between lanes; the herder taps a lane at the top to send a cow charging down it, with a short wait between sends and never two at the top of one lane.
- The herd speeds up through the round (from 380 to 600 pixels a second). Last 20 seconds and the runner wins the round; get caught and the herder does.
- Four rounds, two each way. Most rounds wins; level on rounds, the longest total run; still level, a draw.
- **Controls by half, not by seat**: the bottom half always runs and the top half always herds. Two people on one phone turn it round when the roles swap (the banner says so); against a bot, you just run at the bottom and herd from the top. Keys: arrows run, 1 to 5 send.
- **Bots**: a running bot scores each lane by what is coming down it and runs to the safest one it can reach without crossing a worse one; a herding bot aims where the runner will be. Tiers are how far ahead a runner looks, how late it reacts, and how well a herder leads its aim. Only Expert sets traps (with a cow coming in the runner's lane, the next goes where it will run to); without traps no herder could catch a runner who looks ahead, and every Expert-Hard match was drawn.

## Tests
Nothing moves in the countdown; the runner runs; a cow is sent and the herder must wait; a cow in the runner's lane catches it and a lasted round goes to the runner; roles swap and four rounds end it; each tier beats the one below.
