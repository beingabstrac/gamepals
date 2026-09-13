import type { Scene } from 'phaser';

/**
 * Canvas pixels per logical pixel. Games render at the screen's real density
 * (canvas = logical size × DPR, camera zoom = DPR) so shapes and text stay sharp on retina screens.
 */
export const DPR = typeof window === 'undefined' ? 1 : Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);

/** Call first in every scene's create(): lets the scene keep drawing in logical coordinates. */
export function fitCamera(scene: Scene, width: number, height: number): void {
  scene.cameras.main.setZoom(DPR).centerOn(width / 2, height / 2);
}
