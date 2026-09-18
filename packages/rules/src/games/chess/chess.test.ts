import { describe, expect, it } from 'vitest';
import { replay, toMoveLog } from '../../core/replay';
import { createRng } from '../../core/rng';
import type { BotTier } from '../../core/types';
import {
  chess,
  chessFromFen,
  ChessState,
  KNIGHT,
  newChess,
  perft,
  squareIndex,
  typeOf,
  type ChessMove,
} from './index';

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -';
const ENDGAME = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -';
const TRICKY = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ -';
const at = (state: ChessState, square: string) => state.board[squareIndex(square)]!;

describe('chess move generation (perft)', () => {
  it('matches the published counts from the start', () => {
    const state = newChess();
    expect(perft(state.position, 1)).toBe(20);
    expect(perft(state.position, 2)).toBe(400);
    expect(perft(state.position, 3)).toBe(8902);
    expect(perft(state.position, 4)).toBe(197_281);
  });

  it('matches them in positions full of castling, en passant and promotions', () => {
    expect(perft(chessFromFen(KIWIPETE).position, 1)).toBe(48);
    expect(perft(chessFromFen(KIWIPETE).position, 2)).toBe(2039);
    expect(perft(chessFromFen(KIWIPETE).position, 3)).toBe(97_862);
    expect(perft(chessFromFen(ENDGAME).position, 3)).toBe(2812);
    expect(perft(chessFromFen(ENDGAME).position, 4)).toBe(43_238);
    expect(perft(chessFromFen(TRICKY).position, 2)).toBe(1486);
    expect(perft(chessFromFen(TRICKY).position, 3)).toBe(62_379);
  });
});

describe('chess rules', () => {
  it('castles both ways, but never through an attacked square', () => {
    const free = chessFromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -');
    expect(free.legalMoves(0)).toContain('e1g1');
    expect(free.legalMoves(0)).toContain('e1c1');
    const rook = free.apply('e1g1');
    expect(typeOf(at(rook, 'g1'))).toBe(6);
    expect(typeOf(at(rook, 'f1'))).toBe(4);
    expect(at(rook, 'h1')).toBe(0);

    // A black rook on f8 covers f1, so only the queen side is open.
    const watched = chessFromFen('r4rk1/8/8/8/8/8/8/R3K2R w KQ -');
    expect(watched.legalMoves(0)).not.toContain('e1g1');
    expect(watched.legalMoves(0)).toContain('e1c1');
  });

  it('loses the right once the king has moved', () => {
    const after = chessFromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -').apply('e1e2').apply('e8e7').apply('e2e1').apply('e7e8');
    expect(after.legalMoves(0)).not.toContain('e1g1');
    expect(after.legalMoves(0)).not.toContain('e1c1');
  });

  it('captures en passant, and only on the turn it is offered', () => {
    const offered = chessFromFen('4k3/8/8/8/3pP3/8/8/4K3 b - e3');
    expect(offered.legalMoves(1)).toContain('d4e3');
    const taken = offered.apply('d4e3');
    expect(at(taken, 'e4')).toBe(0);
    expect(typeOf(at(taken, 'e3'))).toBe(1);
    // The same position without the offer: no capture.
    expect(chessFromFen('4k3/8/8/8/3pP3/8/8/4K3 b - -').legalMoves(1)).not.toContain('d4e3');
  });

  it('promotes to any of the four pieces', () => {
    const state = chessFromFen('4k3/P7/8/8/8/8/8/4K3 w - -');
    for (const move of ['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n']) expect(state.legalMoves(0)).toContain(move);
    expect(typeOf(at(state.apply('a7a8n'), 'a8'))).toBe(KNIGHT);
    expect(typeOf(at(state.apply('a7a8q'), 'a8'))).toBe(5);
  });

  it('ends on checkmate', () => {
    const mated = newChess().apply('f2f3').apply('e7e5').apply('g2g4').apply('d8h4');
    expect(mated.result).toEqual({ winners: [1], draw: false });
    expect(mated.ending).toBe('Checkmate. Black wins');
    expect(mated.legalMoves(0)).toEqual([]);
    expect(() => mated.apply('e1f2')).toThrow();
  });

  it('ends on stalemate', () => {
    const state = chessFromFen('7k/5Q2/6K1/8/8/8/8/8 b - -');
    expect(state.result).toEqual({ winners: [], draw: true });
    expect(state.ending).toBe('Stalemate, it is a draw');
  });

  it('draws after 50 moves with no capture or pawn move', () => {
    const start = chessFromFen('4k3/8/8/8/8/8/R7/4K3 w - -');
    const waiting = new ChessState({ ...start.position, halfmove: 99 }, [], null, null);
    expect(waiting.apply('a2a3').result).toEqual({ winners: [], draw: true });
    expect(waiting.apply('a2a3').ending).toBe('Draw: 50 moves with no capture or pawn move');
  });

  it('draws when the same position comes up three times', () => {
    let state = newChess();
    for (const move of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) state = state.apply(move);
    expect(state.result).toEqual({ winners: [], draw: true });
    expect(state.ending).toBe('Draw: the same position three times');
  });

  it('draws when nobody has enough pieces to mate', () => {
    expect(chessFromFen('8/8/4k3/8/8/4K3/8/8 w - -').ending).toBe('Draw: not enough pieces to mate');
    expect(chessFromFen('8/8/4k3/8/5N2/4K3/8/8 w - -').ending).toBe('Draw: not enough pieces to mate');
    expect(chessFromFen('8/8/4k3/8/5R2/4K3/8/8 w - -').result).toBeNull();
  });

  it('rejects out-of-turn and illegal moves', () => {
    const state = newChess();
    expect(state.legalMoves(1)).toEqual([]);
    expect(() => state.apply('e7e5')).toThrow();
    expect(() => state.apply('e2e5')).toThrow();
    expect(() => state.apply('nonsense')).toThrow();
  });
});

