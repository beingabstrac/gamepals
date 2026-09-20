import { useEffect, useRef, useState } from 'preact/hooks';
import { GameArt, LookIcon, Mascot, RoomEmblem, SpeakerIcon, VibrateIcon } from './components/Art';
import { ROOM, switchLook } from './look';
import { GameScreen } from './components/GameScreen';
import { RealtimeGameScreen } from './components/RealtimeGameScreen';
import { Setup } from './components/Setup';
import { COMING_SOON, GAMES, type AnyEntry } from './games/registry';
import type { SeatController } from './session';
import { settings, type Settings } from './settings';
import { AUTOPLAY, autoplaySeats } from './autoplay';
import { onBackButton } from './platform';

type Screen =
  | { name: 'home' }
  | { name: 'setup'; entry: AnyEntry }
  | { name: 'play'; entry: AnyEntry; seats: SeatController[]; variant?: string };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const current = useRef(screen);
  current.current = screen;

  // Android Back: game → table → home; on the home screen the app goes to the background.
  useEffect(
    () =>
      onBackButton(() => {
        const now = current.current;
        if (now.name === 'play') setScreen({ name: 'setup', entry: now.entry });
        else if (now.name === 'setup') setScreen({ name: 'home' });
        else return false;
        return true;
      }),
    [],
  );

  if (screen.name === 'play') {
    const onExit = () => setScreen({ name: 'setup', entry: screen.entry });
    if (screen.entry.kind === 'realtime') {
      return <RealtimeGameScreen entry={screen.entry} seats={screen.seats} onExit={onExit} />;
    }
    return <GameScreen entry={screen.entry} seats={screen.seats} variant={screen.variant} onExit={onExit} />;
  }
  if (screen.name === 'setup') {
    return (
      <Setup
        entry={screen.entry}
        onBack={() => setScreen({ name: 'home' })}
        onStart={(seats, variant) => setScreen({ name: 'play', entry: screen.entry, seats: AUTOPLAY ? autoplaySeats(seats.length) : seats, variant })}
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
      {/* While two looks are in the build, one tap swaps them (docs/08, the look). */}
      <button
        class="round-btn"
        aria-pressed={ROOM}
        aria-label={ROOM ? 'Back to the old look' : 'Try the games room look'}
        onClick={switchLook}
      >
        <LookIcon room={ROOM} />
      </button>
    </div>
  );
}

function Home({ onPick }: { onPick(entry: AnyEntry): void }) {
  return (
    <div class="screen">
      <header class="hero">
        <span class="mascot">{ROOM ? <RoomEmblem /> : <Mascot />}</span>
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
            <span class="mins">{entry.minutes}</span>
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

      <footer class="shelf-foot">
        {/* Ships inside the apps too, so it opens with no connection. */}
        <a href="./privacy.html">Privacy</a>
        <span aria-hidden="true">·</span>
        <span>Works offline</span>
      </footer>
    </div>
  );
}
