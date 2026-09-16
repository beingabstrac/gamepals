import { chooseBotMove, type BotRequest } from '@gamepals/rules';

/**
 * Bots think here, off the main thread, so the board never freezes while a deep search runs.
 * The request carries only the move log, so this worker replays the game and picks a move with
 * the same pure rules the screen uses. See bot/runner.ts for the main-thread side.
 */
const ctx = globalThis as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<{ id: number; request: BotRequest }>) => void): void;
};

ctx.addEventListener('message', (event) => {
  const { id, request } = event.data;
  try {
    ctx.postMessage({ id, move: chooseBotMove(request) });
  } catch (error) {
    ctx.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
