# Dominoes

Status: built (2026-09-16). Rules: the Block and Draw games with a double-six set, the most played dominoes games in homes and apps.

## The real game
- A double-six set has 28 tiles, each with two ends showing 0 to 6 pips. Every pair appears once, including the 7 doubles.
- **Deal:** tiles are shuffled face down. With 2 players each takes 7; with 3 or 4 players each takes 5 (Draw game) or 7 (Block game with 2, 6 with 3, 5 with 4 is also common). The rest is the boneyard.
- **Start:** the player with the highest double sets it down first (if nobody has a double, the highest tile). Play then goes round the table.
- **Playing:** on your turn put down one tile so that one of its ends matches an open end of the line. Doubles are set crossways but still count as one open end.
- **Block game:** if you can't play, you pass.
- **Draw game:** if you can't play, you draw from the boneyard until you can; if the boneyard is empty, you pass.
- **Ending a hand:** the first player to play all their tiles wins the hand and scores the pips left in everyone else's hands. If nobody can play (the game is blocked), the player with the fewest pips wins the hand and scores the others' pips minus their own.
- **Match:** play hands until someone reaches the target (often 100; we use 50 or 100).
- Sources: [Dominoes, Wikipedia](https://en.wikipedia.org/wiki/Dominoes) (the set, block and draw games); [Block (domino game)](https://en.wikipedia.org/wiki/Block_(domino_game)) and [Draw (domino game)](https://en.wikipedia.org/wiki/Draw_(domino_game)) (dealing, first play, scoring).

## What makes it feel right
1. The click of placing a tile and the line snaking across the table.
2. Counting which numbers are out and guessing what the others hold.
3. Blocking the other player by closing the ends they need.
4. The hand you can't see: dominoes is a game of hidden tiles.

## How the best apps do it
Good apps highlight the tiles you can play and the ends they fit, snake the line around the table so it never runs off screen, show how many tiles each player holds and total the score for you. Reviewers dislike tiny tiles, a line that goes off screen, unclear passes and bots that seem to know your tiles.

## Our design
- **Levels:** Block or Draw; target 50 or 100.
- **Look:** chunky ivory tiles with candy pips on a flat soft table; the line snakes in rows and turns at the edges; your hand sits along the bottom, and each player's name chip shows how many tiles they hold.
- **Controls:** tap a glowing tile in your hand; if it fits both ends, tap the end you want (it glows). Keyboard: arrows pick a tile, Up and Down switch the end, Enter plays it.
- **Motion:** tiles slide from the hand and click into place with a small bounce; tiles drawn from the boneyard slide into your hand; a pass shakes the player's name.
- **Players:** vs 1 to 3 bots, or 2 to 4 on one device (hands are hidden between turns with a "pass the phone" screen).
- **Bots (never cheat, never see hidden tiles):** Pip plays a random fitting tile; Bo plays its heaviest tile first; Zed keeps its numbers varied and blocks ends the next player can't match (from what they passed on); Nova guesses the hidden hands from what has been played and passed, and tests its choices against many possible deals (determinized Monte Carlo).
- **Different from our other games:** the first game with hidden hands; unlike our dice games, luck is in the deal and skill is in reading the table.

## Tests
28 tiles, each pair once; the deal gives the right number of tiles; the highest double starts; tiles only go on matching ends; doubles count once; Block passes and Draw draws until playable; the hand ends when someone goes out or the game is blocked, scoring as above; the match ends at the target; the deal comes from the seed so hands replay exactly; bots play only legal moves and only see their own hand; Nova beats Pip.
