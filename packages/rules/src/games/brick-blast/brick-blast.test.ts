import { describe, expect, it } from 'vitest';
import {
  BRICK_BALL_R,
  BRICK_CANVAS,
  BRICK_TIERS,
  BRICK_WIN,
  brickBotInput,
  brickRect,
  crossingX,
  isTough,
  newBrickBlast,
  PADDLE,
  PADDLE_Y,
  stepBrick,
  WALL,
  type BrickBall,
  type BrickInput,
  type BrickState,
  type BrickTier,
} from './index';

const stay: BrickInput = { x: null };
const run = (s: BrickState, steps: number, inputs: (s: BrickState) => [BrickInput, BrickInput] = () => [stay, stay]) => {
  for (let i = 0; i < steps && !s.result; i++) s = stepBrick(s, inputs(s)).state;
  return s;
};
const bots = (a: BrickTier, b: BrickTier) => (s: BrickState): [BrickInput, BrickInput] => [brickBotInput(s, 0, a), brickBotInput(s, 1, b)];
const ball = (over: Partial<BrickBall>): BrickBall => ({ x: 300, y: 450, vx: 0, vy: 0, held: 0, owner: 0, bounces: 0, ...over });
const overlaps = (b: BrickBall, k: number) => {
  const r = brickRect(k);
  const nx = Math.min(Math.max(b.x, r.x), r.x + r.w);
  const ny = Math.min(Math.max(b.y, r.y), r.y + r.h);
  return (b.x - nx) ** 2 + (b.y - ny) ** 2 < (BRICK_BALL_R - 3) ** 2;
};
const clear = (s: BrickState): BrickState => ({ ...s, bricks: s.bricks.map(() => 0) });

