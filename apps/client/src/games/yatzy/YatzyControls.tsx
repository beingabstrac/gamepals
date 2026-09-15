import { scoreBox, upperSum, totalOf, YATZY_BONUS, YATZY_BONUS_AT, YATZY_BOXES, YATZY_FIRST_ROLL, yatzyRoll, yatzyScore, type YatzyMove, type YatzyState } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { Session } from '../../session';
import { tableFor, yatzyColors, yatzyNames, YATZY_LABELS } from './table';

export function YatzyControls({ session }: { session: Session<YatzyMove> }) {
  const state = session.state as YatzyState;
  const table = tableFor(session);
  const [, bump] = useState(0);
  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    table.listeners.add(listener);
    return () => {
      table.listeners.delete(listener);
    };
  }, [table]);

  const seat = state.currentSeat;
  const myTurn = !state.result && session.isHumanTurn();
  const left = 3 - state.rollsUsed;
  const canScore = myTurn && state.rollsUsed > 0;
  const names = yatzyNames(state.players);
  const colors = yatzyColors(state.players);
  const fresh = state.last?.kind === 'score' ? state.last : null;
  const seats = names.map((_, s) => s);

  let label = 'Waiting…';
  if (myTurn) label = state.rollsUsed === 0 ? 'Roll' : left > 0 ? `Roll again (${left} left)` : 'Pick a box';

  const cell = (s: number, index: number) => {
    const value = state.cards[s]![index];
    const side = `--side: ${colors[s]}`;
    const box = YATZY_BOXES[index]!;
    if (value !== null && value !== undefined) {
      const isFresh = fresh !== null && fresh.seat === s && fresh.box === box;
      return <span class={isFresh ? 'yatzy-cell fresh' : 'yatzy-cell'} style={side}>{value}</span>;
    }
    if (s === seat && canScore) {
      const points = scoreBox(box, state.dice);
      return (
        <button class={points ? 'yatzy-cell preview' : 'yatzy-cell preview zero'} style={side} aria-label={`Score ${points} in ${YATZY_LABELS[box]}`} onClick={() => session.play(yatzyScore(box))}>
          {points}
        </button>
      );
    }
    return <span class="yatzy-cell empty" style={side} />;
  };

  const row = (index: number) => (
    <tr key={index} class={index === 6 ? 'gap' : undefined}>
      <th class="box" scope="row">{YATZY_LABELS[YATZY_BOXES[index]!]}</th>
      {seats.map((s) => (
        <td key={s}>{cell(s, index)}</td>
      ))}
    </tr>
  );

  return (
    <div class="sudoku-controls yatzy-controls">
      {!state.result && (
        <div class="ludo-controls">
          <button class="btn primary roll-btn" disabled={!myTurn || left === 0} onClick={() => session.play(state.rollsUsed === 0 ? YATZY_FIRST_ROLL : yatzyRoll(table.keep))}>
            {label}
          </button>
        </div>
      )}
      <table class="yatzy-card">
        <thead>
          <tr>
            <th />
            {seats.map((s) => (
              <th key={s} scope="col" class={s === seat && !state.result ? 'turn' : undefined} style={`--side: ${colors[s]}`}>
                {names[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map(row)}
          <tr class="sum">
            <th class="box" scope="row">Bonus (63+)</th>
            {seats.map((s) => {
              const upper = upperSum(state.cards[s]!);
              return (
                <td key={s}>
                  <span class="yatzy-cell sum" style={`--side: ${colors[s]}`}>{upper >= YATZY_BONUS_AT ? YATZY_BONUS : `${upper}/${YATZY_BONUS_AT}`}</span>
                </td>
              );
            })}
          </tr>
          {[6, 7, 8, 9, 10, 11, 12, 13, 14].map(row)}
          <tr class="sum total">
            <th class="box" scope="row">Total</th>
            {seats.map((s) => (
              <td key={s}>
                <span class="yatzy-cell sum" style={`--side: ${colors[s]}`}>{totalOf(state.cards[s]!)}</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
