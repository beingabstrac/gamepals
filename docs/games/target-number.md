# Target Number

Status: brief (2026-09-20). Rules: the numbers round that French television has run as *Le Compte est Bon* since 1972 and British television as the numbers game since 1982. The mechanic is not owned; the programme names are, so ours is Target Number ([03 §4](03-game-catalog.md#4-trademark-safe-naming)).

## The real game
- **Six numbers and a target.** The numbers come from two sets of 1 to 10 and up to four large ones, 25, 50, 75 and 100.
- **The target is three digits**, 101 to 999.
- **Add, subtract, multiply, divide** to reach it. Each number is used at most once, and each result becomes a number you can use.
- **Never a fraction and never below zero.** A division has to come out whole, and a subtraction has to leave something positive.
- **You do not have to use all six.**
- Closest wins if nobody is exact.

## What makes it feel right
1. Spotting that the target is a multiple of something you hold.
2. Being one away and hunting for the 1.
3. Getting there with four of the six and knowing the rest were never needed.
4. Being told afterwards that it could have been done exactly, and how.

## How the best ones do it
They guarantee the target is reachable, so being stuck is your fault and not the draw's. They show the working as a stack you can take back one step at a time. They say how close you got and what the best possible was. They never ask for a fraction.

## Our design
- **Every puzzle is solvable exactly**, checked when it is laid: the generator draws, solves, and draws again if the target cannot be hit. Measured before building, 55 of 60 random draws are exactly solvable, so a draw that has to be thrown back is rare and the solve is 104ms at its very worst.
- **A move combines two numbers.** Pick two and an operation, and they are replaced by the result. That is what the rules take and what `legalMoves` lists, so a person's working can be verified by the server exactly as it was played.
- **A step can be taken back**, one at a time, because a numbers round is nothing but trying things.
- **How close you got** is tracked as you go, so the end can say "7 away" rather than just "no".
- **Deterministic**, so the date can set a round and everybody gets the same numbers.
- **Bots** are autoplayers using the same solver.

## Tests
Only whole positive results accepted; each number used once; the target ending it; the closest tracked as the working changes; a step taken back; every seed laying a puzzle that really is solvable, checked by a solver that does not know what the generator claimed; the same seed giving the same numbers; and bots reaching the target.
