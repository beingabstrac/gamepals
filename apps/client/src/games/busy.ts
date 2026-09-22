import type { Game, Scene } from 'phaser';

/** A scene that can say whether it has finished showing the move that just happened. */
export interface BusyScene extends Scene {
  busy?(): boolean;
}

/**
 * Is the board still showing the last move?
 *
 * A scene that animates with tweens answers this for free, because a running tween is exactly
 * "something is still moving". A scene that moves things itself in `update()` has to say so:
 * Four in a Row drops its disc under gravity and never tweens at all, so to the tween list it
 * looks perfectly still while a disc is halfway down a column. Every real-time game is in the
 * same position.
 *
 * Two things ask: the result sheet, which should not say how a game ended while the move that
 * ended it is still in the air, and the gallery, whose pictures become the store screenshots.
 */
export function sceneBusy(game: Game | null | undefined): boolean {
  const scene = game?.scene.scenes[0] as BusyScene | undefined;
  if (!scene) return false;
  if (typeof scene.busy === 'function') return scene.busy();
  return scene.tweens ? scene.tweens.getTweens().length > 0 : false;
}
