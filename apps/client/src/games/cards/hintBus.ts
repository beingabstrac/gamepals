import type { Session } from '../../session';

/** Lets the controls under the table ask the scene to point at a hinted card. */
export class HintBus<M> {
  private readonly listeners = new Set<(move: M) => void>();

  onHint(listener: (move: M) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  hint(move: M): void {
    this.listeners.forEach((listener) => listener(move));
  }
}

const buses = new WeakMap<object, HintBus<unknown>>();

/** One bus per session, so the controls and the scene find the same one. */
export function hintBusFor<M>(session: Session<M>): HintBus<M> {
  let bus = buses.get(session);
  if (!bus) {
    bus = new HintBus<unknown>();
    buses.set(session, bus);
  }
  return bus as HintBus<M>;
}
