import { AUTO, Game, Scale } from 'phaser';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AUTOPLAY, AUTOPLAY_BOT_DELAY_MS } from '../autoplay';
import { cue } from '../feedback';
import { DPR } from '../games/crisp';
import type { GameEntry } from '../games/registry';
import { outcomeOf, resultTitle } from '../outcome';
import { Session, type SeatController } from '../session';
import { BackIcon } from './Art';
import { ResultSheet } from './ResultSheet';

interface Props {
  entry: GameEntry;
  seats: readonly SeatController[];
  /** Game option picked at the table, such as a puzzle level. */
  variant?: string;
  onExit(): void;
}

const newSeed = () => Math.floor(Math.random() * 0xffffffff);

export function GameScreen({ entry, seats: initialSeats, variant, onExit }: Props) {
  const [seats, setSeats] = useState(initialSeats);
  const [seed, setSeed] = useState(newSeed);
  const [, setTick] = useState(0);
  const host = useRef<HTMLDivElement>(null);

  const session = useMemo(
    () => new Session(entry.definition, seats, seed, AUTOPLAY ? AUTOPLAY_BOT_DELAY_MS : entry.botDelayMs, variant),
    [entry, seats, seed, variant],
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
      // Rendered at the screen's pixel density; scenes zoom their camera to match (games/crisp.ts).
      width: entry.size.width * DPR,
      height: entry.size.height * DPR,
      transparent: true,
      antialias: true,
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
  const Controls = entry.Controls;
  const thinking = session.thinkingSeat !== null || seats[state.currentSeat]?.kind === 'bot';
  const custom = entry.status?.(state);

  const rematch = () => {
    // Rotate seats so a different side starts each game.
    setSeats([...seats.slice(1), seats[0]!]);
    setSeed(newSeed());
  };

  return (
    <div class="screen game-screen" style={{ '--game': entry.color }}>
      <header class="topbar">
        <button class="round-btn" onClick={onExit} aria-label="Back to the table">
          <BackIcon />
        </button>
        <h1>{entry.definition.name}</h1>
        <span />
      </header>
      <p class="status" aria-live="polite">
        {!state.result && (
          <span class={thinking ? 'turn-pill thinking' : 'turn-pill'} key={custom}>
            <span class="turn-dot" style={{ background: sideColors[state.currentSeat] ?? '#9B7BFF' }} />
            {custom ?? `${sideName(state.currentSeat)} ${thinking ? 'is thinking…' : 'to move'}`}
          </span>
        )}
      </p>
      {/* A fresh container per game: Phaser destroys the old game on its next frame, and on some
          devices (iPad) that frame comes late, so reusing the container briefly showed two boards. */}
      <div class="board" key={seed} ref={host} style={{ aspectRatio: `${entry.size.width} / ${entry.size.height}` }} />
      {Controls && <Controls session={session} />}
      {state.result && (
        <ResultSheet
          title={entry.resultText?.(state) ?? resultTitle(state.result, seats, sideName)}
          outcome={outcomeOf(state.result, seats)}
          onRematch={rematch}
          onChangeMode={onExit}
        />
      )}
    </div>
  );
}
