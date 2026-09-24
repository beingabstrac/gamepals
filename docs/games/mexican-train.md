# Mexican Train

Status: brief (2026-09-25). From the catalog's board list (docs/12 B, "Dominoes (+ Mexican Train)"). Mexican Train is a traditional dominoes game; rules as described by Pagat and the common double-twelve sets' rule sheets, scaled to a double-nine set.

## The real game
A double-twelve set, one round per double from 12 down, the double of the round in the middle as the hub (the engine). Each player has a train running out from the hub, and there is one public "Mexican train". On your turn play a matching tile on your own train, on the Mexican train, or on any other player's train that carries a marker. If you cannot, draw one; if it still will not go, pass and put a marker on your train, which lets anyone play there until you play on it again. A double must be satisfied: the player who laid it plays again, and until someone covers it nothing else may be played. The first to play out wins the round; a blocked round is scored on pips left.

## Our design
- **One round with a double-nine set** (the hub is the double nine), which suits a phone and a sitting: 12 tiles each for two players, 10 for three, 9 for four.
- One row per train (each player's in their color, then the Mexican train), the hub standing at the left, the train's end showing, a flag on open trains, a glow on the double that must be covered.
- **Tap a tile, then a train it fits** (it goes by itself if it fits only one). Draw and Pass are one button that shows when that is all there is to do. Keyboard: Left and Right pick a tile, Enter picks it up, a number key picks the train, D draws, P passes.
- Hands are hidden between people passing the phone, with the same cover as the card games.
- First to play out wins; a blocked round (the pile empty and everyone passing) goes to the fewest pips in hand.

## Bots
Easy plays anything; Medium lays its biggest tiles, doubles first; Hard and Expert keep the longest run their hand can make for their own train and lay the other tiles elsewhere (Expert also likes to play on other people's open trains). Dominoes deals decide a lot: over twenty rounds the tiers come out close, as with the real game.

## Tests
The deal from a double-nine set with the hub out; a tile goes on your own train or the Mexican one if it matches, never someone else's without a marker; can't play means draw, then pass and a marker that opens your train; a double must be covered first and its player goes again; first to play out wins and a blocked round goes to the fewest pips; the longest run a hand can lay; bots finish rounds of 2, 3 and 4 and the referee replays them. Invariant, every move: all 54 tiles are somewhere, once each.