describe('brick blast', () => {
  it('the wall fits across the canvas, the middle rows tough, clear of both paddles', () => {
    const last = brickRect(WALL.cols * WALL.rows - 1);
    expect(brickRect(0).x).toBeGreaterThanOrEqual(0);
    expect(last.x + last.w).toBeLessThanOrEqual(BRICK_CANVAS.width);
    expect(brickRect(0).y).toBeGreaterThan(PADDLE_Y[1] + 150);
    expect(last.y + last.h).toBeLessThan(PADDLE_Y[0] - 150);
    expect(newBrickBlast(1).bricks.filter((b, i) => b === 2 && isTough(i)).length).toBe(WALL.cols * 2);
  });

  it('both balls sit on their paddles through the countdown, then launch toward the wall', () => {
    let s = newBrickBlast(3);
    s = run(s, 100);
    expect(s.phase).toBe('countdown');
    expect(s.balls[0].held).toBeGreaterThan(0);
    s = run(s, 240);
    expect(s.balls[0].vy).toBeLessThan(0);
    expect(s.balls[1].vy).toBeGreaterThan(0);
  });

  it('a paddle only moves so fast, and never off the canvas', () => {
    let s = run(newBrickBlast(1), 10);
    const before = s.paddles[0];
    s = stepBrick(s, [{ x: 0 }, stay]).state;
    expect(before - s.paddles[0]).toBeLessThanOrEqual(1100 / 120 + 1e-9);
    s = run(s, 200, () => [{ x: -500 }, stay]);
    expect(s.paddles[0]).toBe(PADDLE.w / 2);
  });

  it('a ball hitting a brick bounces back and the brick goes; a tough one cracks first', () => {
    let s: BrickState = { ...run(newBrickBlast(1), 200), balls: [ball({ x: 40, y: 600, vy: -500 }), ball({ x: 300, y: 150, held: 10, owner: 1 })] as [BrickBall, BrickBall] };
    const broken: number[] = [];
    for (let i = 0; i < 120 && s.balls[0].vy < 0; i++) {
      const out = stepBrick(s, [stay, stay]);
      broken.push(...out.events.broken);
      s = out.state;
    }
    expect(s.balls[0].vy).toBeGreaterThan(0);
    expect(broken).toEqual([(WALL.rows - 1) * WALL.cols]);
    // Straight into a tough brick: it takes two goes.
    const tough = 3 * WALL.cols;
    s = { ...s, bricks: s.bricks.map((_, i) => (i === tough ? 2 : i === tough - WALL.cols ? 2 : 0)), balls: [ball({ x: 40, y: 600, vy: -500 }), s.balls[1]] };
    const cracked: number[] = [];
    for (let i = 0; i < 200 && s.balls[0].vy < 0; i++) {
      const out = stepBrick(s, [stay, stay]);
      cracked.push(...out.events.cracked);
      s = out.state;
    }
    expect(cracked).toEqual([tough]);
    expect(s.bricks[tough]).toBe(1);
  });

  it('a paddle returns a ball, steeper off its edge than its middle', () => {
    const base = clear(run(newBrickBlast(1), 200));
    const hit = (dx: number) => {
      let s: BrickState = { ...base, balls: [ball({ x: base.paddles[0] + dx, y: 760, vy: 500 }), ball({ held: 10, owner: 1 })] };
      for (let i = 0; i < 60 && s.balls[0].vy > 0; i++) s = stepBrick(s, [stay, stay]).state;
      return s.balls[0];
    };
    const middle = hit(0);
    const edge = hit(55);
    expect(middle.vy).toBeLessThan(0);
    expect(middle.owner).toBe(0);
    expect(Math.abs(middle.vx)).toBeLessThan(1);
    expect(edge.vx).toBeGreaterThan(300);
  });

  it('a ball past a paddle is a point to the other end, and goes back to be served by who let it by', () => {
    const base = clear(run(newBrickBlast(1), 200));
    let s: BrickState = { ...base, balls: [ball({ x: 40, y: 150, vy: -600, owner: 0 }), ball({ held: 10, owner: 1 })] };
    let scored = null;
    for (let i = 0; i < 100 && scored === null; i++) {
      const out = stepBrick(s, [stay, { x: 560 }]);
      scored = out.events.goal;
      s = out.state;
    }
    expect(scored).toBe(0);
    expect(s.scores).toEqual([1, 0]);
    expect(s.balls[0].held).toBeGreaterThan(0);
    expect(s.balls[0].owner).toBe(1);
  });

  it('first to five wins', () => {
    const base = clear(run(newBrickBlast(1), 200));
    let s: BrickState = { ...base, scores: [BRICK_WIN - 1, 2], balls: [ball({ x: 40, y: 150, vy: -600 }), ball({ held: 10, owner: 1 })] };
    s = run(s, 100, () => [stay, { x: 560 }]);
    expect(s.result).toEqual({ winners: [0], draw: false });
  });

  it('works out where a ball crosses a line, bouncing off the sides', () => {
    expect(Math.abs(crossingX(ball({ x: 300, y: 500, vx: 0, vy: 300 }), 800)! - 300)).toBeLessThan(1e-6);
    const x = crossingX(ball({ x: 500, y: 400, vx: 400, vy: 400 }), 800)!;
    // 400 across from 500 on a 578 track bounces off the right wall back to 1178 - 900 + 11.
    expect(Math.abs(x - (2 * (BRICK_CANVAS.width - BRICK_BALL_R) - 900))).toBeLessThan(1e-6);
    expect(crossingX(ball({ vy: -300 }), 800)).toBeNull();
  });

  it('the better bot wins, and a match between bots ends', { timeout: 60_000 }, () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = run(newBrickBlast(seed), 120 * 600, bots(BRICK_TIERS.expert, BRICK_TIERS.easy));
      expect(s.result).not.toBeNull();
      if (s.result?.winners[0] === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('a cleared wall builds back, but never on top of a ball', () => {
    const base = clear(run(newBrickBlast(1), 200));
    const inWall = stepBrick({ ...base, balls: [ball({ y: 450, vy: -300 }), ball({ held: 10, owner: 1 })] }, [stay, stay]);
    expect(inWall.events.rebuilt).toBe(false);
    const clearOf = stepBrick({ ...base, balls: [ball({ y: 700, vy: 300 }), ball({ held: 10, owner: 1 })] }, [stay, stay]);
    expect(clearOf.events.rebuilt).toBe(true);
    expect(clearOf.state.bricks).toEqual(newBrickBlast(1).bricks);
  });

  it('invariant, every step of bot play: bricks only lose hits unless the wall rebuilds, scores only climb by one, balls stay on the canvas across', () => {
    let s = newBrickBlast(9);
    for (let i = 0; i < 120 * 300 && !s.result; i++) {
      const out = stepBrick(s, bots(BRICK_TIERS.medium, BRICK_TIERS.hard)(s));
      const next = out.state;
      if (out.events.rebuilt) expect(s.bricks.every((b) => !b)).toBe(true);
      else next.bricks.forEach((b, k) => expect(b <= s.bricks[k]! && b >= 0).toBe(true));
      expect(next.scores[0] + next.scores[1] - s.scores[0] - s.scores[1]).toBeLessThanOrEqual(2);
      for (const b of next.balls) expect(b.x >= BRICK_BALL_R - 1e-9 && b.x <= BRICK_CANVAS.width - BRICK_BALL_R + 1e-9).toBe(true);
      for (const b of next.balls) expect(b.held > 0 || !next.bricks.some((h, k) => h && overlaps(b, k))).toBe(true);
      s = next;
    }
  });
});
