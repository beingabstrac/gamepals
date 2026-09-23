# Grab It

Status: brief (2026-09-24). Rules: the grab-the-object party game, the family of Snap, Spoons and Jungle Speed: something is called, things turn up one after another, and the first hand on the right one wins it, while a hand on the wrong one costs you. Nobody owns grabbing things; the named card games are other people's products, so ours is Grab It, with our own pictures.

## The real game
- **A target is called** (in Snap, a match; in Jungle Speed, a matching symbol).
- **Things turn up one at a time.** When the called thing shows, the first to grab it takes the point.
- **Grab at the wrong thing** and you pay: in Jungle Speed you take cards, in ours you lose a point.
- It is all nerve: the look-alikes are there to make you twitch.

## What makes it feel right
1. The wait, hand hovering.
2. The flash of the right picture and both hands slamming down.
3. Twitching at a look-alike and pulling back.
4. The point going to whoever was a hair faster.

## How the best ones do it
The two-player phone packs split the screen, show the call at each player's end, flash pictures in the middle, and give each player a big button in their half. A round is first to a handful of points.

## Our design
- **The call** is shown to both players, turned to face each, then pictures flash in the middle one after another: two to six decoys, then the one called.
- **Decoys include look-alikes**: the same colour and a different shape (the cherry and the heart, the lemon and the star, the grapes and the moon), about four in ten of them.
- **Tap your half to grab.** The right picture is a point to whoever tapped first; a grab at a decoy loses a point and freezes your hand for a moment. If nobody grabs the right one in two seconds, it goes and a new call starts.
- **Both hands down in the same step** is a tie nobody could see, so the point goes to each player in turn, call by call.
- **First to five points wins.**
- **Keyboard**: Space grabs for the bottom player, Shift for the top one.
- **Real time**, a pure fixed-step `step` in the rules, the flashes dealt from the seed. Bots grab the right picture after a reaction time by tier, and Easy now and then twitches at a look-alike.

## Tests
A grab on the called picture scores and starts a new call; a grab on a decoy loses a point (never below nought) and freezes that hand; a frozen hand cannot grab; both grabbing the right one in the same step goes to each seat in turn, call by call; nobody grabbing in two seconds starts a new call with no point; first to five wins; every call's flashes end with the target and never show the target early; the same inputs give the same round; Expert beats Easy. Invariant, every step of random rounds: scores stay between 0 and 5, and a picture showing is always the current call's flash for this moment.
