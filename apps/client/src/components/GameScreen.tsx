import { AUTO, Game, Scale } from 'phaser';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AUTOPLAY, AUTOPLAY_BOT_DELAY_MS, INSPECT } from '../autoplay';
import { maybeInterstitial } from '../ads';
import { finishDaily, finishPast, todayKey } from '../daily';
import { recordGame } from '../stats';
import { cue } from '../feedback';
import { isFirstPlay, markPlayed, tryItLine } from '../firstplay';
import { keyFor, load, record, scoreLine, streakLine, type Rivalry } from '../rivalry';
import { sceneBusy } from '../games/busy';
import { DPR } from '../games/crisp';
import { isCooking, type GameEntry } from '../games/registry';
import { outcomeOf, resultTitle } from '../outcome';
import { Session, type SeatController } from '../session';
import { TurnHint } from '../games/hint';
import { BackIcon } from './Art';
import { ResultSheet } from './ResultSheet';

interface Props {
  entry: GameEntry;
  seats: readonly SeatController[];
  /** Game option picked at the table, such as a puzzle level. */
  variant?: string;
  /** A fixed seed, for the daily, where everybody plays the same board. */
  seed?: number;
  /** The day this puzzle belongs to. Today keeps the streak going; a past day only gets ticked. */
  dailyKey?: string;
  onExit(): void;
}

const newSeed = () => Math.floor(Math.random() * 0xffffffff);

/** Longest the result sheet will wait for the board; a stuck scene must never swallow it. */
const RESULT_WAIT_MS = 1200;

