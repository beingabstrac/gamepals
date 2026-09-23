import { createRng, HEAVY_BOTS, isLegalMove, moveFor, type Bot, type BotTier, type GameDefinition, type GameState, type MoveLog } from '@gamepals/rules';
import { requestBotMove } from './bot/runner';

/** Who controls a seat. Online seats (`remote`) arrive in milestone M16. */
export type SeatController =
  | { readonly kind: 'human'; readonly label: string }
  | { readonly kind: 'bot'; readonly tier: BotTier; readonly label: string };

const DEFAULT_BOT_DELAY_MS = 450;

/**
 * Each bot decision gets its own seeded stream from the game seed and the move number, so the
 * worker and the main thread always pick the same move and games stay reproducible.
 */
const botSeed = (seed: number, ply: number) => (seed ^ 0x5bd1e995 ^ Math.imul(ply + 1, 0x9e3779b1)) >>> 0;

/**
 * One game in progress on this device. Every combination of local humans and bots
 * goes through this single code path; scenes only render `state` and call `play`.
 * Bots think in a worker (bot/runner.ts), so a deep search never freezes the board.
 */
export class Session<M> {
  state: GameState<M>;
  readonly moves: M[] = [];
  /** The seat whose bot is thinking right now, if any. */
  thinkingSeat: number | null = null;
  /** The same moves in their string form, kept as we go so bot requests are cheap to build. */
  private readonly encoded: string[] = [];
  /** Bots for the quick games, which think here rather than in the worker. */
  private readonly bots: (Bot<M> | undefined)[] = [];
  private readonly listeners = new Set<() => void>();
  private botTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

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
    this.scheduleBot();
  }

  isHumanTurn(): boolean {
    return !this.state.result && this.seats[this.state.currentSeat]?.kind === 'human';
  }

  /** Plays a move for the local human whose turn it is; ignored otherwise. */
  play(move: M): void {
    if (!this.isHumanTurn()) return;
    if (!isLegalMove(this.state, move)) return;
    this.commit(move);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.botTimer);
    this.listeners.clear();
  }

  private announce(): void {
    this.listeners.forEach((listener) => listener());
  }

  private commit(move: M): void {
    this.state = this.state.apply(move);
    this.moves.push(move);
    this.encoded.push(this.definition.encodeMove(move));
    this.announce();
    this.scheduleBot();
  }

  private scheduleBot(): void {
    const seat = this.state.currentSeat;
    const controller = this.seats[seat];
    if (this.state.result || controller?.kind !== 'bot') return;
    const ply = this.moves.length;
    this.botTimer = setTimeout(() => void this.playBot(seat, controller.tier, ply), this.botDelayMs);
  }

  /**
   * A scene whose moves take a varying time to show (a pool shot rolls for as long as it rolls) can
   * hold the bots until it has finished, rather than guess a delay. Null lets them go on the delay.
   */
  holdBots: (() => boolean) | null = null;

  private async playBot(seat: number, tier: BotTier, ply: number): Promise<void> {
    if (this.disposed || this.moves.length !== ply) return;
    if (this.holdBots?.()) {
      this.botTimer = setTimeout(() => void this.playBot(seat, tier, ply), 120);
      return;
    }
    const rngSeed = botSeed(this.seed, ply);
    // Quick bots decide here, from the live game: sending a message would cost more than the thinking.
    if (!HEAVY_BOTS.has(this.definition.id)) {
      const bot = (this.bots[seat] ??= this.definition.createBot(tier));
      this.commit(bot.chooseMove(this.state, seat, createRng(rngSeed)));
      return;
    }
    this.thinkingSeat = seat;
    this.announce();
    const log: MoveLog = {
      gameId: this.definition.id,
      seed: this.seed,
      config: { players: this.seats.length, variant: this.variant },
      moves: [...this.encoded],
    };
    let key: string;
    try {
      key = await requestBotMove({ log, seat, tier, rngSeed });
    } catch (error) {
      console.error('The bot could not pick a move', error);
      this.thinkingSeat = null;
      return;
    }
    // A rematch, a new game or a human move while the bot was thinking: that answer is stale.
    if (this.disposed || this.moves.length !== ply) return;
    this.thinkingSeat = null;
    const move = moveFor(this.definition, this.state, key);
    if (move === undefined) {
      console.error(`The bot picked a move that is not legal here: ${key}`);
      return;
    }
    this.commit(move);
  }
}
