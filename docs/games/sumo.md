# Sumo

Status: brief — build next.

## The real game
- Two wrestlers in a round ring (dohyo). You win by forcing the opponent **out of the ring** or making them **touch the ground with anything other than the soles of their feet**. Stepping out with even a toe loses.
- Most bouts are won by pushing and force-outs (oshi-dashi, yori-kiri) — footwork, balance and timing, not tricks. Slaps, pushes and trips are allowed; punches and kicks are not.
- Sources: [USA Sumo – rules](https://www.usasumo.com/learn/rules-techniques/) · [Rules of Sport – sumo](https://www.rulesofsport.com/sports/sumo-wrestling.html) · [Kimarite (winning techniques)](https://en.wikipedia.org/wiki/Kimarite)

## What makes it feel right
1. **Weight and momentum** — heavy bodies that take time to speed up and stop.
2. The **clash**: two bodies meeting and one giving way.
3. **Edge tension** — teetering on the straw bales before going over.
4. **Commitment risk** — a big lunge that misses can carry you out yourself.
5. Short bouts, instant rematch.

## How others do it
- Casual 2-player collections: tap-to-push blobs in a ring — fun but mostly button-mashing.
- Physics party games (e.g. sumo modes in party collections): momentum and ring-outs make it tactical.

## Our design
- **View:** top-down round clay ring (peach) with a straw-bale edge and the two start lines; flat, cute wrestlers — round blobs with a belt in their side's color.
- **Controls (one phone):** each player owns their half.
  - **Hold and drag** anywhere in your half = lean/steer toward that direction (like a thumbstick from where you touched).
  - **Tap** = **shove**: a short burst forward with a cooldown (~0.6 s). A shove that hits the opponent pushes them hard; a shove that misses carries you forward (risk).
- **Physics (rules package, fixed step):** circles with mass, acceleration from steering, drag, elastic collisions with impulse; shove = impulse + short "braced" state (heavier while shoving). Out = the center passes the ring edge. Deterministic.
- **Match:** best of 3 bouts; a "Hakkeyoi!" countdown starts each bout.
- **Bots:** approach, try to get **between the opponent and the ring center** (so pushes go outward), shove when close and aligned, back off from the edge. Tiers: reaction delay, shove timing accuracy, edge awareness (Pip lunges and sometimes steps out; Nova circles and times shoves).
- **Feel:** squash on impact, dust puffs, stumble wobble at the edge, big slide-out with a shake, gong sound.
- **Clearly different from Air Hockey/Ping Pong:** you *are* the body; weight, momentum and ring position decide it.

## Tests
- Physics: steering accelerates; drag slows; collision conserves momentum direction; shove impulse and cooldown; leaving the ring ends the bout.
- Match: best of 3, countdown ignores input.
- Bots: Nova beats Pip over simulated bouts; Pip sometimes self-eliminates.
- e2e: start vs bot, drag and tap in the bottom half, no errors.
