import { BOT_TIERS, type BotTier } from '@gamepals/rules';
import { useEffect, useState } from 'preact/hooks';
import { GameScreen } from './components/GameScreen';
import { COMING_SOON, GAMES, type GameEntry } from './games/registry';
import type { SeatController } from './session';
import { settings, type Settings } from './settings';

type Screen =
  | { name: 'home' }
  | { name: 'setup'; entry: GameEntry }
  | { name: 'play'; entry: GameEntry; seats: SeatController[] };

const TIER_LABEL: Record<BotTier, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

const gradient = ([from, to]: readonly [string, string]) => ({ '--game-from': from, '--game-to': to });

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  if (screen.name === 'play') {
    return (
      <GameScreen
        entry={screen.entry}
        seats={screen.seats}
        onExit={() => setScreen({ name: 'setup', entry: screen.entry })}
      />
    );
  }
  if (screen.name === 'setup') {
    return (
      <Setup
        entry={screen.entry}
        onBack={() => setScreen({ name: 'home' })}
        onStart={(seats) => setScreen({ name: 'play', entry: screen.entry, seats })}
      />
    );
  }
  return <Home onPick={(entry) => setScreen({ name: 'setup', entry })} />;
}

function useSettings(): Settings {
  const [value, setValue] = useState(settings.get());
  useEffect(() => settings.subscribe(setValue), []);
  return value;
}

function SettingsToggles() {
  const { sound, haptics } = useSettings();
  return (
    <div class="toggles">
      <button
        class="icon-btn"
        aria-pressed={sound}
        aria-label={sound ? 'Sound on' : 'Sound off'}
        onClick={() => settings.set({ sound: !sound })}
      >
        {sound ? '🔊' : '🔇'}
      </button>
      <button
        class="icon-btn"
        aria-pressed={haptics}
        aria-label={haptics ? 'Vibration on' : 'Vibration off'}
        onClick={() => settings.set({ haptics: !haptics })}
      >
        {haptics ? '📳' : '📴'}
      </button>
    </div>
  );
}

function Home({ onPick }: { onPick(entry: GameEntry): void }) {
  return (
    <div class="screen">
      <header class="hero">
        <div>
          <h1 class="logo">Game Pals</h1>
          <p class="muted">Every game. Every way to play.</p>
        </div>
        <SettingsToggles />
      </header>
      <div class="grid">
        {GAMES.map((entry, i) => (
          <button
            key={entry.definition.id}
            class="game-card"
            style={{ ...gradient(entry.colors), animationDelay: `${i * 40}ms` }}
            onClick={() => onPick(entry)}
          >
            <span class="emoji">{entry.emoji}</span>
            <span class="title">{entry.definition.name}</span>
            <span class="small">{entry.tagline}</span>
          </button>
        ))}
        {COMING_SOON.map((game, i) => (
          <div
            key={game.name}
            class="game-card soon"
            aria-disabled="true"
            style={{ ...gradient(game.colors), animationDelay: `${(GAMES.length + i) * 40}ms` }}
          >
            <span class="emoji">{game.emoji}</span>
            <span class="title">{game.name}</span>
            <span class="small">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SetupProps {
  entry: GameEntry;
  onBack(): void;
  onStart(seats: SeatController[]): void;
}

function Setup({ entry, onBack, onStart }: SetupProps) {
  const [tier, setTier] = useState<BotTier>('medium');
  const { modes, name } = entry.definition;

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
          <h2>🤖 Play vs Bot</h2>
          <div class="chips" role="radiogroup" aria-label="Bot difficulty">
            {BOT_TIERS.map((t) => (
              <button
                key={t}
                class={t === tier ? 'chip selected' : 'chip'}
                role="radio"
                aria-checked={t === tier}
                onClick={() => setTier(t)}
              >
                {TIER_LABEL[t]}
              </button>
            ))}
          </div>
          <button
            class="btn primary"
            onClick={() =>
              onStart([
                { kind: 'human', label: 'You' },
                { kind: 'bot', tier, label: `${TIER_LABEL[tier]} bot` },
              ])
            }
          >
            Play
          </button>
        </section>
      )}

      {modes.includes('sameDevice') && (
        <section class="card">
          <h2>👫 2 Players · Same device</h2>
          <p class="muted">Take turns on this phone or tablet.</p>
          <button
            class="btn primary"
            onClick={() =>
              onStart([
                { kind: 'human', label: 'Player 1' },
                { kind: 'human', label: 'Player 2' },
              ])
            }
          >
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
