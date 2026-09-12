import { useMemo } from 'preact/hooks';

export type Outcome = 'win' | 'lose' | 'draw';

interface Props {
  title: string;
  outcome: Outcome;
  onRematch(): void;
  onChangeMode(): void;
}

const CONFETTI_COLORS = ['#4f8cff', '#ff6b6b', '#ffd23f', '#3ddc97', '#b388ff'];

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

export function ResultSheet({ title, outcome, onRematch, onChangeMode }: Props) {
  return (
    <>
      {outcome === 'win' && <Confetti />}
      <div class={`result-sheet ${outcome}`} role="dialog" aria-live="assertive" aria-label={title}>
        <p class="result-title">{title}</p>
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
