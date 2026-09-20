import { useEffect, useState } from 'preact/hooks';
import { loadDaily } from '../daily';
import { GAMES } from '../games/registry';
import { byPlayed, loadStats, subscribeStats, totals, type Stats } from '../stats';
import { GameArt } from './Art';
import { usePro } from './Pro';

/** How many games the list shows before Pro. Enough to be worth looking at, not the whole thing. */
export const FREE_ROWS = 3;

function useStats(): Stats {
  const [stats, setStats] = useState(loadStats);
  useEffect(() => subscribeStats(setStats), []);
  return stats;
}

/**
 * Your own record (docs/08 D3b). Everything here was counted on this device from games a person
 * actually played: a build with bots in every seat never reaches it. The totals and the streak
 * are free, because a number you cannot see is not a reason to buy anything, and the full
 * game-by-game list is one of the things Pro gives.
 */
export function StatsSheet({ onClose, onGoPro }: { onClose(): void; onGoPro(): void }) {
  const { pro: hasPro } = usePro();
  const stats = useStats();
  const [daily] = useState(loadDaily);
  const sum = totals(stats);
  const rows = byPlayed(stats);
  const shown = hasPro ? rows : rows.slice(0, FREE_ROWS);
  const hidden = rows.length - shown.length;
  const nameOf = (id: string) => GAMES.find((game) => game.definition.id === id)?.definition.name ?? id;

  return (
    <div class="picker-backdrop" onClick={onClose}>
      <div class="picker stats" role="dialog" aria-label="Your stats" onClick={(event) => event.stopPropagation()}>
        <h2>Your stats</h2>
        {sum.played === 0 ? (
          <p class="stats-empty">Nothing here yet. Finish a game and it starts counting.</p>
        ) : (
          <>
            <ul class="stats-totals">
              <li>
                <span class="stats-number">{sum.played}</span>
                <span class="stats-label">{sum.played === 1 ? 'game finished' : 'games finished'}</span>
              </li>
              <li>
                <span class="stats-number">{sum.won}</span>
                <span class="stats-label">won</span>
              </li>
              <li>
                <span class="stats-number">{sum.tried}</span>
                <span class="stats-label">of {GAMES.length} tried</span>
              </li>
              <li>
                <span class="stats-number">{sum.days}</span>
                <span class="stats-label">{sum.days === 1 ? 'day played' : 'days played'}</span>
              </li>
            </ul>
            <p class="stats-streak">
              Daily streak <strong>{daily.streak}</strong>, best <strong>{daily.best}</strong>
            </p>
            <ul class="stats-list">
              {shown.map(({ id, stat }) => (
                <li key={id}>
                  <span class="stats-art">
                    <GameArt id={id} />
                  </span>
                  <span class="stats-game">{nameOf(id)}</span>
                  <span class="stats-count">
                    {stat.played} played · {stat.won} won
                  </span>
                </li>
              ))}
            </ul>
            {hidden > 0 && (
              <button class="btn" onClick={onGoPro}>
                Pro shows all {rows.length} games
              </button>
            )}
          </>
        )}
        <button class="foot-link" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
