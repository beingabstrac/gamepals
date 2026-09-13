# Ping Pong (table tennis)

Status: **rebuilt (2026-09-13)** as real table tennis. The first version was top-down "Pong" with paddles — too close to Air Hockey.

Decisions while building:
- **View:** straight top-down with the ball's height shown by its shadow and size, instead of a tilted table — a tilt would favor the bottom player when two people share one phone.
- **Spin:** deferred to a later pass; v1 has aim, power and timing.

## The real game
- Rally: after the serve, the ball must bounce **once on the receiver's side** before they return it; a return must clear the net and land on the opponent's half. Volleying (hitting before the bounce) is a fault in table tennis.
- **Serve:** toss and strike so the ball bounces **first on the server's own half**, then over the net onto the receiver's half. A serve that touches the net but otherwise lands correctly is a **let** (replayed).
- Points: missing, hitting into the net, hitting off the table, or letting it bounce twice on your side gives the point to the opponent.
- **Games to 11, win by 2**; serve switches every 2 points, and every point from 10–10 (deuce).
- Sources: [Olympics.com – rules](https://www.olympics.com/en/news/table-tennis-rules-regulations-how-to-play-official-laws-serve) · [HWS rules sheet](https://www.hws.edu/offices/recreation/pdf/table_tennis_rules.pdf) · [Killerspin FAQ](https://www.killerspin.com/blogs/tips/table-tennis-rules-explained-11-frequently-asked-questions)

## What makes it feel right
1. The **arc**: the ball rises, dips over the net and bounces — you read height from its shadow.
2. **Timing**: hitting at the top of the bounce is strong; too early/late is weak.
3. **Direction and spin** from how you swing.
4. Fast back-and-forth rhythm, with the *tok-tok* of bounce and paddle.
5. Rallies that build speed until someone makes a mistake.

## How the best apps do it
- **Table Tennis Touch / Ping Pong Fury** (Yakuto): perspective view of the table from behind your end; **swipe to hit** — the swipe's timing sets power, its direction aims, its curve adds spin. Reviewers praise the smooth swipe controls and realistic physics; the learning curve is the main complaint. ([Expert Table Tennis – best apps](https://www.experttabletennis.com/best-table-tennis-apps/))
- Casual 2-player collections (e.g. JindoBlu's) use a simple top-down table with paddles — fast to learn but it plays like air hockey.

## Our design
- **View:** portrait table seen from above at a gentle tilt (drawn in perspective: far end narrower), so both players on one phone read it the same way. Flat blue table, white lines, net across the middle.
- **Ball in 3D:** simulate `x, y` (on the table) and `z` (height) with gravity. Draw a soft **shadow** at `(x, y)` and the ball at `(x, y − z·k)`, slightly larger when higher. Bounces on the table surface with restitution; the net is a wall of height `h` at the middle — a ball crossing the middle below `h` hits the net.
- **Controls (one phone, two players):** each player owns their half. **Swipe toward the net** when the ball is on your side after its bounce: swipe direction → aim (x), swipe speed → power, timing vs. the bounce apex → quality (perfect / good / weak), sideways curve → spin (curves the flight). A short tutorial ghost shows the swipe.
- **Rules engine:** pure fixed-step simulation in `packages/rules/src/games/ping-pong` with serve/let/fault/double-bounce/out detection, scoring to 11 win by 2, serve switching every 2 (every 1 from deuce). Deterministic for replays and online play.
- **Bots:** compute the swipe they need; tiers differ in timing error, aim error, power and spin use (Pip mostly plays safe, soft returns; Nova hits corners with spin).
- **Feel:** paddle swing animation on hit, ball squash on bounce, rising "tok" pitch as rallies speed up, small shake on a smash, cheer on a long rally.
- **Clearly different from Air Hockey:** height and bounces matter, you hit with a swing (not by pushing a mallet), and there's a net and serve.

## Tests
- Rules: serve must bounce own side then other side; let replays; double bounce → point; net fault; out of table → point; 10–10 needs 2-point lead; serve rotation every 2 / every 1 at deuce.
- Physics: a perfect-timed swipe returns further/faster than a mistimed one; spin curves the path.
- Bots: Nova beats Pip over simulated games; Pip can return easy balls.
- e2e: start vs bot, perform swipes on the canvas, no errors, score changes.
