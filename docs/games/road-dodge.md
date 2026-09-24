# Road Dodge

Status: brief (2026-09-24). A two-on-one-phone duel from the catalog (docs/12 A). Lane-dodging car games are a generic arcade genre (the endless lane runner); the name is plain and the traffic patterns are ours.

## The genre
A car at the bottom of a road, traffic coming down it faster and faster, and a tap to change lane. The skill is reading two rows ahead and not panicking into the wrong lane. The best versions keep the controls to one tap each way and let the speed do the work.

## What makes it feel right
1. The road speeding up until it is too fast, and still one more row.
2. The near miss, a lane change just in time.
3. Two players on the same traffic: you can see who blinked first.

## Our design
- **Each player drives their own road in their half of the phone**, turned round for the top one, like Basketball Hoops. Three lanes.
- **Both roads carry the same traffic**, seeded, so it is a fair race of nerve.
- **Tap the left of your half for a lane left, the right for a lane right**; Left and Right on a keyboard (A and D for the top player).
- A row blocks one lane early on and more often two as the rows go by, never all three. Speed starts at 300 px a second and climbs 7 every second to 760.
- A car half across two lanes can be clipped by either. A bump costs a heart and the car blinks safe for 1.2 seconds. **Three bumps and you are out; the last one driving wins.** Out together is a draw.
- **A two-minute cap**, which the genre does not have: two good bots never crash, and a duel should end. More hearts left wins, level is a draw.
- Lane lines roll, the car leans as it changes lane, the traffic is chunky toy cars in candy colors facing the other way, and the phone shakes on a bump.

## Bots
A bot looks at the next row it has not passed, if it is within its sight, and heads for the nearest free lane of it; now and then it slips and does not see a row at all. Easy: 190 px of sight and a 14 percent slip; Medium 240 and 7; Hard 300 and 3.5; Expert 380 and 1.5. Over ten seeds: Medium beats Easy 9 in 10, Hard beats Medium 9, Expert beats Hard 9.

## Tests
Every row leaves a lane free and blocks one; rows come down toward the car; a tap moves one lane, never off the road; a car parked in a blocked lane is bumped once by that row and blinks safe; three bumps and you are out, the last driving wins, time up goes on hearts; both roads carry the same traffic (two of the same bot drive alike); the better bot wins and every match ends. Invariant, every step of bot play: hearts only go down, one at a time, and cars stay on the road.
