import { BOT_TIERS, type BotTier } from '@gamepals/rules';
import { useState } from 'preact/hooks';
import { GameScreen } from './components/GameScreen';
import { COMING_SOON, GAMES, type GameEntry } from './games/registry';
import type { SeatController } from './session';

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

function Home({ onPick }: { onPick(entry: GameEntry): void }) {
  return (
    <div class="screen">
      <header class="hero">
        <h1>Game Pals</h1>
        <p class="muted">Every game. Every way to play.</p>
      </header>
      <div class="grid">
        {GAMES.map((entry) => (
          <button key={entry.definition.id} class="game-card" onClick={() => onPick(entry)}>
            <span class="emoji">{entry.emoji}</span>
            <span class="title">{entry.definition.name}</span>
            <span class="muted small">{entry.tagline}</span>
          </button>
        ))}
        {COMING_SOON.map((game) => (
          <div key={game.name} class="game-card disabled" aria-disabled="true">
            <span class="emoji">{game.emoji}</span>
            <span class="title">{game.name}</span>
            <span class="muted small">Coming soon</span>
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
    <div class="screen">
      <header class="topbar">
        <button class="ghost" onClick={onBack}>
          ← Games
        </button>
        <h1>
          {entry.emoji} {name}
        </h1>
        <span />
      </header>

      {modes.includes('bot') && (
        <section class="card">
          <h2>Play vs Bot</h2>
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
            class="primary"
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
          <h2>2 Players · Same device</h2>
          <p class="muted">Take turns on this phone or tablet.</p>
          <button
            class="primary"
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

      <section class="card disabled" aria-disabled="true">
        <h2>Online</h2>
        <p class="muted">Play friends, family and people worldwide. Coming soon.</p>
      </section>
    </div>
  );
}
