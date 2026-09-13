# Penalty Kicks

Status: brief.

## The real game
- A penalty shootout: teams alternate kicks from the penalty spot against the other team's goalkeeper, **five kicks each**. It ends early when one side can no longer be caught; if level after five each, it goes to **sudden death** rounds (one kick each; score while the other misses and you win).
- Sources: [Wikipedia – penalty shoot-out](https://en.wikipedia.org/wiki/Penalty_shoot-out_(association_football)) · [Sport Rules – shootout explained](https://sportrules.org/football/penalty-shootout-rules-explained/)

## What makes it feel right
1. The **mind game** — kicker picks a spot, keeper guesses or reads the run-up.
2. The **dive** — full stretch, fingertips.
3. Shot variety: placed corner vs. blast vs. chip; risk of hitting the post or going over.
4. Net ripple, crowd roar, the scoreboard of ✓/✗ dots filling up.

## How others do it
- Swipe-to-shoot is the standard on mobile: swipe direction aims, swipe speed = power; keepers move by holding/dragging and dive on release ([Penalty Shooters 2 on Poki](https://poki.com/en/g/penalty-shooters-2), [Football Duel](https://www.rocketgames.io/game/football-duel)).
- Two-player versions alternate kicker/keeper roles, five kicks each.

## Our design
- **View:** top-down pitch. The goal sits in the **keeper's half** facing the kicker; the ball is on the spot in the **kicker's half**. Roles swap every kick, so the goal flips ends with a smooth camera-free slide of the goal and ball (each player always acts in their own half).
- **Kicker:** during a 3-second window, **swipe from the ball toward the goal**: direction = where it goes across the goal, speed = power (fast is harder to save but can fly over the bar), a curved swipe adds curl.
- **Keeper:** **drag left/right** to shuffle along the line, **flick** left/right to dive (fast, long reach, committed). Both act at the same time — reading the kicker's swipe start is part of the game.
- **Rules engine:** ball flight to the goal line with curl and height; save if the ball meets the keeper's reach shape (body + diving hands) at the line; post/bar hits bounce out; over the bar = miss. Shootout scoring with early finish and sudden death. Deterministic.
- **Bots:** kicker picks a spot with tier accuracy and power (Pip often down the middle; Nova the corners, sometimes a chip); keeper picks a dive with reaction time (Pip guesses early; Nova waits and reacts).
- **Feel:** ball spin trail, keeper stretch pose, net bulge, post "clang", crowd swell, ✓/✗ dots for each kick.
- **Clearly different:** alternating roles and a one-shot duel per kick instead of a rally.

## Tests
- Shootout: 5 each, early finish when unassailable, sudden death.
- Physics: centered shots at a centered keeper are saved; top-corner shots beat a keeper diving the wrong way; overpowered shots go over.
- Bots: Nova scores more and saves more than Pip over simulated shootouts.
- e2e: start vs bot, perform a swipe as kicker, no errors.
