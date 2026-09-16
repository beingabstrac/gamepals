import { chooseBotMove, type BotRequest } from '@gamepals/rules';

/**
 * Asks the bot worker for a move, and works out the move here if the worker can't run
 * (older WebViews, a blocked worker, or a request that takes too long).
 */
const THINK_LIMIT_MS = 8000;

type Waiting = { readonly request: BotRequest; readonly resolve: (move: string) => void; readonly timer: ReturnType<typeof setTimeout> };

let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, Waiting>();

function settle(id: number, move: string): void {
  const entry = waiting.get(id);
  if (!entry) return;
  waiting.delete(id);
  clearTimeout(entry.timer);
  entry.resolve(move);
}

/** Gives up on the worker and finishes every pending request on the main thread. */
function dropWorker(): void {
  worker?.terminate();
  worker = null;
  for (const [id, entry] of [...waiting]) settle(id, chooseBotMove(entry.request));
}

function ensureWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const created = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    created.addEventListener('message', (event: MessageEvent<{ id: number; move?: string; error?: string }>) => {
      const { id, move, error } = event.data;
      const entry = waiting.get(id);
      if (!entry) return;
      if (move !== undefined) settle(id, move);
      else {
        console.warn(`Bot worker failed (${error}); thinking on the main thread instead`);
        settle(id, chooseBotMove(entry.request));
      }
    });
    created.addEventListener('error', () => dropWorker());
    worker = created;
  } catch {
    worker = null;
  }
  return worker;
}

export function requestBotMove(request: BotRequest): Promise<string> {
  const active = ensureWorker();
  if (!active) return Promise.resolve(chooseBotMove(request));
  return new Promise<string>((resolve) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      waiting.delete(id);
      resolve(chooseBotMove(request));
    }, THINK_LIMIT_MS);
    waiting.set(id, { request, resolve, timer });
    active.postMessage({ id, request });
  });
}