describe('chess bots', () => {
  it('finds mate in one', () => {
    const state = chessFromFen('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - -');
    for (const tier of ['hard', 'expert'] as const) {
      expect(chess.createBot(tier).chooseMove(state, 0, createRng(3)), tier).toBe('a1a8');
    }
  });

  it('takes a free queen', () => {
    const state = chessFromFen('4k3/8/8/3q4/4P3/8/8/4K3 w - -');
    expect(chess.createBot('hard').chooseMove(state, 0, createRng(1))).toBe('e4d5');
  });

  it('plays a whole game with only legal moves, and replays exactly', () => {
    const tiers: BotTier[] = ['medium', 'easy'];
    const bots = tiers.map((tier) => chess.createBot(tier));
    const rng = createRng(11);
    let state = chess.newGame({ players: 2 }, 1) as ChessState;
    const moves: ChessMove[] = [];
    while (!state.result && moves.length < 120) {
      const move = bots[state.currentSeat]!.chooseMove(state, state.currentSeat, rng);
      expect(state.legalMoves(state.currentSeat)).toContain(move);
      moves.push(move);
      state = state.apply(move);
    }
    const replayed = replay(chess, toMoveLog(chess, { players: 2 }, 1, moves)) as ChessState;
    expect(replayed.board).toEqual(state.board);
  });

  // A whole game of our own engine, hard against easy: the other bot tournaments all say so too.
  it('Zed beats Pip on material', { timeout: 120_000 }, () => {
    const bots: Record<string, ReturnType<typeof chess.createBot>> = { hard: chess.createBot('hard'), easy: chess.createBot('easy') };
    const rng = createRng(5);
    let state = newChess();
    const worth = [0, 1, 3, 3, 5, 9, 0];
    while (!state.result && state.history.length < 200) {
      const tier = state.currentSeat === 0 ? 'hard' : 'easy';
      state = state.apply(bots[tier]!.chooseMove(state, state.currentSeat, rng));
      if (state.board.filter((p) => p !== 0).length < 20) break;
    }
    const count = (color: number) => state.board.filter((p) => p !== 0 && (p & 8 ? 1 : 0) === color).reduce((sum, p) => sum + worth[p & 7]!, 0);
    expect(count(0)).toBeGreaterThan(count(1));
  });
});
