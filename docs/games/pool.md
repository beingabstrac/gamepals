# Pool

Status: brief (2026-09-23). Rules: eight-ball as the World Pool-Billiard Association's World Standardized Rules set it out, with the simplifications every phone version makes, each named below. "8 Ball Pool" is Miniclip's product name, so ours is Pool ([03 §4](03-game-catalog.md#4-trademark-safe-naming)).

## The real game (WPA eight-ball)
- **Fifteen balls racked in a triangle**, the 8 in the middle, a solid and a stripe in the back corners. Seven solids (1 to 7), seven stripes (9 to 15), and the 8.
- **The break** is from behind the head string. If the breaker pockets nothing, the turn passes.
- **The table is open after the break**, whatever went in. The first ball legally pocketed after the break gives that player its group, and the other player the other group.
- **A legal shot** hits one of your own balls first (on an open table, anything but the 8), and then either pockets a ball or sends some ball, cue ball included, to a cushion.
- **Pocketing one of your own balls legally keeps your turn.** Anything else passes it.
- **Fouls**: the cue ball going in (a scratch), hitting nothing, hitting the wrong ball first, or nothing reaching a cushion after contact. The other player then has **ball in hand**: they put the cue ball anywhere and shoot.
- **The 8** is yours to shoot once your group is gone, and you call the pocket. Pocket it in the called pocket without a foul to win.
- **You lose** if you pocket the 8 early, in a pocket you did not call, or with a foul on the same shot.

## What makes it feel right
1. The aim line and the ghost ball showing where the object ball will go.
2. The crack of the break and fifteen balls scattering.
3. A ball rolling slowly toward the pocket and dropping in, or stopping on the lip.
4. Running three in a row and knowing the table is yours.

## How the best ones do it
The phone versions (Miniclip's, and the many like it) hold the table upright on a phone, aim by dragging anywhere on the table, draw a guide line with a ghost ball and the object ball's path, and take power from a slider or from pulling the cue back. They call the pocket for the 8 with a tap, give ball in hand anywhere after a foul, and never make you re-rack.

## Our design
- **Simplified the way the phone versions are**: the 8 on the break is spotted back and play goes on; ball in hand after any foul is anywhere, not behind the line; no pushes, no three-foul rule, no safety call. Everything else is WPA.
- **Shots, not real time.** A move is an aim, a power and, when it matters, where the cue ball is put and which pocket is called for the 8. The rules run the whole shot as a fixed-step simulation and return where every ball stopped, so a server can replay a game exactly.
- **The simulation uses only arithmetic and square roots**, which every JavaScript engine does identically. An aim is a direction given as two whole numbers (towards a point), never an angle, because `sin` and `cos` may differ in the last bit between engines and a pool shot amplifies the last bit into a different game.
- **The table**: a 9-foot table, 2540 by 1270 mm, held upright, balls 57 mm across, six pockets. A ball drops when its centre comes inside a pocket's circle; there are no jaws yet, so a ball running along a cushion drops into a side pocket more readily than on a real table. Balls slow with rolling friction, lose a little on each other and more on the cushions. No spin in this version, which is the first thing to add if the game earns it.
- **Moves and the move list.** A shot is a direction, a power from 1 to 100, and sometimes a placement and a called pocket: far too many to list. So this game is the first to answer `accepts(move)`: the state says whether it would take a move, and `apply` takes exactly those. `legalMoves` lists a spread of shots for bots and tests. A core helper does the lookup everywhere a move arrives (the session, the bot worker and the referee), so every game without `accepts` works as before.
- **Touch**: drag anywhere on the table to aim; the guide shows the ghost ball and where the object ball will run. Pull the power bar at the side down and let go to shoot. With ball in hand, drag the cue ball. For the 8, the pocket it is heading for is called, and a tap on another pocket calls that one. **Keyboard**: left and right turn the aim (Shift for fine), up and down set power, Space shoots.
- **Bots** plan with the same simulation: for each of their balls and each pocket, the ghost-ball aim, a few powers, simulated to the end and scored (own ball in, cue ball safe, what is left for the next shot). Easy tries few shots and shakes its aim, Expert tries many with none. They see the same table you do; there is nothing hidden in pool.
- **Two players**, on one phone or against a bot. The table stays the same way up for both, as a real table does, and the line above it says whose shot it is and what they are on.

## Tests
The rack is fifteen balls with the 8 in the middle and a solid and a stripe in the back corners; the same shot from the same table always ends the same way; a straight shot into a pocket pockets the ball; balls never end inside each other or outside the cushions; a harder hit sends a ball further; a scratch gives ball in hand; the wrong ball first is a foul; no cushion after contact is a foul; the first legal pocket after the break assigns groups and keeps the turn; the 8 early or in the wrong pocket loses; the 8 in the called pocket after your group wins; the 8 on the break goes back on the foot spot; `accepts` takes every move in `legalMoves` and refuses malformed, out-of-range and misplaced shots; replay reproduces a game; bots only play shots the table accepts, and Expert beats Easy in most games. Invariant, after every shot of random games: sixteen balls, every one on the table inside the cushions or down, no two overlapping, and a cue ball that is down always means ball in hand. Measured: bot games end in 7 to 69 shots across the tiers, and the slowest bot move takes 129ms, in the worker.
