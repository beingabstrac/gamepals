import type { GameResult } from '@gamepals/rules';
import { AUTO, Game, Scale } from 'phaser';
import { useEffect, useRef, useState } from 'preact/hooks';
import { cue } from '../feedback';
import type { RealtimeEntry } from '../games/registry';
import { outcomeOf, resultTitle } from '../outcome';
import type { SeatController } from '../session';
import { ResultSheet } from './ResultSheet';

interface Props {
  entry: RealtimeEntry;
  seats: readonly SeatController[];
  onExit(): void;
}

const newSeed = () => Math.floor(Math.random() * 0xffffffff);

export function RealtimeGameScreen({ entry, seats, onExit }: Props) {
  const [round, setRound] = useState(0);
  const [scores, setScores] = useState<readonly number[]>(seats.map(() => 0));
  const [result, setResult] = useState<GameResult | null>(null);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setScores(seats.map(() => 0));
    setResult(null);
    const game = new Game({
      type: AUTO,
      parent: host.current!,
      width: entry.size.width,
      height: entry.size.height,
      transparent: true,
      scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
      scene: [
        entry.createScene({
          seats,
          seed: newSeed(),
          onScore: (next) => setScores([...next]),
          onEnd: (final) => {
            setResult(final);
            cue(outcomeOf(final, seats));
          },
          onCue: cue,
        }),
      ],
    });
    return () => game.destroy(true);
  }, [round, entry, seats]);

  const names = entry.sideNames(seats.length);
  const sideColors = entry.sideColors(seats.length);
  const sideName = (seat: number) => `${seats[seat]?.label} (${names[seat] ?? seat + 1})`;
  const [from, to] = entry.colors;

  return (
    <div class="screen game-screen" style={{ '--game-from': from, '--game-to': to }}>
      <header class="topbar">
        <button class="ghost" onClick={onExit}>
          ← Back
        </button>
        <h1>{entry.definition.name}</h1>
        <span />
      </header>
      <div class="scoreboard" aria-live="polite">
        {seats.map((seat, i) => (
          <div key={i} class="score" style={{ '--side': sideColors[i] ?? '#fff' }}>
            <span class="score-name">{seat.label}</span>
            <span class="score-value">{scores[i] ?? 0}</span>
          </div>
        ))}
      </div>
      <div class="board realtime" ref={host} style={{ aspectRatio: `${entry.size.width} / ${entry.size.height}` }} />
      {result && (
        <ResultSheet
          title={resultTitle(result, seats, sideName)}
          outcome={outcomeOf(result, seats)}
          onRematch={() => setRound((r) => r + 1)}
          onChangeMode={onExit}
        />
      )}
    </div>
  );
}
