import { describe, expect, it } from 'vitest';
import { moveFor } from '../core/moves';
import { toMoveLog, type MoveLog } from '../core/replay';
import { BOT_TIERS } from '../core/types';
import { chooseBotMove, HEAVY_BOTS, TURN_GAMES } from './catalog';

const logFor = (id: string, players: number, seed: number): MoveLog => ({ gameId: id, seed, config: { players }, moves: [] });

describe('turn game catalog', () => {
  it('lists every turn-based game once, under its own id', () => {
    const ids = Object.keys(TURN_GAMES);
    expect(ids.length).toBe(37);
    for (const [id, game] of Object.entries(TURN_GAMES)) expect(game.id).toBe(id);
    expect(TURN_GAMES['mahjong']).toBeUndefined();
  });

  it('names only real games as heavy-bot games', () => {
    for (const id of HEAVY_BOTS) expect(TURN_GAMES[id], id).toBeDefined();
  });

  it('picks a legal move for every game, from the move log alone', () => {
    for (const [id, game] of Object.entries(TURN_GAMES)) {
      const players = game.minPlayers;
      const log = logFor(id, players, 12);
      const state = game.newGame(log.config, log.seed);
      const key = chooseBotMove({ log, seat: state.currentSeat, tier: 'medium', rngSeed: 7 });
      // A game that answers `allows` (Pool) is asked; every other is held to its list.
      expect(moveFor(game, state, key), `${id} bot move ${key}`).toBeDefined();
    }
  });

  it('gives the same move for the same request, and reads the tier', () => {
    const log = logFor('checkers', 2, 3);
    const request = { log, seat: 0, tier: 'expert' as const, rngSeed: 99 };
    expect(chooseBotMove(request)).toBe(chooseBotMove(request));
    for (const tier of BOT_TIERS) expect(typeof chooseBotMove({ ...request, tier })).toBe('string');
  });

  it('plays a whole game through the log, the way the worker does', () => {
    const game = TURN_GAMES['mancala']!;
    let state = game.newGame({ players: 2 }, 5);
    const moves: unknown[] = [];
    while (!state.result && moves.length < 400) {
      const log = toMoveLog(game, { players: 2 }, 5, moves);
      const key = chooseBotMove({ log, seat: state.currentSeat, tier: 'hard', rngSeed: moves.length + 1 });
      const move = state.legalMoves(state.currentSeat).find((m) => game.encodeMove(m) === key)!;
      expect(move).toBeDefined();
      moves.push(move);
      state = state.apply(move);
    }
    expect(state.result).not.toBeNull();
  });

  it('keeps a long game going without replaying it from the start each time', () => {
    // 2048 runs to hundreds of moves: this is the path that must stay cheap.
    const game = TURN_GAMES['2048']!;
    let state = game.newGame({ players: 1 }, 4);
    const moves: unknown[] = [];
    const started = Date.now();
    while (!state.result && moves.length < 120) {
      const log = toMoveLog(game, { players: 1 }, 4, moves);
      const key = chooseBotMove({ log, seat: 0, tier: 'medium', rngSeed: moves.length + 1 });
      const move = state.legalMoves(0).find((m) => game.encodeMove(m) === key);
      expect(move, `move ${moves.length}`).toBeDefined();
      moves.push(move);
      state = state.apply(move!);
    }
    expect(moves.length).toBeGreaterThan(20);
    // A fresh request for the same position (nothing kept to continue from) still agrees.
    const log = toMoveLog(game, { players: 1 }, 4, moves);
    const direct = chooseBotMove({ log, seat: 0, tier: 'medium', rngSeed: 5 });
    for (let i = 0; i < 6; i++) chooseBotMove({ log: toMoveLog(game, { players: 1 }, 9 + i, []), seat: 0, tier: 'easy', rngSeed: 1 });
    expect(chooseBotMove({ log, seat: 0, tier: 'medium', rngSeed: 5 })).toBe(direct);
    expect(Date.now() - started).toBeLessThan(20_000);
  });

  it('throws for a game it does not know', () => {
    expect(() => chooseBotMove({ log: logFor('tower-of-hanoi', 1, 1), seat: 0, tier: 'easy', rngSeed: 1 })).toThrow();
  });
});
