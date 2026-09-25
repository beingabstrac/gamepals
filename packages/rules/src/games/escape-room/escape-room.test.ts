import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { replay } from '../../core/replay';
import { escapeCount, escapeRoom, ESCAPE_ROOMS, makeRooms, newEscape } from './index';

describe('escape room', () => {
  it('each code is the counts of the lock things; look-alikes do not count', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rooms = makeRooms(seed);
      expect(rooms.length).toBe(ESCAPE_ROOMS);
      rooms.forEach((room, r) => {
        expect(room.lock.length).toBe(r + 2);
        expect(room.code).toBe(room.lock.map((t) => String(escapeCount(room, t))).join(''));
        for (const d of room.code) expect(Number(d)).toBeGreaterThanOrEqual(1);
        // Nothing hidden in the first room; every hidden thing is in a hiding place that exists.
        if (r === 0) expect(room.hideouts.length).toBe(0);
        for (const p of room.things) if (p.inside >= 0) expect(room.hideouts[p.inside]).toBeDefined();
        room.hideouts.forEach((_, h) => expect(room.things.filter((p) => p.inside === h).length).toBeLessThanOrEqual(8));
        // No two things in the open share a spot.
        const open = room.things.filter((p) => p.inside < 0).map((p) => `${p.wall}:${p.x}:${p.y}`);
        expect(new Set(open).size).toBe(open.length);
      });
      const last = rooms[ESCAPE_ROOMS - 1]!;
      expect(last.things.some((p) => p.odd && p.thing === last.lock[0])).toBe(true);
    }
  });

  it('a wrong code is a try and stays; the right one moves on; wrong lengths are not moves', () => {
    const s = newEscape(4);
    const code = s.current.code;
    const wrong = s.apply(`c${code === '11' ? '12' : '11'}`);
    expect(wrong.room).toBe(0);
    expect(wrong.tries).toBe(1);
    expect(wrong.last?.right).toBe(false);
    const right = wrong.apply(`c${code}`);
    expect(right.room).toBe(1);
    expect(() => s.apply('c1')).toThrow();
    expect(() => s.apply(`c${code}1`)).toThrow();
    expect(() => s.apply('open')).toThrow();
  });

  it('three rooms end it; test play gets out and the referee replays it', () => {
    let s = escapeRoom.newGame({ players: 1 }, 6);
    const bot = escapeRoom.createBot('easy');
    const rng = createRng(6);
    const moves: string[] = [];
    while (!s.result) {
      const m = bot.chooseMove(s, 0, rng);
      moves.push(m);
      s = s.apply(m);
    }
    expect(moves.length).toBe(ESCAPE_ROOMS + 1);
    expect(replay(escapeRoom, { gameId: 'escape-room', seed: 6, config: { players: 1 }, moves }).result).toEqual(s.result);
  });
});
