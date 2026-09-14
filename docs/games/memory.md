# Memory (pairs)

Status: built (2026-09-14).

## The real game
- Also called Concentration, Pairs or Match Up. All cards lie face down in a grid. On your turn you flip two. If they match, you keep the pair **and go again**. If not, both flip back face down and the turn passes to the next player.
- The game ends when the last pair is taken. **Most pairs wins; ties are possible.** Solo play is scored by how few turns you need.
- Common variants: pairs by rank only, one flip per turn even after a match, bigger grids.
- Source: [Concentration (card game), Wikipedia](https://en.wikipedia.org/wiki/Concentration_(card_game)).

## What makes it feel right
1. The little gasp when the second card matches.
2. Remembering where you saw a card, and watching someone else forget.
3. A fair, calm pace: missed cards stay up long enough to see.
4. Clear, bold pictures that are easy to tell apart at a glance.

## How the best apps do it
Kids' and family memory apps (e.g. "Memory Match" style games) use big friendly pictures, 3 grid sizes, and a turn counter. Reviewers praise quick rounds and clear art; they complain when pictures look too alike or when bots obviously "cheat" by always knowing every card.

## Our design
- **View:** grid of rounded cards; backs in the game color with a dotted pattern; fronts are white with one bold original shape (circle, square, triangle, diamond, star, heart, ring, plus) in one of 7 candy colors. Every pair is a unique shape and color.
- **Sizes (levels):** 12 cards (3×4), 20 cards (4×5), 30 cards (5×6).
- **Players:** solo, or 2 to 4 players in any mix of people and bots on one device. Score chips across the top show each player's color, name and pairs; the current player's chip is lit up.
- **Motion:** cards flip with a squeeze; a match pops both cards and flies them to the scorer's chip; a miss gives a small shake, stays up for about a second, then both flip back.
- **Bots never cheat:** they only know cards that have been shown. Pip remembers the last 2 flips, Bo 6, Zed 14, Nova all of them.
- **Sounds:** tap on flip, a capture chime on a match, a soft thud on a miss.
- **Different from our other games:** pure memory, no luck once cards are seen, and the only game where every player shares the same board of hidden cards.

## Tests
Deal has every picture exactly twice and follows the seed; a match keeps the turn and scores; a miss passes the turn; taken or already-open cards can't be flipped; most pairs wins, a full tie is a draw; solo counts turns; bots use legal moves only, replay exactly, and Nova beats Pip.
