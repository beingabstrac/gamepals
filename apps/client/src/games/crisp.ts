import type { GameObjects, Scene } from 'phaser';

/**
 * Canvas pixels per logical pixel. Games render at the screen's real density
 * (canvas = logical size × DPR, camera zoom = DPR) so shapes and text stay sharp on retina screens.
 */
export const DPR = typeof window === 'undefined' ? 1 : Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);

/** Call first in every scene's create(): lets the scene keep drawing in logical coordinates. */
export function fitCamera(scene: Scene, width: number, height: number): void {
  scene.cameras.main.setZoom(DPR).centerOn(width / 2, height / 2);
}

/** Text is drawn to its own texture; render it at the same density as the camera so it isn't blurry. */
export function sharpText(scene: Scene, x: number, y: number, text: string, size: number, color: string): GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: 'Fredoka, system-ui, sans-serif', fontSize: `${size}px`, fontStyle: '600', color })
    .setResolution(DPR)
    .setOrigin(0.5);
}
