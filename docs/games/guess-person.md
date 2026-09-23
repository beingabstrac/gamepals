# Guess the Person

Status: brief (2026-09-24). Rules: the face-guessing game, the family of Guess Who? (a trademark, and a product): two players each have a secret face from the same board and take turns asking yes or no questions to find the other's. The questions-to-narrow-it-down game is older than any box; ours is Guess the Person, with our own 24 faces.

## The real game
- **Both players have the same board of faces**, and each draws one secret face.
- **Take turns asking one yes or no question** about the other's face ("Are they wearing a hat?"). The answer lets you knock down every face that does not fit.
- **On your turn you can name a face instead.** Right wins; wrong loses (the usual house rule, and the one in the box).

## What makes it feel right
1. Faces tipping over in a row after a good question.
2. The question that splits the board in half.
3. The gamble of naming a face with two still up.
4. Asking the question your opponent just asked.

## How the best ones do it
The phone versions answer the questions themselves, which removes the classic mistake of a wrong answer ruining the game, and knock the faces down automatically. They offer a fixed list of questions about features anyone can see.

## Our design
- **24 faces of our own**, drawn flat: hair (black, brown, ginger, blonde, grey or none), long or short, hat, glasses, beard, earrings, big smile or not, and four skin tones that are never asked about. Every face differs from every other in something you can ask, so every game can be solved.
- **Twelve questions**, each asked once per player. The phone answers truthfully about the other player's face, and the faces that no longer fit tip over with a bounce.
- **Name a face**: tap it, then tap "It's Ana!". Any face can be named, even a fallen one: the rules never stop a person making a mistake.
- **vs bot** (Easy to Expert) or **two people on one phone**: the board is covered between turns and the one who asked hands the phone over after reading their answer.
- **Bots know only what their answers told them**, like a person. Easy asks any question that tells it something; the higher tiers more often ask the one that splits the standing faces closest to half; Expert takes a coin flip on two faces when the other player is about to get theirs.
- **Keyboard**: arrows walk the faces and then the questions, Enter asks, or picks a face and names it.
- **Online later**: the rules are pure and the server referee has it in its catalog.

## Tests
Every face differs from every other in something asked; a question is answered truthfully about the other face and the turn passes; a question cannot be asked twice by one player; naming the right face wins and the wrong one loses; the same seed deals the same faces. Invariant, every move of random games: each player's secret face is always still standing on the other's board. Bots never name a face their answers have ruled out and always finish; the sharper bot wins more.
