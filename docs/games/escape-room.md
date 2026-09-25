# Escape Room

Status: brief (2026-09-25). From the catalog's puzzles (docs/12 D, "Escape (room-lite)"). Built as M41a.

## The real thing
Room-escape games (the point-and-click "escape the room" genre, and the family escape boxes sold as board games) lock you in a room with a coded door. You look round every wall, open drawers and boxes, and work out the code from what you find. The good ones are fair: every clue is in the room, nothing depends on guessing.

## Room-lite
A full escape game is dozens of hand-made puzzles. Ours is the core of the genre that can be laid fresh from a seed and is always fair: **find and count**. The door's lock shows a row of pictures; the code is how many of each there are in the room, in that order. Things hide inside drawers, boxes and behind curtains, and some rooms have look-alikes (a red apple is not a green apple).

## Why it is its own game
Tile Match and Mahjong match what is in front of you; Memory hides things you have seen. Here you move round a room you cannot see all at once and have to be thorough.

## Our design
- Three rooms a run. Room 1 has a two-digit lock and nothing hidden; room 2 three digits with drawers and boxes; room 3 four digits, curtains too, and a look-alike for one of the things to count.
- Four walls: turn with the arrows at the sides (or swipe, or Left and Right). The door wall has the lock: tap a wheel to turn it up (or its lower half to turn it down), then Try.
- Counts are 1 to 6, so every digit is findable and none is zero.
- A wrong try shakes the lock and counts; the result says how many tries and how long.
- Keyboard: Left and Right turn, Tab picks a hiding place and Enter opens it, on the door wall Up and Down turn the chosen wheel, numbers type the code, Enter tries.
- Rules keep the rooms (what is where, what is hidden), the room you are in and the tries; the code is checked in the rules, so a race or a daily can be refereed.

## Tests
Codes match the counts of the target things (look-alikes and hidden ones counted right); rooms grow; a wrong code is a try and stays; the right code moves to the next room; three rooms end it; any four digits or fewer is a move (allows), anything else is not; the referee replays test play.
