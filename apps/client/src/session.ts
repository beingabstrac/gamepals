import { createRng, type Bot, type BotTier, type GameDefinition, type GameState, type Rng } from '@gamepals/rules';

/** Who controls a seat. Online seats (`remote`) arrive in milestone M3. */
export type SeatController =
  | { readonly kind: 'human'; readonly label: string }
  | { readonly kind: 'bot'; readonly tier: BotTier; readonly label: string };

const DEFAULT_BOT_DELAY_MS = 450;

/**
 * One game in progress on this device. Every combination of local humans and bots
 * goes through this single code path; scenes only render `state` and call `play`.
 */
export class Session<M> {
  state: GameState<M>;
  readonly moves: M[] = [];
  private readonly rng: Rng;
  private readonly bots: (Bot<M> | undefined)[];
  private readonly listeners = new Set<() => void>();
  private botTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly definition: GameDefinition<M>,
    readonly seats: readonly SeatController[],
    readonly seed: number,
    /** Pause before each bot action, so animations finish and players can follow along. */
    private readonly botDelayMs = DEFAULT_BOT_DELAY_MS,
    /** Game option such as a puzzle level. */
    readonly variant?: string,
  ) {
    this.state = definition.newGame({ players: seats.length, variant }, seed);
    // Bots get their own stream so their choices don't shift the game's own randomness.
    this.rng = createRng(seed ^ 0x5bd1e995);
    this.bots = seats.map((seat) => (seat.kind === 'bot' ? definition.createBot(seat.tier) : undefined));
    this.scheduleBot();
  }

  isHumanTurn(): boolean {
    return !this.state.result && this.seats[this.state.currentSeat]?.kind === 'human';
  }

  /** Plays a move for the local human whose turn it is; ignored otherwise. */
  play(move: M): void {
    if (!this.isHumanTurn()) return;
    if (!this.state.legalMoves(this.state.currentSeat).includes(move)) return;
    this.commit(move);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    clearTimeout(this.botTimer);
    this.listeners.clear();
  }

  private commit(move: M): void {
    this.state = this.state.apply(move);
    this.moves.push(move);
    this.listeners.forEach((listener) => listener());
    this.scheduleBot();
  }

  private scheduleBot(): void {
    const seat = this.state.currentSeat;
    const bot = this.bots[seat];
    if (this.state.result || !bot) return;
    this.botTimer = setTimeout(() => this.commit(bot.chooseMove(this.state, seat, this.rng)), this.botDelayMs);
  }
}
