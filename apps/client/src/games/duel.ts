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

export type DuelAction = 'tap' | 'left' | 'right' | 'up' | 'down';

/** Bottom player: Space or Enter and the arrows. Top player: Shift and WASD. */
const DUEL_KEYS: Record<string, [Seat, DuelAction]> = {
  ' ': [0, 'tap'],
  Enter: [0, 'tap'],
  ArrowLeft: [0, 'left'],
  ArrowRight: [0, 'right'],
  ArrowUp: [0, 'up'],
  ArrowDown: [0, 'down'],
  Shift: [1, 'tap'],
  a: [1, 'left'],
  d: [1, 'right'],
  w: [1, 'up'],
  s: [1, 'down'],
};

/**
 * Keyboard for duels on one device (docs/13): two people can share one keyboard. Against a bot, both
 * key sets control the one person playing. Held keys don't repeat, so mashing games need real presses.
 */
export function onDuelKeys(scene: Scene, seats: readonly SeatController[], handler: (seat: Seat, action: DuelAction) => void): void {
  scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const mapped = seatAction(seats, normalize(event.key));
    if (!mapped) return;
    event.preventDefault();
    handler(mapped[0], mapped[1]);
  });
}

const normalize = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

/** Which seat a key belongs to; against a bot, every key belongs to the one person playing. */
function seatAction(seats: readonly SeatController[], key: string): [Seat, DuelAction] | null {
  const mapped = DUEL_KEYS[key];
  if (!mapped) return null;
  const [seat, action] = mapped;
  if (isPerson(seats, seat)) return [seat, action];
  const people = seats.flatMap((s, i) => (s.kind === 'human' ? [i] : []));
  return people.length === 1 ? [people[0]!, action] : null;
}

/**
 * Held direction keys per seat, x and y from -1 to 1, for games you steer (Air Hockey, Sumo, Ping Pong,
 * Penalty Kicks). Keys are dropped when the window loses focus, so none gets stuck down.
 */
export function heldDuelKeys(scene: Scene, seats: readonly SeatController[]): (seat: Seat) => { x: number; y: number } {
  const down = new Set<string>();
  scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
    const key = normalize(event.key);
    if (DUEL_KEYS[key]) {
      down.add(key);
      event.preventDefault();
    }
  });
  scene.input.keyboard?.on('keyup', (event: KeyboardEvent) => down.delete(normalize(event.key)));
  scene.game.events.on('blur', () => down.clear());
  return (seat) => {
    let x = 0;
    let y = 0;
    for (const key of down) {
      const mapped = seatAction(seats, key);
      if (!mapped || mapped[0] !== seat) continue;
      if (mapped[1] === 'left') x -= 1;
      if (mapped[1] === 'right') x += 1;
      if (mapped[1] === 'up') y -= 1;
      if (mapped[1] === 'down') y += 1;
    }
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  };
}

/**
 * Held tap keys per seat (Space or Enter for the bottom player, Shift for the top), for one-button
 * games you hold down (Tank Duel). Dropped when the window loses focus, so none gets stuck down.
 */
export function heldTaps(scene: Scene, seats: readonly SeatController[]): (seat: Seat) => boolean {
  const down = new Set<string>();
  scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
    const key = normalize(event.key);
    if (DUEL_KEYS[key]?.[1] === 'tap') {
      down.add(key);
      event.preventDefault();
    }
  });
  scene.input.keyboard?.on('keyup', (event: KeyboardEvent) => down.delete(normalize(event.key)));
  scene.game.events.on('blur', () => down.clear());
  return (seat) => [...down].some((key) => seatAction(seats, key)?.[0] === seat);
}

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
