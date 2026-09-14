import type { LudoMove, LudoState } from '@gamepals/rules';
import type { Session } from '../../session';

/** Pip positions (0–8 in a 3×3 grid) for each die face. */
const PIPS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value }: { value: number | null }) {
  const pips = value ? (PIPS[value] ?? []) : [];
  return (
    <div class={value ? 'die rolled' : 'die'} aria-label={value ? `Rolled ${value}` : 'Not rolled yet'}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} class={pips.includes(i) ? 'pip on' : 'pip'} />
      ))}
    </div>
  );
}

export function LudoControls({ session }: { session: Session<LudoMove> }) {
  const state = session.state as LudoState;
  if (state.result) return null;
  const myTurn = session.isHumanTurn();
  const canRoll = myTurn && state.phase === 'roll';

  let label = 'Waiting…';
  if (canRoll) label = 'Roll';
  else if (myTurn) label = 'Tap a glowing token';

  return (
    <div class="sudoku-controls">
      {state.threeSixes && (
        <p class="hint-bubble" key={state.rollCount}>
          🎲 Three 6s in a row. Turn over!
        </p>
      )}
      <div class="ludo-controls">
        {/* Keying on the roll count replays the tumble animation for every roll. */}
        <Die key={state.rollCount} value={state.dice} />
        <button class="btn primary roll-btn" disabled={!canRoll} onClick={() => session.play('roll')}>
          {label}
        </button>
      </div>
    </div>
  );
}
