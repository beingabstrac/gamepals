import { useMemo } from 'preact/hooks';
import type { Outcome } from '../outcome';
import { COLORS } from '../theme';

interface Props {
  title: string;
  outcome: Outcome;
  /** The running score between these players, e.g. "You 3 · Bo 1". */
  score?: string | null;
  /** How many games in a row the same player has won, in words. */
  streak?: string | null;
  /** Games played between these players, for the tests to count. */
  games?: number;
  onRematch(): void;
  onChangeMode(): void;
}

const CONFETTI_COLORS = [COLORS.sky, COLORS.tomato, COLORS.sunny, COLORS.mint, COLORS.grape, COLORS.bubblegum];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.4 + Math.random() * 1.2,
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  );
  return (
    <div class="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function ResultSheet({ title, outcome, score, streak, games, onRematch, onChangeMode }: Props) {
  return (
    <>
      {outcome === 'win' && <Confetti />}
      <div class={`result-sheet ${outcome}`} role="dialog" aria-live="assertive" aria-label={title}>
        <p class="result-title">{title}</p>
        {score && (
          <p class="rivalry" data-games={games}>
            <span class="rivalry-score">{score}</span>
            {streak && <span class="rivalry-streak">{streak}</span>}
          </p>
        )}
        <div class="result-actions">
          <button class="btn primary" onClick={onRematch}>
            Rematch
          </button>
          <button class="btn secondary" onClick={onChangeMode}>
            Change mode
          </button>
        </div>
      </div>
    </>
  );
}