export function GameScreen({ entry, seats: initialSeats, variant, seed: fixedSeed, dailyKey, onExit }: Props) {
  const [seats, setSeats] = useState(initialSeats);
  const [seed, setSeed] = useState(fixedSeed ?? newSeed);
  const [, setTick] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const rivalryKey = keyFor(entry.definition.id, seats);
  const [rivalry, setRivalry] = useState<Rivalry>(() => load(rivalryKey));
  // The coaching line, shown the first time this game is opened and gone once you move.
  const [coach, setCoach] = useState(() => isFirstPlay(entry.definition.id));
  // One game, one entry in the score, however many times the screen renders.
  const counted = useRef<Session<unknown> | null>(null);
  const gameRef = useRef<Game | null>(null);

  const session = useMemo(
    () => new Session(entry.definition, seats, seed, AUTOPLAY ? AUTOPLAY_BOT_DELAY_MS : entry.botDelayMs, variant),
    [entry, seats, seed, variant],
  );

  useEffect(() => {
    if (!coach) return;
    markPlayed(entry.definition.id);
    const timer = setTimeout(() => setCoach(false), 10_000);
    return () => clearTimeout(timer);
  }, [coach, entry]);

  useEffect(() => {
    let before = session.state;
    const unsubscribe = session.subscribe(() => {
      setTick((t) => t + 1);
      const after = session.state;
      if (after.result && counted.current !== (session as Session<unknown>)) {
        counted.current = session as Session<unknown>;
        // A game still cooking is playable but keeps nothing: it is out early on purpose, and
        // its numbers should not end up in anybody's record or running score.
        if (!isCooking(entry.definition.id)) {
          setRivalry(record(rivalryKey, seats, after.result));
          recordGame(entry.definition.id, seats, after.result);
        }
        // Today's puzzle only counts when it is actually finished, and an old one never
        // counts towards the streak, only towards the tick in the archive.
        if (dailyKey === todayKey()) finishDaily(dailyKey);
        else if (dailyKey) finishPast(dailyKey);
        // Between games is the only place an interstitial is ever allowed, and the rules in
        // ads.ts decide whether this one is even a candidate.
        void maybeInterstitial();
      }
      if (after.result) cue(outcomeOf(after.result, seats));
      else cue(entry.moveCue?.(before, after) ?? (seats[before.currentSeat]?.kind === 'bot' ? 'botPlace' : 'place'));
      if (session.moves.length > 0) setCoach(false);
      before = after;
    });
    const game: Game = new Game({
      type: AUTO,
      parent: host.current!,
      // Rendered at the screen's pixel density; scenes zoom their camera to match (games/crisp.ts).
      width: entry.size.width * DPR,
      height: entry.size.height * DPR,
      transparent: true,
      antialias: true,
      scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
      scene: [entry.createScene(session)],
    });
    // Test mode only: lets e2e ask a scene whether what it has drawn still matches the rules.
    if (AUTOPLAY || INSPECT) (window as unknown as { gamepalsTestGame?: Game }).gamepalsTestGame = game;
    gameRef.current = game;
    return () => {
      unsubscribe();
      session.dispose();
      if (AUTOPLAY || INSPECT) delete (window as unknown as { gamepalsTestGame?: Game }).gamepalsTestGame;
      gameRef.current = null;
      game.destroy(true);
    };
  }, [session, entry, seats, rivalryKey]);

  // The sheet waits for the board to finish the move that ended the game, so the reveal is not
  // given away before it happens: Four in a Row said who had won over a disc still in the air.
  // The cap is a safety net and not the usual path, because a scene that settles in a few hundred
  // milliseconds gets there long before it; a scene that celebrates with tweens, like the patience
  // win cascades, takes the whole beat, which is the right length to watch one.
  const [boardReady, setBoardReady] = useState(false);
  const finished = Boolean(session.state.result);
  useEffect(() => {
    if (!finished) {
      setBoardReady(false);
      return;
    }
    let stopped = false;
    const began = performance.now();
    const look = () => {
      if (stopped) return;
      if (!sceneBusy(gameRef.current) || performance.now() - began > RESULT_WAIT_MS) setBoardReady(true);
      else requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
    return () => {
      stopped = true;
    };
  }, [finished]);

  const { state } = session;
  const names = entry.sideNames(seats.length);
  const sideColors = entry.sideColors(seats.length);
  const sideName = (seat: number) => `${seats[seat]?.label} (${names[seat] ?? seat + 1})`;
  // What each seat is called at this table, for a game that writes its own status or result and
  // should call people the same thing its board does.
  const seatNames = seats.map((seat, i) => seat.label ?? names[i] ?? `Player ${i + 1}`);
  const Controls = entry.Controls;
  const thinking = session.thinkingSeat !== null || seats[state.currentSeat]?.kind === 'bot';
  const custom = entry.status?.(state, seatNames);

  const rematch = () => {
    // Rotate seats so a different side starts each game.
    setSeats([...seats.slice(1), seats[0]!]);
    setSeed(newSeed());
  };

  return (
    <div class="screen game-screen" style={{ '--game': entry.color }}>
      <header class="topbar">
        <button class="round-btn" onClick={onExit} aria-label="Back to the table">
          <BackIcon />
        </button>
        <h1>{entry.definition.name}</h1>
        <span />
      </header>
      <div class="play-area">
        <p class="status" aria-live="polite">
          {!state.result && (
            <span class={thinking ? 'turn-pill thinking' : 'turn-pill'} key={custom}>
              <span class="turn-dot" style={{ background: sideColors[state.currentSeat] ?? '#9B7BFF' }} />
              {custom ?? `${sideName(state.currentSeat)} ${thinking ? 'is thinking…' : 'to move'}`}
            </span>
          )}
        </p>
        {/* A fresh container per game: Phaser destroys the old game on its next frame, and on some
            devices (iPad) that frame comes late, so reusing the container briefly showed two boards. */}
        <div
          class="board"
          key={seed}
          ref={host}
          style={{ aspectRatio: `${entry.size.width} / ${entry.size.height}`, '--ar': entry.size.width / entry.size.height }}
        />
        {Controls && <Controls session={session} />}
        {/* How to play, until you have played: games with buttons say it there instead. */}
        {entry.hint && !Controls && !state.result && session.moves.length === 0 && <TurnHint>{entry.hint}</TurnHint>}
        {/* First time at this game: one line to get you going, gone as soon as you move. */}
        {coach && !state.result && <p class="coach">{tryItLine(entry.howTo.controls, entry.tryIt)}</p>}
      </div>
      {state.result && boardReady && (
        <ResultSheet
          title={entry.resultText?.(state, seatNames) ?? resultTitle(state.result, seats, sideName)}
          outcome={outcomeOf(state.result, seats)}
          score={scoreLine(rivalry, seats)}
          streak={streakLine(rivalry)}
          games={rivalry.games}
          onRematch={rematch}
          onChangeMode={onExit}
        />
      )}
    </div>
  );
}
