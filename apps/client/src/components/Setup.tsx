import { BOT_TIERS, type BotTier } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import type { EntryBase } from '../games/registry';
import type { SeatController } from '../session';
import { storage } from '../platform';
import { keyFor, load, scoreLine, streakLine } from '../rivalry';
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

const TIER_RANK: Record<BotTier, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

/** Each chair at the table: empty, a person on this device, or a bot of some level. */
type SeatChoice = 'empty' | 'human' | BotTier;
type Position = 'bottom' | 'left' | 'top' | 'right';

const VALID: readonly SeatChoice[] = ['empty', 'human', ...BOT_TIERS];

/** Chairs go clockwise from the player holding the phone. */
function positionsFor(maxPlayers: number): Position[] {
  if (maxPlayers === 1) return ['bottom'];
  if (maxPlayers <= 2) return ['bottom', 'top'];
  if (maxPlayers === 3) return ['bottom', 'left', 'right'];
  return ['bottom', 'left', 'top', 'right'];
}

const storageKey = (id: string) => `gamepals.table.${id}`;

const vsBots = (max: number, tier: BotTier): SeatChoice[] => ['human', ...Array<SeatChoice>(max - 1).fill(tier)];
const friends = (max: number): SeatChoice[] => Array<SeatChoice>(max).fill('human');

function loadChoices(id: string, min: number, max: number): SeatChoice[] {
  try {
    const saved = JSON.parse(storage.get(storageKey(id)) ?? 'null') as SeatChoice[] | null;
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
  return vsBots(max, 'medium');
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

function Meter({ tier }: { tier: BotTier }) {
  return (
    <span class="meter" aria-label={`${TIER_LABEL[tier]} difficulty`}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} class={n <= TIER_RANK[tier] ? 'on' : ''} />
      ))}
    </span>
  );
}

interface PickerProps {
  current: SeatChoice;
  side: string;
  sideName: string;
  canLeave: boolean;
  onPick(choice: SeatChoice): void;
  onClose(): void;
}

