# Oware

Status: brief (2026-09-25). From the catalog's board list (docs/12 B, "Mancala (Kalah, Oware)"). Oware is the traditional West African count-and-capture game; rules here are Abapa, the standard tournament set (as described by the Oware Society and Pagat).

## The real game
Two rows of six houses, four seeds in each, 48 in all. On your turn pick up all the seeds from one of your houses and sow them one by one into the following houses, counterclockwise; with twelve or more you skip the house you started from. If the last seed lands in one of your opponent's houses and brings it to two or three, you capture those seeds, and also those of the preceding houses, as long as they are the opponent's and hold two or three. A move that would capture all the opponent's seeds (a grand slam) captures nothing. If your opponent has no seeds, you must, if you can, make a move that gives them some; if you cannot, you take all the seeds left. The first to capture more than 24 wins; 24 each is a draw.

## How it differs from our Mancala (Kalah)
Kalah sows into your own store, gives an extra turn for a last seed in the store and captures from an empty house on your side. Oware has none of that: the stores only hold captures, and captures happen on the other side, from twos and threes, which is a quite different game to think about.

## Our design
- The Mancala board and its hopper animation, with the end pits holding captures only. Blue at the bottom, red at the top.
- Abapa rules as above. Games between people can circle for a long time with few seeds; the real game ends by agreement, so here sixty moves in a row with no capture end it, each player keeping the seeds on their side (the same thing happens when the player to move has no seeds and cannot be fed).
- Keyboard as in Mancala: 1 to 6, or arrows and Enter.

## Bots
Search bots like Mancala's, on captured seeds (Hard and Expert also count seeds still on their side): depth 1, 3, 5 and 7. Hard beats Easy at least six games in eight.

## Tests
Sowing never enters the capture pits; a big house skips itself; a last seed making two or three captures, with the run before it; a grand slam captures nothing; an empty side must be fed; the game ends with all 48 accounted for and the referee replays it; the deeper bot wins more. Invariant, every move: all 48 seeds are on the board or taken.
