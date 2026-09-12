import type { GameResult } from '@gamepals/rules';
import { AUTO, Game, Scale } from 'phaser';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { cue } from '../feedback';
import type { GameEntry } from '../games/registry';
import { Session, type SeatController } from '../session';
import { ResultSheet, type Outcome } from './ResultSheet';

interface Props {
  entry: GameEntry;
  seats: readonly SeatController[];
  onExit(): void;
}

const newSeed = () => Math.floor(Math.random() * 0xffffffff);

/** A win against a bot is "yours"; a same-device win is always celebrated. */
function outcomeOf(result: GameResult, seats: readonly SeatController[]): Outcome {
  if (result.draw) return 'draw';
  const vsBot = seats.some((seat) => seat.kind === 'bot');
  if (!vsBot) return 'win';
  return seats[result.winners[0] ?? 0]?.kind === 'human' ? 'win' : 'lose';
}

export function GameScreen({ entry, seats: initialSeats, onExit }: Props) {
  const [seats, setSeats] = useState(initialSeats);
  const [seed, setSeed] = useState(newSeed);
  const [, setTick] = useState(0);
  const host = useRef<HTMLDivElement>(null);

  const session = useMemo(() => new Session(entry.definition, seats, seed), [entry, seats, seed]);

  useEffect(() => {
    let mover = session.state.currentSeat;
    const unsubscribe = session.subscribe(() => {
      setTick((t) => t + 1);
      const { result, currentSeat } = session.state;
      if (result) cue(outcomeOf(result, seats));
      else cue(seats[mover]?.kind === 'bot' ? 'botPlace' : 'place');
      mover = currentSeat;
    });
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
  }, [session, entry, seats]);

  const { state } = session;
  const sideName = (seat: number) => `${seats[seat]?.label} (${entry.seatNames[seat] ?? seat + 1})`;
  const [from, to] = entry.colors;

  let title = '';
  if (state.result) {
    const outcome = outcomeOf(state.result, seats);
    const winner = state.result.winners[0] ?? 0;
    if (outcome === 'draw') title = "It's a draw 🤝";
    else if (outcome === 'lose') title = `${seats[winner]?.label} wins. Rematch?`;
    else if (seats.some((s) => s.kind === 'bot')) title = 'You win! 🎉';
    else title = `${sideName(winner)} wins! 🎉`;
  }

  const thinking = seats[state.currentSeat]?.kind === 'bot';
  const turnColor = state.currentSeat === 0 ? 'var(--p1)' : 'var(--p2)';

  const rematch = () => {
    // Swap sides so whoever went second goes first next time.
    setSeats([...seats].reverse());
    setSeed(newSeed());
  };

  return (
    <div class="screen game-screen" style={{ '--game-from': from, '--game-to': to }}>
      <header class="topbar">
        <button class="ghost" onClick={onExit}>
          ← Back
        </button>
        <h1>{entry.definition.name}</h1>
        <span />
      </header>
      {!state.result && (
        <p class="status" aria-live="polite">
          <span class="turn-dot" style={{ background: turnColor }} />
          {sideName(state.currentSeat)} {thinking ? 'is thinking…' : 'to move'}
        </p>
      )}
      <div class="board" ref={host} style={{ aspectRatio: `${entry.size.width} / ${entry.size.height}` }} />
      {state.result && (
        <ResultSheet title={title} outcome={outcomeOf(state.result, seats)} onRematch={rematch} onChangeMode={onExit} />
      )}
    </div>
  );
}
