import type { GameObjects, Scene } from 'phaser';
import { COLORS, toHex } from '../theme';

/**
 * Keyboard play for desktops, Macs, Chromebooks and tablets with keyboards (docs/13).
 * Handled keys don't scroll the page; the handler returns true when it used the key.
 */
export function onKeys(scene: Scene, handler: (key: string) => boolean): void {
  scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (handler(event.key)) event.preventDefault();
  });
}

/** Arrow keys as a step: [dx, dy], or null for any other key. */
export function arrow(key: string): [number, number] | null {
  return ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[key] ?? null;
}

export const isPress = (key: string) => key === 'Enter' || key === ' ';

/**
 * A ring showing where the keyboard points. Hidden until a key moves it; a tap or click hides it again,
 * so touch players never see it.
 */
export function focusRing(scene: Scene, width: number, height: number, radius = 18): GameObjects.Graphics {
  const ring = scene.add.graphics().setDepth(50).setVisible(false);
  ring.lineStyle(7, toHex(COLORS.grape), 1);
  ring.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  scene.input.on('pointerdown', () => ring.setVisible(false));
  return ring;
}

/** Moves a focus ring with a small spring, showing it if it was hidden. */
export function moveRing(scene: Scene, ring: GameObjects.Graphics, x: number, y: number): void {
  const wasHidden = !ring.visible;
  ring.setVisible(true);
  scene.tweens.killTweensOf(ring);
  if (wasHidden) {
    ring.setPosition(x, y).setScale(1.15);
    scene.tweens.add({ targets: ring, scale: 1, duration: 180, ease: 'Back.easeOut' });
  } else {
    scene.tweens.add({ targets: ring, x, y, duration: 110, ease: 'Quad.easeOut' });
  }
}
