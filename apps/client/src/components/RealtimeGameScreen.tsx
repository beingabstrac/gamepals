import type { GameResult } from '@gamepals/rules';
import { AUTO, Game, Scale } from 'phaser';
import { useEffect, useRef, useState } from 'preact/hooks';
import { cue } from '../feedback';
import { isFirstPlay, markPlayed, tryItLine } from '../firstplay';
import { keyFor, load, record, scoreLine, streakLine, type Rivalry } from '../rivalry';
import { recordGame } from '../stats';
import { DPR } from '../games/crisp';
import { isCooking, type RealtimeEntry } from '../games/registry';
import { outcomeOf, resultTitle } from '../outcome';
import type { SeatController } from '../session';
import { BackIcon } from './Art';
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
  const rivalryKey = keyFor(entry.definition.id, seats);
  const [rivalry, setRivalry] = useState<Rivalry>(() => load(rivalryKey));
  // The coaching line, shown the first time this game is opened.
  const [coach, setCoach] = useState(() => isFirstPlay(entry.definition.id));

  useEffect(() => {
    if (!coach) return;
    markPlayed(entry.definition.id);
    const timer = setTimeout(() => setCoach(false), 10_000);
    return () => clearTimeout(timer);
  }, [coach, entry]);

  useEffect(() => {
    setScores(seats.map(() => 0));
    setResult(null);
    const game = new Game({
      type: AUTO,
      parent: host.current!,
      width: entry.size.width * DPR,
      height: entry.size.height * DPR,
      transparent: true,
      antialias: true,
      scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
      scene: [
        entry.createScene({
          seats,
          seed: newSeed(),
          onScore: (next) => {
            setScores([...next]);
            setCoach(false);
          },
          onEnd: (final) => {
            setResult(final);
            setCoach(false);
            // A game still cooking is playable but keeps nothing: it is out early on purpose,
            // and its numbers should not end up in anybody's record or running score.
            if (!isCooking(entry.definition.id)) {
              setRivalry(record(rivalryKey, seats, final));
              recordGame(entry.definition.id, seats, final);
            }
            cue(outcomeOf(final, seats));
          },
          onCue: cue,
        }),
      ],
    });
    return () => game.destroy(true);
  }, [round, entry, seats, rivalryKey]);

  const names = entry.sideNames(seats.length);
  const sideColors = entry.sideColors(seats.length);
  const sideName = (seat: number) => `${seats[seat]?.label} (${names[seat] ?? seat + 1})`;

  return (
    <div class="screen game-screen" style={{ '--game': entry.color }}>
      <header class="topbar">
        <button class="round-btn" onClick={onExit} aria-label="Back to the table">
          <BackIcon />
        </button>
        <h1>{entry.definition.name}</h1>
        <span />
      </header>
      <div class="play-area">
        <div class="scoreboard" aria-live="polite">
          {seats.map((seat, i) => (
            <div key={i} class="score" style={{ '--side': sideColors[i] ?? '#9B7BFF' }}>
              <span class="score-dot" />
              <span class="score-name">{seat.label}</span>
              <span class="score-value" key={scores[i]}>
                {scores[i] ?? 0}
              </span>
            </div>
          ))}
        </div>
        {/* A fresh container per round so the old game's canvas leaves immediately on rematch (see GameScreen). */}
        <div
          class="board realtime"
          key={round}
          ref={host}
          style={{ aspectRatio: `${entry.size.width} / ${entry.size.height}`, '--ar': entry.size.width / entry.size.height }}
        />
        {/* First time at this game: one line to get you going. */}
        {coach && !result && <p class="coach">{tryItLine(entry.howTo.controls, entry.tryIt)}</p>}
      </div>
      {result && (
        <ResultSheet
          title={entry.resultText?.(result, scores) ?? resultTitle(result, seats, sideName)}
          outcome={outcomeOf(result, seats)}
          score={scoreLine(rivalry, seats)}
          streak={streakLine(rivalry)}
          games={rivalry.games}
          onRematch={() => setRound((r) => r + 1)}
          onChangeMode={onExit}
        />
      )}
    </div>
  );
}
