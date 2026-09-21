import type { GameObjects, Geom } from 'phaser';

/**
 * Where a seat's name sits, checked against the table it sits on. The seat labels in the
 * trick-taking games ran off both edges of the table and sat on top of the face-down piles for
 * two milestones, and every test passed the whole time, because nothing overflowed the page and
 * no card was missing. Scenes answer `labelCheck()` in test mode and `e2e/labels.spec.ts` reads it.
 */
export interface LabelReport {
  /** Labels that run off the table. */
  readonly outside: readonly string[];
  /** Labels sitting on top of a card. */
  readonly over: readonly string[];
  /**
   * Labels running into each other. Go Fish read "Nova: 4 · 3 books Pip: 5 · 2 books" with no gap
   * between them, because four labels were spread evenly across a table narrower than their own
   * text. On the table and clear of the cards, and still unreadable.
   */
  readonly touching: readonly string[];
}

export interface CardBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function labelReport(
  texts: readonly GameObjects.Text[],
  cards: Iterable<CardBox>,
  width: number,
  height: number,
): LabelReport {
  const boxes = [...cards];
  const outside: string[] = [];
  const over: string[] = [];
  const touching: string[] = [];
  const seen: { text: string; box: Geom.Rectangle }[] = [];
  for (const text of texts) {
    if (!text.text) continue;
    const box = text.getBounds();
    if (box.left < 0 || box.right > width || box.top < 0 || box.bottom > height) {
      outside.push(`${text.text} at ${Math.round(box.left)}..${Math.round(box.right)} of ${width}`);
    }
    const hit = boxes.find(
      (card) =>
        box.right > card.x - card.w / 2 &&
        box.left < card.x + card.w / 2 &&
        box.bottom > card.y - card.h / 2 &&
        box.top < card.y + card.h / 2,
    );
    if (hit) over.push(`${text.text} over the card at ${Math.round(hit.x)},${Math.round(hit.y)}`);
    // Two labels with no daylight between them read as one long word.
    const near = seen.find(
      (other) => box.right > other.box.left - 4 && box.left < other.box.right + 4 && box.bottom > other.box.top && box.top < other.box.bottom,
    );
    if (near) touching.push(`${text.text} touches ${near.text}`);
    seen.push({ text: text.text, box });
  }
  return { outside, over, touching };
}
