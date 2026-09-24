# Wheelie

Status: brief (2026-09-24). A two-on-one-phone duel from the catalog (docs/12 A). Wheelie games (hold to lift the front wheel, balance, do not flip) are a generic genre; the name is the plain word.

## The genre
A bike seen side on. Holding the throttle lifts the front wheel; letting go brings it down. The balance point is narrow: too little and the wheel drops, too much and the bike goes over backwards. The best of these add a push-your-luck edge: you score the distance of a wheelie you land, so the question is always whether to keep going.

## What makes it feel right
1. Feathering the one button to hang on the balance point.
2. The bump that nearly throws you, and holding it.
3. Choosing to land while you are ahead, or not.

## Our design
- **Each player rides their own half of the phone**, side on, turned round for the top one. Both ride at once.
- **Hold your half to lift; let go to bring it down.** Space for the blue bike, Shift for the red, held.
- The bike pivots on its back wheel: holding pushes the front up harder than the rider's weight pulls it down, the weight pulls less the higher the front is but never nothing before the flip, and there is a little damping. Past 83 degrees it goes over.
- **Land it and the metres count; go over and that ride scores nothing.** A rider who never lifts in five seconds scores nothing for that ride.
- **The road gets bumpier the further a wheelie goes** (a bump every 90 px, each kicking the front a seeded way, harder along the ride), and both riders get the same bumps on the same ride. That is what ends a good wheelie, and what makes landing on purpose worth it.
- **Three rides each; the longest total wins**, equal is a draw.
- The metres count up live in each half, facing the rider, with the ride number and the running total; "Over! 0 m" when a bike flips.

## Bots
A bot holds while the lean, read a little ahead by its spin, is below the lean it aims for, and lets go above it; its aim wanders a bit every tenth of a second, seeded; past its banking distance it lets the front down to keep the ride. Easy never banks and wanders most; Medium banks at 34 m, Hard at 30, Expert at 29 and is the steadiest. Over ten seeds a pairing: Medium beats Easy 7 or 8 in 10, Hard beats Medium 9 in 10, Expert only matches Hard: at the top the bumps decide more than the rider, like the dice games.

## Tests
Hold and the front lifts, let go and it lands and the ride is banked; hold on too long and it goes over and scores nothing; never lifting scores nothing and the next ride starts fresh; bumps are the same for both and grow along the road; after three rides the longest total wins; the better bot wins and every match ends. Invariant, every step of bot play: the lean stays between the ground and the flip, and rides only add up, three at most.
