# Pizza Memory

Status: brief (2026-09-25). From the catalog's card and memory games (docs/12 C, "Pizza Memory"). Built as M40c.

## The real thing
Order-memory games (the diner and pizzeria "remember the order" kids' games, and the memory rounds in cooking apps) show you what the customer wants for a few seconds, hide it, and ask you to make it. It trains the same short-term visual memory as a card-pairs game but asks you to rebuild a whole picture, where the position of each thing matters.

## Why it is its own game
Memory is flipping two cards at a time to find pairs; you never see everything at once. Here you see the whole pizza at once, then build it back from nothing: eight slices, five toppings, where each one goes.

## Our design
- Five orders a game. Each order is a pizza cut in eight slices with a topping on some of them: pepperoni, mushroom, olive, pepper or pineapple. The first order has three toppings; each order after has one more, up to seven.
- **Look:** the order is shown for a few seconds (longer for bigger orders). Tap Ready to start early.
- **Make:** pick a topping from the tray, tap slices to put it on (tap again to take it off). Serve when done.
- A slice is right if it has the topping the order had, or is empty when the order's was. The order and yours are shown side by side with a tick on each right slice, then the next order.
- The score is the slices right out of forty, and a star for each perfect pizza.
- Orders come from the seed, so a daily or a race is the same pizzas for everyone.
- Keyboard: 1 to 5 pick a topping, 0 the empty hand, arrows pick a slice, Enter places, S serves, R is Ready.
- Test play copies the order exactly (in a race a person plays against the clock and each other, never against a bot).

## Tests
Orders grow by one topping each and stay inside eight slices; placing, replacing and removing; the look phase takes only Ready; serving scores slices and moves on; five orders end it; the referee replays test play.
