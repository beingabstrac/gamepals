import { useState } from 'preact/hooks';
import {
  agoWords,
  archive,
  dailyGameId,
  dailySeed,
  FREE_ARCHIVE_DAYS,
  loadDaily,
  type ArchiveDay,
} from '../daily';
import { GAMES, type AnyEntry } from '../games/registry';
import { GameArt } from './Art';
import { usePro } from './Pro';

/**
 * Every day's puzzle, back as far as the rota goes (docs/08 D3a). The last week is open to
 * everybody, because a week is enough to catch up after a busy few days, and the rest is one of
 * the three things Pro actually gives. The board still comes from the date, so a day played late
 * is the same board everybody else had.
 */
export function ArchiveSheet({
  onClose,
  onPlay,
  onGoPro,
}: {
  onClose(): void;
  onPlay(entry: AnyEntry, seed: number, key: string): void;
  onGoPro(): void;
}) {
  const { pro: hasPro } = usePro();
  const [state] = useState(loadDaily);
  const days = archive(state, hasPro);
  const entryFor = (day: ArchiveDay): AnyEntry | undefined =>
    GAMES.find((game) => game.definition.id === day.gameId);

  return (
    <div class="picker-backdrop" onClick={onClose}>
      <div class="picker archive" role="dialog" aria-label="Past puzzles" onClick={(event) => event.stopPropagation()}>
        <h2>Past puzzles</h2>
        <p class="archive-note">
          {hasPro
            ? 'Every day, all the way back. The board is still the one everybody had that day.'
            : `The last ${FREE_ARCHIVE_DAYS} days are open to everybody. Pro opens the rest.`}
        </p>
        <ul class="archive-list">
          {days.map((day) => {
            const entry = entryFor(day);
            if (!entry) return null;
            return (
              <li key={day.key}>
                <button
                  class={`archive-day${day.locked ? ' locked' : ''}`}
                  aria-label={`${agoWords(day.ago)}, ${entry.definition.name}, ${day.locked ? 'Pro only' : day.done ? 'done' : 'not played'}`}
                  onClick={() => (day.locked ? onGoPro() : onPlay(entry, dailySeed(day.key, dailyGameId(day.key)), day.key))}
                >
                  <span class="archive-art" style={{ '--c': entry.color }}>
                    <GameArt id={entry.definition.id} />
                  </span>
                  <span class="archive-words">
                    <span class="archive-when">{agoWords(day.ago)}</span>
                    <span class="archive-game">{entry.definition.name}</span>
                  </span>
                  <span class="archive-mark" aria-hidden="true">
                    {day.locked ? '🔒' : day.done ? '✓' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button class="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
