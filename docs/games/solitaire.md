# Solitaire (Klondike)

Status: built (2026-09-13). Draw 1 and Draw 3, tap-to-move and drag, undo, hints, Finish, standard scoring. Still to do: a solver for "winnable deals only", Race and Daily Deal.

## The real game
- 52 cards. **Tableau**: 7 columns with 1–7 cards, top card face up. Build **down in alternating colors**; move face-up runs together; only a King (or a run starting with a King) fills an empty column. **Foundations**: build each suit up from Ace to King. **Stock/waste**: draw 1 (or 3) at a time; recycle the waste when the stock runs out.
- Win by moving all cards to the foundations. **Draw 1 is winnable ~80%** of the time with good play; Draw 3 far less.
- Standard scoring: +10 to foundation, +5 waste→tableau, +5 turning a card face up.
- Sources: [Klondike rules](https://www.play-solitaire.com/blogs/the-rules-of-klondike-solitaire) · [Draw 1 vs Draw 3](https://solitairemastery.com/blog/klondike-draw-1-vs-draw-3) · [Scoring explained](https://solitairemastery.com/blog/klondike-solitaire-scoring-explained)

## What players want (reviews of top apps)
Unlimited undo, helpful hints, auto-complete, an option for **winnable deals only**, daily challenges, clean distraction-free play, and **no ads during a game** ([best solitaire apps](https://www.solitairebliss.com/blog/best-solitaire-app)).

## Our design
- **Rules engine:** full Klondike with Draw 1/Draw 3; seeded shuffles; a solver checks deals so "Winnable deals" mode only serves solvable seeds.
- **Interaction:** **tap a card → it jumps to the best legal spot** (foundation first), or **drag** it (cards follow your finger with a little lag and tilt, and settle with a spring). Undo, hint (the card wiggles), auto-complete when all cards are face up.
- **Look:** white felt-free table in soft mint, crisp vector cards (large readable ranks, original suit pips), card backs in the game's color with a small Game Pals pattern.
- **Motion:** cards flip with a 3D-ish scale turn; dealing fans out from the stock; winning makes the foundations cascade.
- **Modes:** solo; **Race** — same deal for two players; Daily Deal.
- **Different from our other games:** patience card game, solo.

## Tests
Legal moves (alternating colors, descending, King to empty), foundation building, stock recycling (draw 1/3), scoring, undo restores state exactly, solver finds wins for known-winnable seeds.
