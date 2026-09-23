import type { GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';

type Draw = (g: GameObjects.Graphics, r: number) => void;

const hex = (css: string) => toHex(css);
const WHITE = 0xffffff;

function poly(g: GameObjects.Graphics, points: [number, number][]): void {
  g.beginPath();
  g.moveTo(points[0]![0], points[0]![1]);
  for (const [x, y] of points.slice(1)) g.lineTo(x, y);
  g.closePath();
  g.fillPath();
}

const cherry: Draw = (g, r) => {
  g.lineStyle(r * 0.1, hex(DARK.mint), 1);
  g.lineBetween(-r * 0.36, r * 0.1, r * 0.12, -r * 0.7);
  g.lineBetween(r * 0.4, r * 0.16, r * 0.12, -r * 0.7);
  g.fillStyle(hex(COLORS.mint), 1);
  g.fillEllipse(r * 0.38, -r * 0.7, r * 0.5, r * 0.26);
  g.fillStyle(hex(COLORS.tomato), 1);
  g.fillCircle(-r * 0.38, r * 0.36, r * 0.38);
  g.fillCircle(r * 0.4, r * 0.42, r * 0.38);
  g.fillStyle(WHITE, 0.55);
  g.fillCircle(-r * 0.5, r * 0.24, r * 0.1);
  g.fillCircle(r * 0.28, r * 0.3, r * 0.1);
};

const lemon: Draw = (g, r) => {
  g.fillStyle(hex(COLORS.sunny), 1);
  g.fillEllipse(0, 0, r * 1.6, r * 1.16);
  g.fillCircle(-r * 0.8, 0, r * 0.14);
  g.fillCircle(r * 0.8, 0, r * 0.14);
  g.fillStyle(WHITE, 0.5);
  g.fillEllipse(-r * 0.26, -r * 0.22, r * 0.5, r * 0.2);
};

const leaf: Draw = (g, r) => {
  g.fillStyle(hex(COLORS.mint), 1);
  poly(g, [
    [0, -r * 0.9],
    [r * 0.55, -r * 0.35],
    [r * 0.5, r * 0.3],
    [0, r * 0.8],
    [-r * 0.5, r * 0.3],
    [-r * 0.55, -r * 0.35],
  ]);
  g.lineStyle(r * 0.09, hex(DARK.mint), 1);
  g.lineBetween(0, -r * 0.6, 0, r * 0.95);
  g.lineBetween(0, -r * 0.1, r * 0.3, -r * 0.35);
  g.lineBetween(0, r * 0.25, -r * 0.3, 0);
};

const drop: Draw = (g, r) => {
  g.fillStyle(hex(COLORS.sky), 1);
  g.fillCircle(0, r * 0.25, r * 0.56);
  poly(g, [
    [0, -r * 0.9],
    [r * 0.5, r * 0.02],
    [-r * 0.5, r * 0.02],
  ]);
  g.fillStyle(WHITE, 0.6);
  g.fillCircle(-r * 0.2, r * 0.2, r * 0.12);
};

const grapes: Draw = (g, r) => {
  g.lineStyle(r * 0.1, hex(DARK.mint), 1);
  g.lineBetween(0, -r * 0.55, r * 0.12, -r * 0.88);
  g.fillStyle(hex(COLORS.grape), 1);
  const b = r * 0.24;
  for (const [x, y] of [
    [-0.46, -0.3],
    [0, -0.3],
    [0.46, -0.3],
    [-0.23, 0.12],
    [0.23, 0.12],
    [0, 0.54],
  ] as const)
    g.fillCircle(x * r, y * r, b);
  g.fillStyle(WHITE, 0.45);
  g.fillCircle(-r * 0.52, -r * 0.38, r * 0.07);
};

const donut: Draw = (g, r) => {
  g.lineStyle(r * 0.42, hex(COLORS.bubblegum), 1);
  g.strokeCircle(0, 0, r * 0.56);
  g.fillStyle(WHITE, 1);
  for (const [x, y, w] of [
    [-0.5, -0.36, 1],
    [0.3, -0.58, 0],
    [0.6, 0.12, 1],
    [-0.1, 0.62, 0],
    [-0.62, 0.22, 0],
  ] as const) {
    if (w) g.fillRect(x * r, y * r, r * 0.18, r * 0.07);
    else g.fillRect(x * r, y * r, r * 0.07, r * 0.18);
  }
};

const carrot: Draw = (g, r) => {
  g.fillStyle(hex(COLORS.mint), 1);
  g.fillEllipse(-r * 0.2, -r * 0.62, r * 0.24, r * 0.52);
  g.fillEllipse(r * 0.2, -r * 0.62, r * 0.24, r * 0.52);
  g.fillStyle(hex(COLORS.peach), 1);
  poly(g, [
    [-r * 0.42, -r * 0.4],
    [r * 0.42, -r * 0.4],
    [0, r * 0.92],
  ]);
  g.lineStyle(r * 0.07, hex(DARK.peach), 1);
  g.lineBetween(-r * 0.2, -r * 0.05, r * 0.02, -r * 0.05);
  g.lineBetween(r * 0.02, r * 0.3, r * 0.16, r * 0.3);
};

const star: Draw = (g, r) => {
  g.fillStyle(hex(COLORS.sunny), 1);
  poly(
    g,
    Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const d = i % 2 ? r * 0.4 : r * 0.92;
      return [Math.cos(a) * d, Math.sin(a) * d + r * 0.05] as [number, number];
    }),
  );
  g.fillStyle(hex(DARK.sunny), 1);
  g.fillCircle(-r * 0.16, 0, r * 0.07);
  g.fillCircle(r * 0.16, 0, r * 0.07);
};

const heart: Draw = (g, r) => {
  g.fillStyle(hex(COLORS.tomato), 1);
  g.fillCircle(-r * 0.36, -r * 0.18, r * 0.42);
  g.fillCircle(r * 0.36, -r * 0.18, r * 0.42);
  poly(g, [
    [-r * 0.76, -r * 0.04],
    [r * 0.76, -r * 0.04],
    [0, r * 0.84],
  ]);
  g.fillStyle(WHITE, 0.55);
  g.fillCircle(-r * 0.44, -r * 0.3, r * 0.1);
};

const moon: Draw = (g, r) => {
  g.fillStyle(hex(COLORS.grape), 1);
  g.fillCircle(0, 0, r * 0.78);
  // The bite is drawn in the tile's own colour, so the crescent reads on any tile.
  g.fillStyle(0xfffdf8, 1);
  g.fillCircle(r * 0.36, -r * 0.24, r * 0.6);
};

/**
 * The ten Tile Match pictures, drawn by us: cherry, lemon, leaf, drop, grapes, donut, carrot, star,
 * heart, moon. Easy uses the first six, which are six different colours as well as six shapes; the
 * later four share colours with earlier ones, so each is a shape nothing else has.
 */
const DRAW: readonly Draw[] = [cherry, lemon, leaf, drop, grapes, donut, carrot, star, heart, moon];

/** Draws picture `symbol` centred on the graphics' origin, about `r` from middle to edge. */
export function drawPicture(g: GameObjects.Graphics, symbol: number, r: number): void {
  DRAW[symbol % DRAW.length]!(g, r);
}
