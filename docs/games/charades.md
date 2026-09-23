# Charades

Status: brief (2026-09-24). Rules: the parlour game of charades in its phone form: one person holds the phone to their forehead, screen out, and the others act or describe the word on it until the holder says it. Charades is centuries old and nobody's product; the forehead phone versions (Heads Up and its family) are other people's apps, so ours is Charades with our own word list.

## The real game
- **One person guesses, everyone else gives clues.** In classic charades the clue giver mimes without speaking; the phone versions let the table act, sing or describe, as long as they do not say the word.
- **A minute a go.** Get as many words as you can; a word you cannot get you pass.
- **The phone goes round** and everyone takes a go. Most words wins.

## What makes it feel right
1. The phone on the forehead and the table yelling.
2. The word flipping to the next one the moment it is got.
3. The clock ticking down in the last ten seconds.
4. The round-up at the end of a go: how many you got.

## How the best ones do it
The forehead apps count down three seconds while you lift the phone, show one huge word, and take a tilt down for got it and a tilt up for pass, with a big green or orange flash and a sound. At the end of the minute they show the words got and passed.

## Our design
- **Two to eight people on one phone**, on the party table (how many, not chairs).
- **One or two goes each**, picked at the table.
- **Pass the phone**: a cover in the holder's color says whose go it is and to hold the phone on their forehead, screen out. A tap starts a three second count, then the words.
- **The table taps**: the left half is Pass, the right half is Got it, both big, both flash. The holder does not have to see anything. Tilting comes later (it needs a motion permission on iPhones, and a tap always works).
- **Sixty seconds a go**, the clock on screen and louder for the last ten. When it runs out the go ends; the word showing does not count.
- **160 words of our own** that can be acted: animals, things people do, jobs and characters, sports, things, feelings and places. No word comes up twice in a game until the deck runs out.
- **Keyboard**: Right arrow or Enter for got it, Left arrow or Backspace for pass, Space starts.
- **No bots.** Acting needs people. The test mode plays it as a steady table so CI can finish it.

## Tests
Each person holds the phone in seat order and only they can move; got scores for the holder and pass does not, both deal the next word; most words wins, all level is a draw, a shared top score is shared; two goes each goes round twice; no word repeats until the deck runs out; the same seed deals the same words; words cannot be played before the start. Invariant, every move of random games: the scores add up to the words got and never go down.
