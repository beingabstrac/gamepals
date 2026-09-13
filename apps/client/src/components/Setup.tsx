import { BOT_TIERS, type BotTier } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { EntryBase } from '../games/registry';
import type { SeatController } from '../session';
import { BackIcon, BotFace, GameArt, PersonFace } from './Art';

export const TIER_LABEL: Record<BotTier, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

export const BOT_NAMES: Record<BotTier, string> = {
  easy: 'Pip',
  medium: 'Bo',
  hard: 'Zed',
  expert: 'Nova',
};

/** Each chair at the table: empty, a person on this device, or a bot of some level. */
type SeatChoice = 'empty' | 'human' | BotTier;
type Position = 'bottom' | 'left' | 'top' | 'right';

const VALID: readonly SeatChoice[] = ['empty', 'human', ...BOT_TIERS];

/** Chairs go clockwise from the player holding the phone. */
function positionsFor(maxPlayers: number): Position[] {
  if (maxPlayers <= 2) return ['bottom', 'top'];
  if (maxPlayers === 3) return ['bottom', 'left', 'right'];
  return ['bottom', 'left', 'top', 'right'];
}

const storageKey = (id: string) => `gamepals.table.${id}`;

function loadChoices(id: string, min: number, max: number): SeatChoice[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(id)) ?? 'null') as SeatChoice[] | null;
    if (
      saved &&
      saved.length === max &&
      saved.every((choice) => VALID.includes(choice)) &&
      saved.filter((choice) => choice !== 'empty').length >= min
    ) {
      return saved;
    }
  } catch {
    // Ignore unreadable storage and fall back to the default table.
  }
  return ['human', ...Array<SeatChoice>(max - 1).fill('medium')];
}

/** Tapping a chair cycles: person → each bot level → (empty, if the game still has enough players) → person. */
function nextChoice(choice: SeatChoice, canLeave: boolean): SeatChoice {
  if (choice === 'empty') return 'human';
  const order: SeatChoice[] = ['human', ...BOT_TIERS];
  if (canLeave) order.push('empty');
  return order[(order.indexOf(choice) + 1) % order.length]!;
}

export function toSeats(choices: readonly SeatChoice[]): SeatController[] {
  const occupied = choices.filter((choice): choice is Exclude<SeatChoice, 'empty'> => choice !== 'empty');
  const humans = occupied.filter((choice) => choice === 'human').length;
  let person = 0;
  return occupied.map((choice) => {
    if (choice === 'human') {
      person++;
      return { kind: 'human', label: humans === 1 ? 'You' : `Player ${person}` };
    }
    return { kind: 'bot', tier: choice, label: BOT_NAMES[choice] };
  });
}

interface SetupProps {
  entry: EntryBase;
  onBack(): void;
  onStart(seats: SeatController[]): void;
}

/** Game setup as a table: tap the chairs to seat people and bots, then Play. No forms. */
export function Setup({ entry, onBack, onStart }: SetupProps) {
  const { id, name, minPlayers, maxPlayers } = entry.definition;
  const [choices, setChoices] = useState(() => loadChoices(id, minPlayers, maxPlayers));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(id), JSON.stringify(choices));
    } catch {
      // Remembering the table is a convenience; ignore storage failures.
    }
  }, [id, choices]);

  const positions = positionsFor(maxPlayers);
  const seats = toSeats(choices);
  const sideNames = entry.sideNames(seats.length);
  const sideColors = entry.sideColors(seats.length);

  const tap = (index: number) =>
    setChoices((current) => {
      const occupied = current.filter((choice) => choice !== 'empty').length;
      return current.map((choice, i) => (i === index ? nextChoice(choice, occupied > minPlayers) : choice));
    });

  let occupiedIndex = -1;

  return (
    <div class="screen setup" style={{ '--game': entry.color }}>
      <header class="topbar">
        <button class="round-btn" onClick={onBack} aria-label="Back to games">
          <BackIcon />
        </button>
        <h1>{name}</h1>
        <span />
      </header>

      <div class="table">
        <div class="table-top">
          <GameArt id={id} />
        </div>
        {positions.map((position, index) => {
          const choice = choices[index] ?? 'empty';
          if (choice === 'empty') {
            return (
              <button key={position} class="seat" data-pos={position} onClick={() => tap(index)} aria-label="Add a player here">
                <span class="avatar empty">+</span>
                <span class="who muted">Add</span>
              </button>
            );
          }
          occupiedIndex++;
          const seat = seats[occupiedIndex]!;
          const side = sideColors[occupiedIndex] ?? '#9B7BFF';
          const sideName = sideNames[occupiedIndex] ?? '';
          return (
            <button
              key={position}
              class="seat"
              data-pos={position}
              style={{ '--side': side }}
              onClick={() => tap(index)}
              aria-label={`${seat.label}, ${sideName}. Tap to change.`}
            >
              {/* Keyed on the choice so the avatar springs in each time it changes. */}
              <span class="avatar" key={choice}>
                {choice === 'human' ? <PersonFace color={side} /> : <BotFace tier={choice} />}
              </span>
              <span class="who">{seat.label}</span>
              <span class="level">{choice === 'human' ? sideName : `${TIER_LABEL[choice]} · ${sideName}`}</span>
            </button>
          );
        })}
      </div>

      <p class="hint">Tap a chair to switch between a person and a bot.</p>

      <button class="play-bubble" onClick={() => onStart(seats)}>
        Play
      </button>

      <p class="soon-pill">🌍 Online with friends is coming soon</p>
    </div>
  );
}
