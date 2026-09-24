# Fruit Merge

Status: brief (2026-09-24). From the catalog's puzzle list (docs/12 D). The drop-and-merge fruit game is a genre with many apps (the best known is a trademarked Japanese title); the name here is plain and the fruit is our own round candy fruit with faces.

## The genre
Fruit falls into a box one at a time, from where you let go. Two of the same that touch become one of the next size up. The box fills, fruit rolls and settles, and the game ends when the pile reaches the top. The joy is the chain: one drop that sets off three merges in a row.

## What makes it feel right
1. Real-feeling physics: fruit rolls off other fruit and settles into gaps.
2. The chain reaction.
3. Aiming, with the next fruit shown so you can plan.

## Our design
- A peach-edged box, eleven sizes of round candy fruit, each size its own color, with a leaf and a little face. Only the five smallest are ever dropped; the fruit in hand and the next one are dealt from the seed.
- **Slide to aim, let go to drop.** A dotted line shows where it will fall. Left and Right and Space on a keyboard.
- **The physics is a pure fixed step in the rules** (gravity, fruit pushed apart by size, a little bounce and rolling friction, walls), so a drop is a move like any other: the same drop always lands the same way, the referee can replay a game, and the scene simply plays the rules' steps back frame by frame. A drop settles when nothing has moved much for a fifth of a second, or after seven and a half seconds at most.
- Two the same that touch become one bigger where they met; two of the biggest just pop. Making a fruit scores its triangular number, so bigger fruit is worth a lot more.
- **Over the line once the drop has settled, and the game is over.** Score is the result; it keeps a best on the device like the other solo games.

## Bots
For tests and autoplay. Easy drops anywhere. Medium drops onto a fruit of the same kind it can see from above, or into the lowest spot. Hard and Expert try spots across the box (six and eleven) and keep the one that scores most and leaves the pile lowest; they think in the worker. A game is 100 to 250 drops.

## Tests
A dropped fruit comes to rest on the floor; two the same that touch become the next size where they met; two different ones push apart and stay in the box; a drop must fit between the walls; the fruit in hand comes from the smallest five and the next moves up; a pile over the line ends the game; the same drops land the same way and the referee replays a game; the medium bot scores more than dropping anywhere. Invariant, every drop of bot play: fruit stays in the box, every fruit is a real size, the score only climbs.
