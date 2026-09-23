# Spinner War

Status: brief (2026-09-24). Rules: the spinning-top battle, as played with battle tops in a stadium bowl (the Japanese beigoma of the 1600s, and every battling-top toy since). No one owns the idea; the toy brands are trademarks, so ours is Spinner War, and the tops are drawn by us.

## The real game
- **Two tops are launched into a shallow bowl** at the same moment.
- **The bowl's slope pulls them to the middle**, so they meet, clash and bounce apart again and again.
- **A top loses** when it is knocked out of the bowl (a ring out) or when it stops spinning first (a spin finish). In the toy leagues a ring out is worth more than a spin finish, and matches are first to a few points.
- **Spin is everything.** A faster top wins a clash and keeps going; a slower one is shoved and slowed further.

## What makes it feel right
1. The launch: both tops dropping in and screaming round the bowl.
2. The clash: sparks, a crack, and one top thrown to the rim.
3. A top wobbling as its spin runs out, then toppling.
4. Riding the rim to dodge, then coming back down with speed to hit.

## How the best ones do it
The phone battling-top games let each player steer their top a little (a thumb in their half), give a dash that costs spin, show both spin bars, and make every clash loud. Two-player phone packs (JindoBlu's Spinner War among them) keep it to short rounds, first to three.

## Our design
- **Not Sumo.** Sumo is two bodies on flat ground, and you win only by pushing. Here the bowl pulls you in, so you cannot run away; your spin is a clock that every clash winds down, and you can win without ever touching the rim: outlast them. The two games share a round board and nothing else.
- **The bowl** pulls every top toward the middle, harder toward the rim. A top that crosses the rim is out.
- **Spin** starts at 100 and runs down slowly on its own. In a clash, both lose spin, and the one going slower (relative to the hit) loses more and is thrown further, so speed is attack and spin is life. Spin also makes a top heavier to shove.
- **Steering**: each player holds and drags in their half to lean their top; a tap dashes the way it is going, costing spin. Against a bot, the person's half is the bottom.
- **Scoring**: a ring out is 2 points, a spin finish 1; first to 3 wins the match. Rounds start with a short countdown.
- **Keyboard**: arrows lean and Space dashes for the bottom player; W A S D and Shift for the top player, like every duel here.
- **Bots** are input functions like Sumo's: they circle to come at you from the outside, dash when lined up and faster, stay off the rim, and react late by their tier.

## Tests
A top left alone slides to the middle of the bowl; a top past the rim is out and scores a ring out; spin runs down on its own and a top at zero loses the round by spin finish; in a clash both lose spin and the slower loses more; a dash costs spin and is refused below a floor; points add up to the match and first to 3 wins; the same inputs give the same round; the bots never steer a top that has stopped; Expert beats Easy most rounds. Invariant, every step of random rounds: spin stays between 0 and 100, a top never overlaps the other, and points never go down.
