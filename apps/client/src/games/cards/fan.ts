/**
 * Fanning a column of cards: how far to step down for each one, and whether the result can still
 * be read. A covered card shows only the strip between its own top edge and the next card's, so
 * the step is the whole of what you can see of it. Step less far than the corner index reaches
 * and the card goes quiet: in Spider, where a run has to be all one suit, a column of quiet cards
 * cannot be played from at all.
 */

/** A face-down card only has to say that it is there. */
const DOWN_MIN = 6;

/**
 * The step under each card in a column, given the room the column has.
 *
 * Face-down cards give up their space first. Squeezing both kinds by the same factor, which is
 * what every one of these scenes used to do, spends the scarce room equally on cards that carry
 * no information and cards you have to read.
 *
 * @param down one entry per gap: whether the card above that gap is face down.
 * @param room the height the column may use.
 * @param upMin how far a face-up card must step to stay readable: its corner index height.
 */
export function fanSteps(down: readonly boolean[], room: number, downStep: number, upStep: number, upMin: number): number[] {
  const downs = down.filter(Boolean).length;
  const ups = down.length - downs;
  let d = downStep;
  let u = upStep;
  const total = () => downs * d + ups * u;
  if (total() > room) {
    if (downs > 0) d = Math.max(DOWN_MIN, (room - ups * u) / downs);
    if (total() > room && ups > 0) u = Math.max(upMin, (room - downs * d) / ups);
    // A column longer than even that has to give everywhere; nothing else is left to take.
    if (total() > room) {
      const k = room / total();
      d *= k;
      u *= k;
    }
  }
  return down.map((isDown) => (isDown ? d : u));
}

/** One column as the check sees it: every card in order from the top, and which way up it is. */
export interface FanColumn {
  readonly cards: readonly { readonly y: number; readonly up: boolean }[];
}

/**
 * Asks a fan whether it is readable. Only covered face-up cards are in question: the bottom card
 * of a column is whole, and a face-down card has nothing to show. A column too long to show every
 * index is not a fault, so the check only holds a column to it when the room was there.
 *
 * `checked` is reported so a test can tell a real pass from one that looked at nothing.
 */
export function fanReport(columns: readonly FanColumn[], index: number, room: number): { checked: number; tight: number; worst: number } {
  let checked = 0;
  let tight = 0;
  let worst = Infinity;
  for (const column of columns) {
    const covered = column.cards.slice(0, -1);
    const downs = covered.filter((c) => !c.up).length;
    const ups = covered.length - downs;
    // Could this column have shown every index? If not, it is doing its best already.
    if (downs * DOWN_MIN + ups * index > room) continue;
    covered.forEach((card, i) => {
      if (!card.up) return;
      const step = column.cards[i + 1]!.y - card.y;
      checked++;
      worst = Math.min(worst, step);
      // A hair of slack: these are floats coming back out of a squeeze.
      if (step < index - 0.5) tight++;
    });
  }
  return { checked, tight, worst: worst === Infinity ? 0 : Math.round(worst * 10) / 10 };
}
