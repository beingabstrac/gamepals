import { isRed, rankOf, suitOf, SUIT_SYMBOLS } from '@gamepals/rules';
import type { GameObjects, Scene } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import { sharpText } from '../crisp';

/** One card face, shared by Solitaire, FreeCell and Spider so the card games look like one family. */
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export interface CardView {
  readonly box: GameObjects.Container;
  readonly front: GameObjects.Container;
  readonly back: GameObjects.Graphics;
  up: boolean;
}

/** A card drawn at the given size: white face, mint patterned back, a soft shadow under both. */
export function makeCard(scene: Scene, card: number, cw: number, ch: number): CardView {
  const scale = cw / 88;
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x2b2a3a, 0.14);
  shadow.fillRoundedRect(-cw / 2, -ch / 2 + 4, cw, ch, 12);

  const back = scene.add.graphics();
  back.fillStyle(toHex(DARK.mint), 1);
  back.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 12);
  back.lineStyle(3, 0xffffff, 0.9);
  back.strokeRoundedRect(-cw / 2 + 7, -ch / 2 + 7, cw - 14, ch - 14, 8);
  back.fillStyle(0xffffff, 0.35);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 3; col++) back.fillCircle((-20 + col * 20) * scale, (-36 + row * 24) * scale, 4 * scale);

  const color = isRed(card) ? COLORS.tomato : COLORS.ink;
  const rank = rankOf(card);
  const suit = SUIT_SYMBOLS[suitOf(card)]!;
  const face = scene.add.graphics();
  face.fillStyle(0xffffff, 1);
  face.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 12);
  face.lineStyle(2, 0xdcd6ee, 1);
  face.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 12);
  const parts: GameObjects.GameObject[] = [
    face,
    sharpText(scene, -cw / 2 + 17 * scale, -ch / 2 + 19 * scale, RANKS[rank - 1]!, (rank === 10 ? 22 : 27) * scale, color).setFontStyle('bold'),
    sharpText(scene, -cw / 2 + 17 * scale, -ch / 2 + 43 * scale, suit, 20 * scale, color),
  ];
  if (rank > 10) {
    // Picture cards: the letter in a bubble of the suit's color.
    const bubble = scene.add.graphics();
    bubble.fillStyle(toHex(color), 0.14);
    bubble.fillCircle(6 * scale, 16 * scale, 28 * scale);
    parts.push(bubble, sharpText(scene, 6 * scale, 16 * scale, RANKS[rank - 1]!, 38 * scale, color).setFontStyle('bold'));
  } else {
    parts.push(sharpText(scene, 6 * scale, 18 * scale, suit, 54 * scale, color));
  }
  const front = scene.add.container(0, 0, parts);
  const box = scene.add.container(0, 0, [shadow, back, front]);
  front.setVisible(false);
  return { box, front, back, up: false };
}

export function setFace(view: CardView, up: boolean): void {
  view.up = up;
  view.front.setVisible(up);
  view.back.setVisible(!up);
}

/** An empty place on the table: where a card may go. */
export function drawSlot(g: GameObjects.Graphics, x: number, y: number, cw: number, ch: number, color: number): void {
  g.lineStyle(3, color, 1);
  g.strokeRoundedRect(x - cw / 2, y - ch / 2, cw, ch, 12);
}

/** Small repeatable wobble per card, so win cascades look lively without randomness. */
export const jitter = (n: number): number => ((Math.imul(n + 1, 0x9e3779b1) >>> 0) % 1000) / 1000;
