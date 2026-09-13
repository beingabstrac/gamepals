import type { Seat } from '@gamepals/rules';
import type { Scene } from 'phaser';
import { COLORS } from '../theme';

/** One-screen duels: seat 0 holds the bottom half of the phone, seat 1 the top half (facing the other way). */
export const DUEL_COLORS = [COLORS.sky, COLORS.tomato];

export const seatForY = (y: number, height: number): Seat => (y > height / 2 ? 0 : 1);

/** Calls `onTap` with the seat whose half was touched; each finger counts separately. */
export function onHalfTap(scene: Scene, height: number, onTap: (seat: Seat) => void): void {
  scene.input.addPointer(3);
  scene.input.on('pointerdown', (pointer: { worldY: number }) => onTap(seatForY(pointer.worldY, height)));
}

/** Draws the two halves tinted in each player's color so everyone knows where to tap. */
export function drawHalves(scene: Scene, width: number, height: number, tints: readonly [number, number]): void {
  const g = scene.add.graphics();
  g.fillStyle(tints[1], 1);
  g.fillRoundedRect(0, 0, width, height / 2 + 24, 40);
  g.fillStyle(tints[0], 1);
  g.fillRoundedRect(0, height / 2 - 24, width, height / 2 + 24, 40);
  g.fillRect(0, height / 2 - 24, width, 48);
  g.fillStyle(tints[1], 1);
  g.fillRect(0, height / 2 - 24, width, 24);
}
