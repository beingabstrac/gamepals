# Hearts

Status: brief (2026-09-19). Rules: the game everybody means by Hearts, which card historians call Black Lady: plain Hearts with the queen of spades added.

## The real game
- **Four players, thirteen cards each**, the whole deck.
- **Before each hand you pass three cards.** The direction goes round: left, right, across, and then a hand with no passing at all, over and over.
- **Whoever holds the two of clubs leads it** to the first trick.
- **Follow the suit that was led if you can.** If you cannot, play anything, with one exception: **nothing that scores may be played on the first trick**.
- **Hearts cannot be led** until a heart has been discarded on somebody else's suit, or the player leading holds nothing else.
- **Every heart is one point and the queen of spades is thirteen**, so a hand is worth 26. Points are bad: the lowest score wins.
- **Shooting the moon:** take all 26 and you score nothing while everybody else takes 26.
- The game ends when somebody reaches **100**, and the lowest score wins.
- Sources: [Hearts, Wikipedia](https://en.wikipedia.org/wiki/Hearts_(card_game)) (four players, the passing rotation, following suit, breaking hearts, shooting the moon, and playing to an agreed score) and [Black Lady, Wikipedia](https://en.wikipedia.org/wiki/Black_Lady) (the queen of spades counting thirteen, the two of clubs leading, and 100 to finish).

## What makes it feel right
1. Passing three cards you will regret giving away.
2. Watching the queen of spades arrive on a trick you have already won.
3. The player who has taken nothing all hand, and the moment they take one heart.
4. Somebody shooting the moon, and everybody else realising four cards too late.

## How the best apps do it
Good Hearts apps mark the cards you cannot legally play rather than refusing a tap with no reason, show the four cards of the trick where you can see who played what, keep the running score visible, and say when hearts have been broken. Reviewers dislike not knowing why a card is refused, and bots that pass the queen of spades to the same player every time.

## Our design
- **Levels:** one hand, to 50, or to 100, picked at the table. A full game to 100 is eight or nine hands, which is a long sitting on a phone, so it is a choice rather than the only way to play.
- **Passing is three taps and a button.** The three you have picked lift out of your hand; the button says where they are going.
- **Cards you cannot play sit back and do not answer a tap**, the same as the other card games here, and the reason is written above the hand: "Follow clubs", "Hearts are not broken yet".
- **The trick sits in the middle**, one card in front of each player, and stays there long enough to read before it is gathered to whoever won it.
- **Hands are private**, with the cover when the phone is passed, the same as the other dealt-hand games.
- **Bots** are handed a seat's view: their own cards, the trick so far, what has been played, the scores, and who is out of which suit (which anybody at the table would know by watching). A test shuffles the other hands behind each level to prove the same card comes out.
- **Messages:** plain words: "Hearts are broken", "Bo takes the trick", "Nova shot the moon".

## Tests
Thirteen cards each and the two of clubs leads; passing goes left, right, across, then nobody; you must follow suit when you can; nothing that scores may go on the first trick; hearts cannot be led until they are broken or that is all you hold; the highest card of the suit led takes the trick and leads the next; a heart is one point and the queen is thirteen; taking all 26 gives everybody else 26; the game ends at the target score and the lowest wins; illegal moves throw; the deal comes from the seed so games replay exactly; and every bot plays the same card when the other hands are shuffled behind it.
