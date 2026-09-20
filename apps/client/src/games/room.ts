import type { GameObjects } from 'phaser';
import { ROOM_COLORS } from '../look';

/**
 * The frame every board in the playroom sits in: sunlit baize underneath, a maple frame lit from
 * the top, and a gold rail around the playing area. Bright, not dark: the depth comes from the
 * gradient and the highlight, not from the colour being gloomy.
 * `pad` is the space between the edge of the scene and the playing area, which becomes the frame.
 */
export function roomTable(g: GameObjects.Graphics, width: number, height: number, pad: number): void {
  // Wood runs to the edge of the board: the page behind it is the ground now, so a ring of felt
  // around the frame just read as a stray green outline.
  const inset = Math.max(4, pad * 0.25);
  g.fillStyle(ROOM_COLORS.woodDark, 1);
  g.fillRoundedRect(0, 0, width, height, 20);
  g.fillGradientStyle(ROOM_COLORS.woodLight, ROOM_COLORS.woodLight, ROOM_COLORS.wood, ROOM_COLORS.wood, 1);
  g.fillRoundedRect(0, 0, width, height - 4, 20);
  // A waxed edge catches the light along the top.
  g.fillStyle(0xffffff, 0.35);
  g.fillRoundedRect(inset, inset, width - inset * 2, 14, 8);
  g.fillStyle(ROOM_COLORS.wood, 1);
  g.fillRoundedRect(inset * 1.8, inset * 1.8, width - inset * 3.6, height - inset * 3.6, 12);

  const rows = Math.max(6, Math.round(height / 44));
  for (let i = 0; i < rows; i++) {
    const y = inset * 2 + i * ((height - inset * 4) / rows) + (i % 3) * 1.5;
    g.lineStyle(1.5, i % 2 ? ROOM_COLORS.woodDark : ROOM_COLORS.woodLight, 0.12);
    g.lineBetween(inset * 2, y, width - inset * 2, y + (i % 4) - 1.5);
  }

  g.lineStyle(2.5, ROOM_COLORS.brass, 0.8);
  g.strokeRoundedRect(inset * 2.2, inset * 2.2, width - inset * 4.4, height - inset * 4.4, 10);
}

/** The shadow the frame throws onto the playing area, so the board reads as sunk into it. */
export function roomInset(g: GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
  g.fillStyle(0x7a4a14, 0.14);
  g.fillRect(x, y, width, 9);
  g.fillStyle(0x7a4a14, 0.09);
  g.fillRect(x, y, 9, height);
  g.lineStyle(2, ROOM_COLORS.brassDark, 0.9);
  g.strokeRect(x - 1, y - 1, width + 2, height + 2);
}
