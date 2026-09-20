import { useEffect, useRef, useState } from 'preact/hooks';
import { FlameIcon, GameArt, Mascot, SpeakerIcon, VibrateIcon } from './components/Art';
import { GameScreen } from './components/GameScreen';
import { RealtimeGameScreen } from './components/RealtimeGameScreen';
import { Setup } from './components/Setup';
import { COMING_SOON, GAMES, type AnyEntry } from './games/registry';
import type { SeatController } from './session';
import { settings, type Settings } from './settings';
import { AUTOPLAY, autoplaySeats } from './autoplay';
import { DAILY_GAMES, dailyGameId, dailySeed, doneToday, loadDaily, timeToNext, todayKey } from './daily';
import { ProSheet, usePro } from './components/Pro';
import { onBackButton } from './platform';

type Screen =
  | { name: 'home' }
  | { name: 'setup'; entry: AnyEntry }
  | { name: 'play'; entry: AnyEntry; seats: SeatController[]; variant?: string; seed?: number; daily?: boolean };

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
    return (
      <GameScreen
        entry={screen.entry}
        seats={screen.seats}
        variant={screen.variant}
        seed={screen.seed}
        daily={screen.daily}
        onExit={onExit}
      />
    );
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
  return (
    <Home
      onPick={(entry) => setScreen({ name: 'setup', entry })}
      onDaily={(entry, seed) =>
        setScreen({
          name: 'play',
          entry,
          seats: AUTOPLAY ? autoplaySeats(1) : [{ kind: 'human', label: 'You' }],
          seed,
          daily: true,
        })
      }
    />
  );
}

function useSettings(): Settings {
  const [value, setValue] = useState(settings.get());
  useEffect(() => settings.subscribe(setValue), []);
  return value;
}

/** Today's puzzle: the same board for everybody, a countdown to the next, and the streak. */
function Daily({ onPlay }: { onPlay(entry: AnyEntry, seed: number): void }) {
  const { streaks } = useSettings();
  const [today, setToday] = useState(todayKey);
  const [left, setLeft] = useState(timeToNext);
  const [state, setState] = useState(loadDaily);
  const wanted = dailyGameId(today);
  // If the rota ever names a game that is not in the registry, show the next one that is. This
  // used to return nothing, so the whole shelf vanished for a day without a word about why, and
  // it did: DAILY_GAMES said 'twenty48', which is the folder, while the game calls itself '2048'.
  const entry =
    GAMES.find((game) => game.definition.id === wanted) ??
    GAMES.find((game) => DAILY_GAMES.includes(game.definition.id));

  useEffect(() => {
    // The countdown ticks, and at midnight the day rolls over without a reload.
    const timer = setInterval(() => {
      setLeft(timeToNext());
      const now = todayKey();
      setToday((was) => (was === now ? was : now));
      setState(loadDaily());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Loud, because a rota pointing at nothing is a mistake in the list, and e2e fails on this.
    if (entry?.definition.id !== wanted) console.error(`Today's puzzle names "${wanted}", which is not a game.`);
  }, [wanted, entry]);

  if (!entry) return null;
  const done = doneToday(state, today);
  return (
    <section class="daily" aria-label="Today's puzzle">
      <div class="daily-art" style={{ '--c': entry.color }}>
        <GameArt id={entry.definition.id} />
      </div>
      <div class="daily-words">
        <p class="daily-kicker">Today's puzzle{done ? ' · done' : ''}</p>
        <h2>{entry.definition.name}</h2>
        <p class="daily-note">
          {entry.minutes} · everyone gets the same one · next in {left}
        </p>
      </div>
      {streaks && state.streak > 0 && (
        <p class="daily-streak" aria-label={`${state.streak} day streak`}>
          <span aria-hidden="true">🔥</span> {state.streak}
        </p>
      )}
      <button class="btn primary daily-play" onClick={() => onPlay(entry, dailySeed(today))}>
        {done ? 'Play again' : 'Play'}
      </button>
    </section>
  );
}

function SettingsToggles() {
  const { sound, haptics, streaks } = useSettings();
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
      {/* A hook you cannot turn off is a trap, so the streak has a switch. */}
      <button
        class="round-btn"
        aria-pressed={streaks}
        aria-label={streaks ? 'Streaks on' : 'Streaks off'}
        onClick={() => settings.set({ streaks: !streaks })}
      >
        <FlameIcon on={streaks} />
      </button>
    </div>
  );
}

function Home({ onPick, onDaily }: { onPick(entry: AnyEntry): void; onDaily(entry: AnyEntry, seed: number): void }) {
  const [shop, setShop] = useState(false);
  const { pro: hasPro } = usePro();
  return (
    <div class="screen">
      {shop && <ProSheet onClose={() => setShop(false)} />}
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

      <Daily onPlay={onDaily} />

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
        <button class="foot-link" onClick={() => setShop(true)}>
          {hasPro ? 'You have Pro' : 'Go Pro'}
        </button>
        <span aria-hidden="true">·</span>
        {/* Ships inside the apps too, so it opens with no connection. */}
        <a href="./privacy.html">Privacy</a>
        <span aria-hidden="true">·</span>
        <span>Works offline</span>
      </footer>
    </div>
  );
}
