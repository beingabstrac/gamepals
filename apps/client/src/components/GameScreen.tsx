import { AUTO, Game, Scale } from 'phaser';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { GameEntry } from '../games/registry';
import { Session, type SeatController } from '../session';

interface Props {
  entry: GameEntry;
  seats: readonly SeatController[];
  onExit(): void;
}

const newSeed = () => Math.floor(Math.random() * 0xffffffff);

export function GameScreen({ entry, seats: initialSeats, onExit }: Props) {
  const [seats, setSeats] = useState(initialSeats);
  const [seed, setSeed] = useState(newSeed);
  const [, setTick] = useState(0);
  const host = useRef<HTMLDivElement>(null);

  const session = useMemo(() => new Session(entry.definition, seats, seed), [entry, seats, seed]);

  useEffect(() => {
    const unsubscribe = session.subscribe(() => setTick((t) => t + 1));
    const game = new Game({
      type: AUTO,
      parent: host.current!,
      width: entry.size.width,
      height: entry.size.height,
      transparent: true,
      scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
      scene: [entry.createScene(session)],
    });
    return () => {
      unsubscribe();
      session.dispose();
      game.destroy(true);
    };
  }, [session, entry]);

  const { state } = session;
  const sideName = (seat: number) => `${seats[seat]?.label} (${entry.seatNames[seat] ?? seat + 1})`;

  let status: string;
  if (state.result) {
    status = state.result.draw ? "It's a draw!" : `${sideName(state.result.winners[0] ?? 0)} wins!`;
  } else {
    const thinking = seats[state.currentSeat]?.kind === 'bot';
    status = `${sideName(state.currentSeat)} ${thinking ? 'is thinking…' : 'to move'}`;
  }

  const rematch = () => {
    // Swap sides so whoever went second goes first next time.
    setSeats([...seats].reverse());
    setSeed(newSeed());
  };

  return (
    <div class="screen game-screen">
      <header class="topbar">
        <button class="ghost" onClick={onExit}>
          ← Back
        </button>
        <h1>{entry.definition.name}</h1>
        <span />
      </header>
      <p class="status" aria-live="polite">
        {status}
      </p>
      <div class="board" ref={host} style={{ aspectRatio: `${entry.size.width} / ${entry.size.height}` }} />
      <div class="actions">
        {state.result && (
          <button class="primary" onClick={rematch}>
            Rematch (swap sides)
          </button>
        )}
      </div>
    </div>
  );
}
