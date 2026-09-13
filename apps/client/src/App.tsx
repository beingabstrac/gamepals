import { useEffect, useState } from 'preact/hooks';
import { GameArt, Mascot, SpeakerIcon, VibrateIcon } from './components/Art';
import { GameScreen } from './components/GameScreen';
import { RealtimeGameScreen } from './components/RealtimeGameScreen';
import { Setup } from './components/Setup';
import { COMING_SOON, GAMES, type AnyEntry } from './games/registry';
import type { SeatController } from './session';
import { settings, type Settings } from './settings';

type Screen =
  | { name: 'home' }
  | { name: 'setup'; entry: AnyEntry }
  | { name: 'play'; entry: AnyEntry; seats: SeatController[] };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  if (screen.name === 'play') {
    const onExit = () => setScreen({ name: 'setup', entry: screen.entry });
    if (screen.entry.kind === 'realtime') {
      return <RealtimeGameScreen entry={screen.entry} seats={screen.seats} onExit={onExit} />;
    }
    return <GameScreen entry={screen.entry} seats={screen.seats} onExit={onExit} />;
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
        class="round-btn"
        aria-pressed={sound}
        aria-label={sound ? 'Sound on' : 'Sound off'}
        onClick={() => settings.set({ sound: !sound })}
      >
        <SpeakerIcon on={sound} />
      </button>
      <button
        class="round-btn"
        aria-pressed={haptics}
        aria-label={haptics ? 'Vibration on' : 'Vibration off'}
        onClick={() => settings.set({ haptics: !haptics })}
      >
        <VibrateIcon on={haptics} />
      </button>
    </div>
  );
}

function Home({ onPick }: { onPick(entry: AnyEntry): void }) {
  return (
    <div class="screen">
      <header class="hero">
        <span class="mascot">
          <Mascot />
        </span>
        <div>
          <h1 class="logo">
            Game <span>Pals</span>
          </h1>
          <p class="tagline">Every game. Every way to play.</p>
        </div>
        <SettingsToggles />
      </header>

      <div class="grid">
        {GAMES.map((entry, i) => (
          <button
            key={entry.definition.id}
            class="tile"
            style={{ '--c': entry.color, animationDelay: `${i * 50}ms` }}
            onClick={() => onPick(entry)}
          >
            <span class="art">
              <GameArt id={entry.definition.id} />
            </span>
            <span class="title">{entry.definition.name}</span>
            <span class="small">{entry.tagline}</span>
          </button>
        ))}
        {COMING_SOON.map((game, i) => (
          <div
            key={game.id}
            class="tile soon"
            aria-disabled="true"
            style={{ '--c': game.color, animationDelay: `${(GAMES.length + i) * 50}ms` }}
          >
            <span class="art">
              <GameArt id={game.id} />
            </span>
            <span class="title">{game.name}</span>
            <span class="small">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
