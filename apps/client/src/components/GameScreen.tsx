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

/** A win against bots is "yours" only if a person won; a people-only game is always celebrated. */
function outcomeOf(result: GameResult, seats: readonly SeatController[]): Outcome {
  if (result.draw) return 'draw';
  const vsBot = seats.some((seat) => seat.kind === 'bot');
  const humans = seats.filter((seat) => seat.kind === 'human').length;
  if (!vsBot || humans === 0) return 'win';
  return seats[result.winners[0] ?? 0]?.kind === 'human' ? 'win' : 'lose';
}

export function GameScreen({ entry, seats: initialSeats, onExit }: Props) {
  const [seats, setSeats] = useState(initialSeats);
  const [seed, setSeed] = useState(newSeed);
  const [, setTick] = useState(0);
  const host = useRef<HTMLDivElement>(null);

  const session = useMemo(
    () => new Session(entry.definition, seats, seed, entry.botDelayMs),
    [entry, seats, seed],
  );

  useEffect(() => {
    let before = session.state;
    const unsubscribe = session.subscribe(() => {
      setTick((t) => t + 1);
      const after = session.state;
      if (after.result) cue(outcomeOf(after.result, seats));
      else cue(entry.moveCue?.(before, after) ?? (seats[before.currentSeat]?.kind === 'bot' ? 'botPlace' : 'place'));
      before = after;
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
  const names = entry.sideNames(seats.length);
  const sideColors = entry.sideColors(seats.length);
  const sideName = (seat: number) => `${seats[seat]?.label} (${names[seat] ?? seat + 1})`;
  const [from, to] = entry.colors;
  const Controls = entry.Controls;

  let title = '';
  if (state.result) {
    const outcome = outcomeOf(state.result, seats);
    const winner = state.result.winners[0] ?? 0;
    const humans = seats.filter((s) => s.kind === 'human').length;
    if (outcome === 'draw') title = "It's a draw 🤝";
    else if (outcome === 'lose') title = `${sideName(winner)} wins. Rematch?`;
    else if (humans === 1 && seats[winner]?.kind === 'human') title = 'You win! 🎉';
    else title = `${sideName(winner)} wins! 🎉`;
  }

  const thinking = seats[state.currentSeat]?.kind === 'bot';

  const rematch = () => {
    // Rotate seats so a different side starts each game.
    setSeats([...seats.slice(1), seats[0]!]);
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
          <span class="turn-dot" style={{ background: sideColors[state.currentSeat] ?? '#fff' }} />
          {sideName(state.currentSeat)} {thinking ? 'is thinking…' : 'to move'}
        </p>
      )}
      <div class="board" ref={host} style={{ aspectRatio: `${entry.size.width} / ${entry.size.height}` }} />
      {Controls && <Controls session={session} />}
      {state.result && (
        <ResultSheet title={title} outcome={outcomeOf(state.result, seats)} onRematch={rematch} onChangeMode={onExit} />
      )}
    </div>
  );
}
