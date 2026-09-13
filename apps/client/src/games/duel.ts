import type { Seat } from '@gamepals/rules';
import type { Scene } from 'phaser';
import type { SeatController } from '../session';
import { COLORS } from '../theme';

/**
 * Which way text about `seat` should face, in degrees.
 * Two people: the top player's text is flipped toward them. One person (vs a bot): everything
 * faces that person, because nobody sits on the bot's side.
 */
export function facing(seats: readonly SeatController[], seat: Seat): number {
  const people = seats.flatMap((s, i) => (s.kind === 'human' ? [i] : []));
  if (people.length === 1) return people[0] === 1 ? 180 : 0;
  if (people.length === 0) return 0;
  return seat === 1 ? 180 : 0;
}

/** Controls and hints are only shown for seats a person is playing. */
export const isPerson = (seats: readonly SeatController[], seat: Seat): boolean => seats[seat]?.kind === 'human';

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
