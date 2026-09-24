import {
  CAR_H,
  CAR_Y,
  newRoadDodge,
  ROAD,
  ROAD_CANVAS,
  ROAD_LIVES,
  ROAD_STEP,
  ROAD_TIERS,
  roadBotInput,
  rowLanes,
  rowY,
  ROW_GAP,
  ROW_H,
  stepRoad,
  type RoadEvents,
  type RoadInput,
  type RoadState,
  type Seat,
} from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { COLORS, DARK, toHex } from '../../theme';
import type { RealtimeSceneOptions } from '../air-hockey/AirHockeyScene';
import { fitCamera, sharpText } from '../crisp';
import { applySpeed, SPEED } from '../../autoplay';
import { facing, onDuelKeys } from '../duel';

export const ROAD_SIZE = { width: ROAD_CANVAS.width, height: ROAD_CANVAS.height };
export const ROAD_COLORS = [COLORS.sky, COLORS.tomato];

const W = ROAD_CANVAS.width;
const H = ROAD_CANVAS.height;
const SEAT_HEX = ROAD_COLORS.map(toHex);
const SEAT_DARK = [DARK.sky, DARK.tomato].map(toHex);
const LANE_W = ROAD.width / ROAD.lanes;
const TRAFFIC = [COLORS.sunny, COLORS.mint, COLORS.grape, COLORS.peach, COLORS.bubblegum];
const TRAFFIC_DARK = [DARK.sunny, DARK.mint, DARK.grape, DARK.peach, DARK.bubblegum];
const laneX = (x: number) => LANE_W / 2 + x * LANE_W;

/**
 * Road Dodge. The rules roll both roads and steer both cars; the scene gives each player their
 * half of the phone as a road coming at them (the top one turned round), with lane lines that
 * scroll, the traffic as chunky toy cars, and hearts that go when you are bumped.
 */
export class RoadScene extends Scene {
  private state: RoadState;
  private accumulator = 0;
  private ended = false;
  private queued: [-1 | 0 | 1, -1 | 0 | 1] = [0, 0];
  private art: GameObjects.Graphics[] = [];
  private banner!: GameObjects.Text;
  private tilt: [number, number] = [0, 0];

