# Pointers

Status: brief (2026-09-24). A puzzle from the catalog's list (docs/12 D, "Pointers (arrows)"): the arrow-clearing puzzle of the phone puzzle shelves. The idea is generic; the name is ours.

## The puzzle
- **A grid of arrows.** Tap one and it flies straight off the board the way it points, if no other arrow is in its road.
- **If one is**, it bumps, and that costs one of three hearts.
- **Clear every arrow to win.** The whole puzzle is finding the order.

## Our design
- **Three sizes**: 5 by 5, 7 by 7, 9 by 9, about two thirds full.
- **Every board can be cleared without a bump**: it is built by placing arrows one at a time, each only where its road out is clear at the moment it goes down, so taking them off in the reverse order always works.
- **Candy tiles by direction** (up blue, right green, down red, left purple) with a white arrow. A free arrow flies off the board; a blocked one lunges into its neighbor and back with a thud and a small shake, and a heart empties.
- **Keyboard**: arrows move, Enter taps.

## Tests
An arrow with a clear road flies off and one blocked bumps and costs a life; clearing the board wins and running out of hearts loses; every board on every size can be cleared without a bump and is at least half full; the same seed deals the same board; test play finishes. Invariant, every tap of random play: a tap takes exactly that arrow off or costs exactly one heart, never both.
