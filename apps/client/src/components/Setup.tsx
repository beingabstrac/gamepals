import { BOT_TIERS, type BotTier } from '@gamepals/rules';
import { useState } from 'preact/hooks';
import type { GameEntry } from '../games/registry';
import type { SeatController } from '../session';

export const TIER_LABEL: Record<BotTier, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

/** A seat in "Mix & match": a person on this device, or a bot of some tier. */
type SeatChoice = 'human' | BotTier;
const CHOICE_CYCLE: readonly SeatChoice[] = ['human', ...BOT_TIERS];

export const gradient = ([from, to]: readonly [string, string]) => ({ '--game-from': from, '--game-to': to });

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Turns seat choices into controllers with friendly labels ("You" when there's one person). */
function toSeats(choices: readonly SeatChoice[]): SeatController[] {
  const humans = choices.filter((c) => c === 'human').length;
  let person = 0;
  return choices.map((choice) => {
    if (choice === 'human') {
      person++;
      return { kind: 'human', label: humans === 1 ? 'You' : `Player ${person}` };
    }
    return { kind: 'bot', tier: choice, label: `${TIER_LABEL[choice]} bot` };
  });
}

function CountChips({ counts, value, onChange }: { counts: number[]; value: number; onChange(n: number): void }) {
  if (counts.length < 2) return null;
  return (
    <div class="chips" role="radiogroup" aria-label="Number of players">
      {counts.map((n) => (
        <button key={n} class={n === value ? 'chip selected' : 'chip'} role="radio" aria-checked={n === value} onClick={() => onChange(n)}>
          {n} players
        </button>
      ))}
    </div>
  );
}

interface SetupProps {
  entry: GameEntry;
  onBack(): void;
  onStart(seats: SeatController[]): void;
}

export function Setup({ entry, onBack, onStart }: SetupProps) {
  const { modes, name, minPlayers, maxPlayers } = entry.definition;
  const counts = range(minPlayers, maxPlayers);
  const [tier, setTier] = useState<BotTier>('medium');
  const [botGameSize, setBotGameSize] = useState(maxPlayers);
  const [localSize, setLocalSize] = useState(minPlayers);
  const [mix, setMix] = useState<SeatChoice[]>(() => ['human', ...Array<SeatChoice>(maxPlayers - 1).fill('medium')]);

  const sideNames = entry.sideNames(mix.length);
  const sideColors = entry.sideColors(mix.length);

  const resizeMix = (n: number) =>
    setMix((current) => (n <= current.length ? current.slice(0, n) : [...current, ...Array<SeatChoice>(n - current.length).fill('medium')]));
  const cycleSeat = (index: number) =>
    setMix((current) =>
      current.map((choice, i) => (i === index ? CHOICE_CYCLE[(CHOICE_CYCLE.indexOf(choice) + 1) % CHOICE_CYCLE.length]! : choice)),
    );

  return (
    <div class="screen" style={gradient(entry.colors)}>
      <header class="topbar">
        <button class="ghost" onClick={onBack}>
          ← Games
        </button>
        <h1>{name}</h1>
        <span />
      </header>

      <div class="setup-hero">
        <span class="emoji big">{entry.emoji}</span>
        <p class="muted">{entry.tagline}</p>
      </div>

      {modes.includes('bot') && (
        <section class="card">
          <h2>🤖 Play vs {maxPlayers > 2 ? 'Bots' : 'Bot'}</h2>
          <div class="chips" role="radiogroup" aria-label="Bot difficulty">
            {BOT_TIERS.map((t) => (
              <button key={t} class={t === tier ? 'chip selected' : 'chip'} role="radio" aria-checked={t === tier} onClick={() => setTier(t)}>
                {TIER_LABEL[t]}
              </button>
            ))}
          </div>
          <CountChips counts={counts} value={botGameSize} onChange={setBotGameSize} />
          <button class="btn primary" onClick={() => onStart(toSeats(['human', ...Array<SeatChoice>(botGameSize - 1).fill(tier)]))}>
            Play
          </button>
        </section>
      )}

      {modes.includes('sameDevice') && (
        <section class="card">
          <h2>👫 Same device</h2>
          <p class="muted">Take turns on this phone or tablet.</p>
          <CountChips counts={counts} value={localSize} onChange={setLocalSize} />
          <button class="btn primary" onClick={() => onStart(toSeats(Array<SeatChoice>(localSize).fill('human')))}>
            Play
          </button>
        </section>
      )}

      {modes.includes('bot') && modes.includes('sameDevice') && (
        <section class="card">
          <h2>🎛️ Mix & match</h2>
          <p class="muted">Tap a seat to switch between a person and each bot level.</p>
          <CountChips counts={counts} value={mix.length} onChange={resizeMix} />
          <div class="seats">
            {mix.map((choice, i) => (
              <button key={i} class="seat-chip" onClick={() => cycleSeat(i)}>
                <span class="swatch" style={{ background: sideColors[i] }} />
                <span class="seat-side">{sideNames[i]}</span>
                <span class="seat-who">{choice === 'human' ? '🙂 Person' : `🤖 ${TIER_LABEL[choice]}`}</span>
              </button>
            ))}
          </div>
          <button class="btn primary" onClick={() => onStart(toSeats(mix))}>
            Play
          </button>
        </section>
      )}

      <section class="card soon" aria-disabled="true">
        <h2>🌍 Online</h2>
        <p class="muted">Play friends, family and people worldwide. Coming soon.</p>
      </section>
    </div>
  );
}