  constructor(private readonly options: RealtimeSceneOptions) {
    super('road-dodge');
    this.state = newRoadDodge(options.seed);
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.input.addPointer(3);
    for (const seat of [0, 1] as const) {
      const road = this.add.container(seat === 0 ? 0 : W, H / 2).setAngle(seat === 0 ? 0 : 180);
      const art = this.add.graphics();
      road.add(art);
      this.art.push(art);
    }
    this.banner = sharpText(this, W / 2, H / 2, '', 50, COLORS.ink).setDepth(10).setFontStyle('bold').setStroke('#FFFFFF', 8);
    // A tap on the left of your road moves you a lane left; on the right, a lane right.
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const seat: Seat = p.worldY > H / 2 ? 0 : 1;
      if (this.options.seats[seat]?.kind !== 'human') return;
      const x = seat === 0 ? p.worldX : W - p.worldX;
      this.queued[seat] = x < W / 2 ? -1 : 1;
    });
    onDuelKeys(this, this.options.seats, (seat, action) => {
      if (action === 'left') this.queued[seat] = -1;
      if (action === 'right') this.queued[seat] = 1;
    });
    this.shout('Ready…');
    this.options.onScore([ROAD_LIVES, ROAD_LIVES]);
  }

  update(_time: number, delta: number): void {
    if (!this.ended) {
      this.accumulator += (Math.min(delta, 100) * SPEED) / 1000;
      while (this.accumulator >= ROAD_STEP) {
        this.accumulator -= ROAD_STEP;
        const was = this.state.phase;
        const { state, events } = stepRoad(this.state, [this.inputFor(0), this.inputFor(1)]);
        this.state = state;
        if (was === 'countdown' && state.phase === 'play') this.shout('Go!');
        this.handle(events);
        if (state.result) {
          this.ended = true;
          this.time.delayedCall(1000, () => this.options.onEnd(state.result!));
          break;
        }
      }
    }
    this.tilt = [this.tilt[0] * 0.9, this.tilt[1] * 0.9];
    this.draw();
  }

  private inputFor(seat: Seat): RoadInput {
    const controller = this.options.seats[seat];
    if (controller?.kind === 'bot') return roadBotInput(this.state, seat, ROAD_TIERS[controller.tier]);
    const steer = this.queued[seat];
    this.queued[seat] = 0;
    return { steer };
  }

  private handle(events: RoadEvents): void {
    for (const seat of events.steered) {
      this.options.onCue('tap');
      this.tilt[seat] = this.state.cars[seat].lane < this.state.cars[seat].x ? -1 : 1;
    }
    for (const seat of events.bumped) {
      this.options.onCue(events.out.includes(seat) ? 'goal' : 'thud');
      this.cameras.main.shake(200, 0.01);
      this.options.onScore([this.state.cars[0].lives, this.state.cars[1].lives]);
    }
    if (events.out.length) {
      const [out] = events.out;
      this.shout(events.out.length > 1 ? 'Both out!' : `${out === 0 ? 'Red' : 'Blue'} wins!`);
    }
  }

  private shout(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6).setAngle(facing(this.options.seats, 0));
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 800, duration: 250 });
  }

  /** A chunky toy car, pointing up its road (toward the middle of the phone). */
  private car(g: GameObjects.Graphics, x: number, y: number, color: number, dark: number, tilt = 0, rear = false): void {
    const w = LANE_W * 0.52;
    const h = CAR_H;
    g.fillStyle(0x000000, 0.12);
    g.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 7, w, h, 16);
    g.fillStyle(toHex(COLORS.ink), 1);
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) g.fillRoundedRect(x + dx * (w / 2 - 2) - 6, y + dy * h * 0.28 - 10, 12, 20, 5);
    g.fillStyle(dark, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 5, w, h, 16);
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - w / 2 + tilt * 3, y - h / 2, w, h - 4, 16);
    // The windscreen faces the way it is going: up the road for the player, down it for traffic.
    g.fillStyle(0xffffff, 0.75);
    const screenY = rear ? y + h * 0.06 : y - h * 0.3;
    g.fillRoundedRect(x - w * 0.32 + tilt * 3, screenY, w * 0.64, h * 0.22, 6);
  }

  private draw(): void {
    const s = this.state;
    for (const seat of [0, 1] as const) {
      const g = this.art[seat]!.clear();
      const car = s.cars[seat];
      g.fillStyle(toHex('#E9E6F2'), 1);
      g.fillRect(0, 0, ROAD.width, ROAD.height);
      g.fillStyle(SEAT_HEX[seat]!, 0.08);
      g.fillRect(0, 0, ROAD.width, ROAD.height);
      // Lane lines, dashed, rolling toward the player.
      const dash = 70;
      const off = s.distance % (dash * 2);
      g.fillStyle(0xffffff, 1);
      for (let l = 1; l < ROAD.lanes; l++)
        for (let y = -dash * 2 + off; y < ROAD.height; y += dash * 2) g.fillRoundedRect(l * LANE_W - 4, y, 8, dash, 4);
      // Traffic: every row near enough to see, one toy car per blocked lane.
      const first = Math.max(0, Math.floor((s.distance - 700 - ROAD.height) / ROW_GAP));
      for (let k = first; k < first + 6; k++) {
        const y = rowY(k, s.distance);
        if (y < -ROW_H || y > ROAD.height + ROW_H) continue;
        rowLanes(s.seed, k).forEach((blocked, l) => {
          if (!blocked) return;
          const c = (k * 3 + l) % TRAFFIC.length;
          this.car(g, laneX(l), y, toHex(TRAFFIC[c]!), toHex(TRAFFIC_DARK[c]!), 0, true);
        });
      }
      // The player's car, blinking while it is safe after a bump; gone once out.
      const blink = car.safe > 0 && Math.floor(car.safe * 10) % 2 === 0;
      if (car.lives > 0 && !blink) this.car(g, laneX(car.x), CAR_Y, SEAT_HEX[seat]!, SEAT_DARK[seat]!, this.tilt[seat]);
      // Hearts at the player's end of their road.
      for (let i = 0; i < ROAD_LIVES; i++) {
        const x = 40 + i * 40;
        const y = ROAD.height - 26;
        g.fillStyle(i < car.lives ? toHex(COLORS.tomato) : 0xd8d3e6, 1);
        g.fillCircle(x - 7, y - 4, 9);
        g.fillCircle(x + 7, y - 4, 9);
        g.fillTriangle(x - 15, y, x + 15, y, x, y + 16);
      }
    }
  }
}