/** Everything that can sit in a chair, visible at once: tap one and it sits down. */
function SeatPicker({ current, side, sideName, canLeave, onPick, onClose }: PickerProps) {
  return (
    <div class="picker-backdrop" onClick={onClose}>
      <div class="picker" role="dialog" aria-label={`Who plays ${sideName}?`} onClick={(event) => event.stopPropagation()}>
        <p class="picker-title">
          Who plays <span style={{ color: side }}>{sideName}</span>?
        </p>
        <div class="options">
          <button class={current === 'human' ? 'option selected' : 'option'} onClick={() => onPick('human')}>
            <span class="option-face" style={{ '--side': side }}>
              <PersonFace color={side} />
            </span>
            <span class="option-name">Person</span>
            <span class="option-note">you or a friend</span>
          </button>
          {BOT_TIERS.map((tier) => (
            <button key={tier} class={current === tier ? 'option selected' : 'option'} onClick={() => onPick(tier)}>
              <span class="option-face">
                <BotFace tier={tier} />
              </span>
              <span class="option-name">{BOT_NAMES[tier]}</span>
              <Meter tier={tier} />
              <span class="option-note">{TIER_LABEL[tier]} bot</span>
            </button>
          ))}
          {canLeave && (
            <button class="option" onClick={() => onPick('empty')}>
              <span class="option-face empty">×</span>
              <span class="option-name">Nobody</span>
              <span class="option-note">empty chair</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface SetupProps {
  entry: EntryBase;
  onBack(): void;
  onStart(seats: SeatController[], variant?: string): void;
}

const levelKey = (id: string) => `gamepals.level.${id}`;
const partyKey = (id: string) => `gamepals.party.${id}`;

function loadCount(id: string, min: number, max: number): number {
  try {
    const saved = Number(storage.get(partyKey(id)));
    if (Number.isInteger(saved) && saved >= min && saved <= max) return saved;
  } catch {
    // Ignore unreadable storage.
  }
  return Math.min(max, Math.max(min, 4));
}

const partySeats = (count: number): SeatController[] => Array.from({ length: count }, (_, i) => ({ kind: 'human', label: `Player ${i + 1}` }));

/**
 * The table for a pass-the-phone party game: everyone is a person on this one phone, so the only
 * choice is how many, and the faces sit round the table to show it.
 */
function PartySetup({ entry, onBack, onStart }: SetupProps) {
  const { id, minPlayers, maxPlayers } = entry.definition;
  const [count, setCount] = useState(() => loadCount(id, minPlayers, maxPlayers));
  useEffect(() => {
    try {
      storage.set(partyKey(id), String(count));
    } catch {
      // Remembering the count is a convenience; ignore storage failures.
    }
  }, [id, count]);
  const seats = partySeats(count);
  const colors = entry.sideColors(count);
  const rivalry = load(keyFor(id, seats));
  const score = scoreLine(rivalry, seats);
  return (
    <div class="screen setup" style={{ '--game': entry.color }}>
      <Topbar entry={entry} onBack={onBack} />
      <div class="quick-starts party-count" role="group" aria-label="How many players">
        {Array.from({ length: maxPlayers - minPlayers + 1 }, (_, i) => minPlayers + i).map((n) => (
          <button key={n} class={n === count ? 'quick selected' : 'quick'} onClick={() => setCount(n)} aria-label={`${n} players`}>
            {n}
          </button>
        ))}
      </div>
      <div class="table party-table">
        <div class="table-top">
          <GameArt id={id} />
        </div>
        {seats.map((seat, i) => {
          // Round the table from the bottom, the way the phone will go.
          const angle = Math.PI / 2 + (i / count) * Math.PI * 2;
          return (
            <div
              key={`${count}-${i}`}
              class="seat party-seat"
              style={{ '--side': colors[i] ?? entry.color, left: `${50 + Math.cos(angle) * 40}%`, top: `${50 + Math.sin(angle) * 40}%`, animationDelay: `${i * 30}ms` }}
            >
              <span class="avatar">
                <PersonFace color={colors[i] ?? entry.color} />
              </span>
              <span class="who">{seat.label}</span>
            </div>
          );
        })}
      </div>
      <p class="hint">Everyone plays on this phone. Pick how many, then pass it round.</p>
      {score && <p class="table-score">{score}</p>}
      <HowTo entry={entry} />
      <button class="play-bubble" onClick={() => onStart(seats)}>
        Play
      </button>
    </div>
  );
}

function loadLevel(id: string, levels: EntryBase['levels']): string | undefined {
  if (!levels) return undefined;
  try {
    const saved = storage.get(levelKey(id));
    if (saved && levels.some((level) => level.id === saved)) return saved;
  } catch {
    // Ignore unreadable storage.
  }
  return levels[0]?.id;
}

/** Game setup as a table: tap a chair to choose who sits there, or use a quick start. No forms. */
export function Setup(props: SetupProps) {
  return props.entry.party ? <PartySetup key={props.entry.definition.id} {...props} /> : <ChairSetup key={props.entry.definition.id} {...props} />;
}

function Topbar({ entry, onBack }: { entry: EntryBase; onBack(): void }) {
  return (
    <header class="topbar">
      <button class="round-btn" onClick={onBack} aria-label="Back to games">
        <BackIcon />
      </button>
      <h1>{entry.definition.name}</h1>
      <span class="mins topbar-mins">{entry.minutes}</span>
    </header>
  );
}

/** The goal, always on, and the rest of the rules behind a tap. */
function HowTo({ entry }: { entry: EntryBase }) {
  // The rules are reference, not the job: the goal shows, the rest opens when asked for.
  const [rulesOpen, setRulesOpen] = useState(false);
  return (
    <section class="how-to" aria-label="How to play">
      <p class="how-goal">
        <span aria-hidden="true">🎯</span>
        <span>{entry.howTo.goal}</span>
      </p>
      <button class="how-more" aria-expanded={rulesOpen} onClick={() => setRulesOpen(!rulesOpen)}>
        {rulesOpen ? 'Hide the rules' : 'How to play'}
        <span aria-hidden="true">{rulesOpen ? ' ▴' : ' ▾'}</span>
      </button>
      <ul hidden={!rulesOpen}>
        <li>
          <span aria-hidden="true">👆</span>
          <span>{entry.howTo.controls}</span>
        </li>
        <li>
          <span aria-hidden="true">🏆</span>
          <span>{entry.howTo.win}</span>
        </li>
        {entry.howTo.draw && (
          <li>
            <span aria-hidden="true">🤝</span>
            <span>{entry.howTo.draw}</span>
          </li>
        )}
        {entry.howTo.tip && (
          <li>
            <span aria-hidden="true">💡</span>
            <span>{entry.howTo.tip}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

function ChairSetup({ entry, onBack, onStart }: SetupProps) {
  const { id, minPlayers, maxPlayers } = entry.definition;
  const [choices, setChoices] = useState(() => loadChoices(id, minPlayers, maxPlayers));
  const [picking, setPicking] = useState<number | null>(null);
  const [level, setLevel] = useState(() => loadLevel(id, entry.levels));

  useEffect(() => {
    if (!level) return;
    try {
      storage.set(levelKey(id), level);
    } catch {
      // Remembering the level is a convenience; ignore storage failures.
    }
  }, [id, level]);

  useEffect(() => {
    try {
      storage.set(storageKey(id), JSON.stringify(choices));
    } catch {
      // Remembering the table is a convenience; ignore storage failures.
    }
  }, [id, choices]);

  const positions = positionsFor(maxPlayers);
  const solo = maxPlayers === 1;
  const seats = toSeats(choices);
  const rivalry = load(keyFor(entry.definition.id, seats));
  const score = scoreLine(rivalry, seats);
  const streak = streakLine(rivalry);
  const sideNames = entry.sideNames(seats.length);
  const sideColors = entry.sideColors(seats.length);
  const occupied = choices.filter((choice) => choice !== 'empty').length;

  // The bot level from the table (or Medium), so "vs Bot" keeps the level people picked.
  const botTier = (choices.find((choice) => choice !== 'empty' && choice !== 'human') as BotTier | undefined) ?? 'medium';
  const quickStarts = [
    { label: maxPlayers > 2 ? '🤖 vs Bots' : '🤖 vs Bot', choices: vsBots(maxPlayers, botTier) },
    { label: '👫 Friends', choices: friends(maxPlayers) },
    ...(minPlayers === 1 ? [{ label: '🙂 Solo', choices: ['human', ...Array<SeatChoice>(maxPlayers - 1).fill('empty')] as SeatChoice[] }] : []),
  ];
  const same = (a: readonly SeatChoice[], b: readonly SeatChoice[]) => a.every((choice, i) => choice === b[i]);

  // Side name/color for each chair index (empty chairs get none).
  const occupiedIndexOf = (index: number) => choices.slice(0, index).filter((choice) => choice !== 'empty').length;

  const pick = (choice: SeatChoice) => {
    if (picking === null) return;
    setChoices((current) => current.map((c, i) => (i === picking ? choice : c)));
    setPicking(null);
  };

  const pickingChoice = picking === null ? null : (choices[picking] ?? 'empty');
  const pickingSide = picking === null ? 0 : occupiedIndexOf(picking);

  return (
    <div class="screen setup" style={{ '--game': entry.color }}>
      <Topbar entry={entry} onBack={onBack} />

      {entry.levels && (
        <div class="quick-starts" role="group" aria-label="Level">
          {entry.levels.map((option) => (
            <button key={option.id} class={option.id === level ? 'quick selected' : 'quick'} onClick={() => setLevel(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div class="quick-starts" role="group" aria-label="Quick start" hidden={solo}>
        {quickStarts.map((quick) => (
          <button
            key={quick.label}
            class={same(choices, quick.choices) ? 'quick selected' : 'quick'}
            onClick={() => setChoices(quick.choices)}
          >
            {quick.label}
          </button>
        ))}
      </div>

      <div class="table">
        <div class="table-top">
          <GameArt id={id} />
        </div>
        {positions.map((position, index) => {
          const choice = choices[index] ?? 'empty';
          if (choice === 'empty') {
            return (
              <button key={position} class="seat" data-pos={position} onClick={() => setPicking(index)} aria-label="Add a player here">
                <span class="avatar empty">+</span>
                <span class="who muted">Add</span>
              </button>
            );
          }
          const sideIndex = occupiedIndexOf(index);
          const seat = seats[sideIndex]!;
          const side = sideColors[sideIndex] ?? '#9B7BFF';
          const sideName = sideNames[sideIndex] ?? '';
          return (
            <button
              key={position}
              class="seat"
              data-pos={position}
              style={{ '--side': side }}
              onClick={() => !solo && setPicking(index)}
              aria-label={solo ? 'You' : `${seat.label} plays ${sideName}. Tap to change.`}
            >
              {/* Keyed on the choice so the avatar springs in each time it changes. */}
              <span class="avatar" key={choice}>
                {choice === 'human' ? <PersonFace color={side} /> : <BotFace tier={choice} />}
                {!solo && (
                  <span class="edit-badge" aria-hidden="true">
                    ✎
                  </span>
                )}
              </span>
              <span class="who">{seat.label}</span>
              {choice === 'human' ? <span class="level">{sideName}</span> : <Meter tier={choice} />}
            </button>
          );
        })}
      </div>

      <p class="hint">
        {!solo ? 'Tap a chair to choose who sits there.' : entry.levels ? 'Just you. Pick a level, then press Play.' : 'Just you. Racing a friend on the same puzzle is coming soon.'}
      </p>

      {/* How this table has gone so far, so you know what you are walking into. */}
      {score && (
        <p class="table-score">
          {score}
          {streak && ` · ${streak}`}
        </p>
      )}

      <HowTo entry={entry} />

      <button class="play-bubble" onClick={() => onStart(seats, level)}>
        Play
      </button>

      <p class="soon-pill">🌍 Online with friends is coming soon</p>

      {picking !== null && pickingChoice !== null && (
        <SeatPicker
          current={pickingChoice}
          side={sideColors[pickingSide] ?? entry.color}
          sideName={pickingChoice === 'empty' ? 'this chair' : (sideNames[pickingSide] ?? 'this chair')}
          canLeave={pickingChoice !== 'empty' && occupied > minPlayers}
          onPick={pick}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
