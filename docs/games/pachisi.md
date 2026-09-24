# Pachisi

Status: brief (2026-09-24). Rules: the Indian national game, played on cloth crosses for centuries (Akbar is said to have played it on a courtyard board with living pieces), and the ancestor of Parcheesi (a trademark) and Ludo. Rules as in [Wikipedia, Pachisi](https://en.wikipedia.org/wiki/Pachisi). Nobody's product, and the name is the game's own; the naming rule in docs/03 already maps Parcheesi to Pachisi.

## Not a reskin of Ludo
Ludo is its children's simplification. Pachisi keeps what Ludo threw away: a cross of three columns per arm rather than a square track, six cowrie shells with their odd values (none up is 25, one up is 10) rather than one die, twelve castle squares that are safe, a path down your own arm, round the whole board and back up your arm into the middle, and four players as two partnerships who win together.

## The real game
- **A cross** of four arms, each three columns of eight, around the Charkoni in the middle.
- **Four pieces each**, starting in the Charkoni.
- **Six cowries**: the throw counts the shells mouth up, 2 to 6, except none up is 25 and one up is 10.
- **A 6, 10 or 25 is a grace**: it lets a piece come on, and throws again.
- **The path** runs down the middle of your own arm, counter-clockwise right round the outside of the cross, and back up your own middle into the Charkoni, by the exact throw.
- **Landing on the other side's pieces** on any square that is not a castle sends all of them back to the Charkoni, and throws again. Castles are safe.
- **Four play as two partnerships**, sitting opposite. The side home first wins.

## Where we have to decide
- **No throw counts one**, so a piece one square from home could never finish. We do not let a piece stop there. (Our first write let it, and the invariant test found games that never ended.)
- **A castle held by the other side cannot be landed on**, since nobody there can be hit. Partners may share.
- **Two or three players** play for themselves, two sitting opposite.

## What makes it feel right
1. The clatter of six shells and the rare 25.
2. A grace and another throw.
3. Hitting a piece that was nearly home.
4. Waiting on a castle for the road to clear.

## Our design
- **The cross drawn flat and bright**: white outer columns, a pale road down each player's own middle, yellow castles with the cross sewn on, the Charkoni in purple.
- **Each player's corner** holds their waiting pieces, and their shells are thrown there: white with a slit mouth up, yellow back mouth down. "25! Grace" when it comes.
- **Tap to throw** anywhere on your turn; then the pieces that can go glow with a ghost where they land; tap either, whichever is nearer your finger, since the squares are small on a phone.
- **Pieces hop square by square**, faster on long throws; a hit piece arcs back to its corner with a shake; pieces home sit in the Charkoni on their own side.
- **Keyboard**: Space throws; number keys pick a move, or arrows and Enter.
- **Bots** see only the board and the throw, and weigh progress, bringing pieces on, hits, castles, and how likely a piece is to be hit where it lands. Pachisi is mostly luck: Hard beats Medium about three in five, and Expert plays about level with Hard.

## Tests
The path goes step by step round the cross (diagonally only at the corners where two arms meet) and back up your own arm, covering every other square once and never the Charkoni; twelve castles; the cowrie values; only a grace brings a piece on and a grace throws again; a hit sends every piece on the square back and throws again; a castle held by the other side cannot be landed on; home needs the exact throw and nobody stops one short; four play as partners who win together; two sit opposite; bots finish and the tiers come out in order; the same seed throws the same shells. Invariant, every move of random games: four pieces each, never two sides on one square that is not a castle, and every game ends.
