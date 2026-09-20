import type { GameObjects } from 'phaser';
import { ROOM_COLORS } from '../look';

/**
 * The furniture every board in the games room sits in: felt underneath, a walnut frame with grain
 * running through it, and a brass rail around the playing area. Chess drew its own first; this is
 * that, shared, so a board game is dressed by one call rather than by twenty scenes each guessing.
 * `pad` is the space between the edge of the scene and the playing area, which becomes the frame.
 */
export function roomTable(g: GameObjects.Graphics, width: number, height: number, pad: number): void {
  g.fillGradientStyle(ROOM_COLORS.felt, ROOM_COLORS.felt, ROOM_COLORS.feltDark, ROOM_COLORS.feltDark, 1);
  g.fillRoundedRect(0, 0, width, height, 20);

  const inset = Math.max(4, pad * 0.25);
  g.fillGradientStyle(ROOM_COLORS.woodLight, ROOM_COLORS.woodLight, ROOM_COLORS.woodDark, ROOM_COLORS.woodDark, 1);
  g.fillRoundedRect(inset, inset, width - inset * 2, height - inset * 2, 16);
  // A waxed edge catches the light along the top.
  g.fillStyle(0xffffff, 0.1);
  g.fillRoundedRect(inset, inset, width - inset * 2, 14, 8);
  g.fillStyle(ROOM_COLORS.wood, 1);
  g.fillRoundedRect(inset * 1.8, inset * 1.8, width - inset * 3.6, height - inset * 3.6, 12);

  const rows = Math.max(6, Math.round(height / 44));
  for (let i = 0; i < rows; i++) {
    const y = inset * 2 + i * ((height - inset * 4) / rows) + (i % 3) * 1.5;
    g.lineStyle(1.5, i % 2 ? ROOM_COLORS.woodDark : ROOM_COLORS.woodLight, 0.16);
    g.lineBetween(inset * 2, y, width - inset * 2, y + (i % 4) - 1.5);
  }

  g.lineStyle(2.5, ROOM_COLORS.brass, 0.8);
  g.strokeRoundedRect(inset * 2.2, inset * 2.2, width - inset * 4.4, height - inset * 4.4, 10);
}

/** The shadow the frame throws onto the playing area, so the board reads as sunk into it. */
export function roomInset(g: GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
  g.fillStyle(0x000000, 0.16);
  g.fillRect(x, y, width, 10);
  g.fillStyle(0x000000, 0.1);
  g.fillRect(x, y, 10, height);
  g.lineStyle(2, ROOM_COLORS.brassDark, 0.9);
  g.strokeRect(x - 1, y - 1, width + 2, height + 2);
}
