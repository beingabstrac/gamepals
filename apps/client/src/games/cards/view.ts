import { isRed, rankOf, suitOf, SUIT_SYMBOLS } from '@gamepals/rules';
import type { GameObjects, Scene } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import { sharpText } from '../crisp';
import { ROOM } from '../../look';

/** One card face, shared by Solitaire, FreeCell and Spider so the card games look like one family. */
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export interface CardView {
  readonly box: GameObjects.Container;
  readonly front: GameObjects.Container;
  readonly back: GameObjects.Graphics;
  up: boolean;
  /** Where this card is sliding to, and whether it is still on its way. */
  tx?: number;
  ty?: number;
  sliding?: boolean;
  /** The face this card is turning to, so a second look does not start the turn again. */
  flipTarget?: boolean;
}

/**
 * Slides a card to a place, and leaves a slide to that same place alone. Without this a run of
 * quick moves (a bot in test mode, or the Finish button) kills each slide before the next frame
 * draws it, and the cards never leave the deck.
 */
export function slideTo(scene: Scene, view: CardView, x: number, y: number, depth: number, opts: { duration: number; delay?: number; ease?: string }): void {
  if (view.sliding && view.tx === x && view.ty === y) return;
  scene.tweens.killTweensOf(view.box);
  view.tx = x;
  view.ty = y;
  view.sliding = true;
  view.box.setDepth(1000 + depth);
  scene.tweens.add({
    targets: view.box,
    x,
    y,
    duration: opts.duration,
    delay: opts.delay ?? 0,
    ease: opts.ease ?? 'Cubic.easeOut',
    onComplete: () => {
      view.sliding = false;
      view.box.setDepth(depth);
    },
  });
}

/** Takes hold of a card: any slide stops, so a finger or a win cascade has it to itself. */
export function stopSlide(scene: Scene, view: CardView): void {
  scene.tweens.killTweensOf(view.box);
  view.sliding = false;
}

/** Puts a card down where it belongs, with no slide. */
export function placeAt(view: CardView, x: number, y: number, depth: number): void {
  view.sliding = false;
  view.tx = x;
  view.ty = y;
  view.box.setPosition(x, y).setDepth(depth);
}

/** A card drawn at the given size: white face, mint patterned back, a soft shadow under both. */
export function makeCard(scene: Scene, card: number, cw: number, ch: number): CardView {
  const scale = cw / 88;
  const shadow = scene.add.graphics();
  shadow.fillStyle(ROOM ? 0x7a4a14 : 0x2b2a3a, ROOM ? 0.26 : 0.14);
  shadow.fillRoundedRect(-cw / 2, -ch / 2 + 4, cw, ch, 12);

  const back = scene.add.graphics();
  // Green backs on green felt would be one flat shape, so the games room deals a red pack.
  back.fillStyle(ROOM ? 0xff5b4a : toHex(DARK.mint), 1);
  back.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 12);
  if (ROOM) {
    back.fillStyle(0xe03b30, 1);
    back.fillRoundedRect(-cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10, 9);
  }
  back.lineStyle(3, ROOM ? 0xffe6a8 : 0xffffff, ROOM ? 0.95 : 0.9);
  back.strokeRoundedRect(-cw / 2 + 7, -ch / 2 + 7, cw - 14, ch - 14, 8);
  back.fillStyle(ROOM ? 0xffe6a8 : 0xffffff, ROOM ? 0.5 : 0.35);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 3; col++) back.fillCircle((-20 + col * 20) * scale, (-36 + row * 24) * scale, 4 * scale);

  const color = isRed(card) ? COLORS.tomato : COLORS.ink;
  const rank = rankOf(card);
  const suit = SUIT_SYMBOLS[suitOf(card)]!;
  const face = scene.add.graphics();
  face.fillStyle(ROOM ? 0xfffdf6 : 0xffffff, 1);
  face.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 12);
  face.lineStyle(2, ROOM ? 0xf0d9a8 : 0xdcd6ee, 1);
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
  view.flipTarget = up;
  view.front.setVisible(up);
  view.back.setVisible(!up);
}

/**
 * Turns a card over: squeeze to an edge, swap the face, open back up. The swap runs on a timer
 * rather than at the end of the squeeze, because a slide starting in the same breath clears the
 * tweens on the card, and a face that only turns at the end of a tween would never turn at all.
 */
export function flipTo(scene: Scene, view: CardView, up: boolean, delay = 0): void {
  if ((view.flipTarget ?? view.up) === up) return;
  view.flipTarget = up;
  scene.tweens.add({ targets: view.box, scaleX: 0, duration: 80, delay, ease: 'Sine.easeIn' });
  scene.time.delayedCall(delay + 80, () => {
    setFace(view, up);
    view.box.setScale(1);
    scene.tweens.add({ targets: view.box, scaleX: { from: 0, to: 1 }, duration: 100, ease: 'Back.easeOut' });
  });
}

/** An empty place on the table: where a card may go. */
export function drawSlot(g: GameObjects.Graphics, x: number, y: number, cw: number, ch: number, color: number): void {
  g.lineStyle(3, color, 1);
  g.strokeRoundedRect(x - cw / 2, y - ch / 2, cw, ch, 12);
}

/** Small repeatable wobble per card, so win cascades look lively without randomness. */
export const jitter = (n: number): number => ((Math.imul(n + 1, 0x9e3779b1) >>> 0) % 1000) / 1000;
