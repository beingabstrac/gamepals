import { useEffect, useState } from 'preact/hooks';
import { GameScreen } from './components/GameScreen';
import { gradient, Setup } from './components/Setup';
import { COMING_SOON, GAMES, type GameEntry } from './games/registry';
import type { SeatController } from './session';
import { settings, type Settings } from './settings';

type Screen =
  | { name: 'home' }
  | { name: 'setup'; entry: GameEntry }
  | { name: 'play'; entry: GameEntry; seats: SeatController[] };

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
