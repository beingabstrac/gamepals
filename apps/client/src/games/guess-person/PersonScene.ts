import { FACE_QUESTIONS, FACES, type GuessFace, type PersonMove, type PersonState, type Seat } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { focusRing, moveRing, onKeys } from '../keys';
import { PARTY_COLORS } from '../party';

const W = 640;
const H = 1000;
export const PERSON_SIZE = { width: W, height: H };
export const PERSON_COLORS = [COLORS.sky, COLORS.tomato];

const TOP_Y = 40;
/** The other player's last question, under yours. */
const SUB_Y = 76;
const COLS = 6;
const CARD_W = 98;
const CARD_H = 124;
const GAP = 6;
const BOARD_X = (W - COLS * CARD_W - (COLS - 1) * GAP) / 2;
const BOARD_Y = 100;
const BOARD_BOTTOM = BOARD_Y + 4 * (CARD_H + GAP) - GAP;
const MINE_Y = 672;
const CHIPS_Y = 738;
const CHIP_W = 196;
const CHIP_H = 52;
const CHIP_GAP = 10;

/** Question chips carry white words, so no yellow among them. */
const CHIP_COLORS = PARTY_COLORS.filter((c) => c !== COLORS.sunny);
const SKIN = ['#F6D3B3', '#E0AC7E', '#B97A4E', '#7A4B2E'];
const HAIR: Record<GuessFace['hair'], string> = { black: '#2B2A3A', brown: '#8A5A2B', ginger: '#E0701A', blonde: '#F2C94C', grey: '#B9B6C8', bald: '' };
/** Beards a shade darker than the hair, so a blonde or grey one still shows on a pale face. */
const BEARD: Record<GuessFace['hair'], string> = { black: '#2B2A3A', brown: '#6E4520', ginger: '#B8560F', blonde: '#C99A1E', grey: '#8F8BA3', bald: '#6E4520' };

/**
 * Guess the Person. The rules answer every question truthfully and work out which faces still fit;
 * the scene draws the board of the person looking, tips over each face as an answer rules it out, and
 * with two people on one phone covers the board between turns so nobody sees the other's.
 */
export class PersonScene extends Scene {
  private cards: GameObjects.Container[] = [];
  private view!: GameObjects.Container;
  private ring!: GameObjects.Graphics;
  private focus = 0;
  /** Whose board is on screen. */
  private viewer: Seat = 0;
  /** Two people on one phone: the board is covered until the next person taps. */
  private covered = false;
  /** Waiting for the one who just asked to hand the phone over. */
  private passing = false;
  private picked: number | null = null;
  private standingShown: boolean[] = [];

  constructor(private readonly session: Session<PersonMove>) {
    super('guess-person');
  }

  private get state(): PersonState {
    return this.session.state as PersonState;
  }

  private get people(): Seat[] {
    return this.session.seats.flatMap((s, i) => (s.kind === 'human' ? [i as Seat] : []));
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.viewer = this.people[0] ?? 0;
    // Two people on one phone: start covered, so the second player never sees the first board.
    this.covered = this.people.length === 2;
    this.cards = FACES.map((face, i) => this.makeCard(face, i));
    this.standingShown = FACES.map(() => true);
    this.view = this.add.container(0, 0).setDepth(5);
    this.ring = focusRing(this, CARD_W + 8, CARD_H + 8, 16);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => this.press(p.worldX, p.worldY));
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => this.changed());
    this.events.once('shutdown', off);
    this.draw();
  }

  private changed(): void {
    const state = this.state;
    this.picked = null;
    const last = state.last;
    if (last?.kind === 'ask') cue(last.answer ? 'place' : 'wall');
    // Two people: the one who just asked keeps the phone to read the answer, then hands it over.
    if (this.people.length === 2 && !state.result && last?.seat === this.viewer) this.passing = true;
    if (state.result) {
      this.passing = false;
      this.covered = false;
    }
    this.draw();
  }

  private cardAt(i: number): { x: number; y: number } {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return { x: BOARD_X + col * (CARD_W + GAP) + CARD_W / 2, y: BOARD_Y + row * (CARD_H + GAP) + CARD_H / 2 };
  }

  private chipAt(q: number): { x: number; y: number } {
    const col = q % 3;
    const row = Math.floor(q / 3);
    return { x: W / 2 + (col - 1) * (CHIP_W + CHIP_GAP), y: CHIPS_Y + row * (CHIP_H + CHIP_GAP) + CHIP_H / 2 };
  }

  private makeCard(face: GuessFace, i: number): GameObjects.Container {
    const { x, y } = this.cardAt(i);
    const g = this.add.graphics();
    g.fillStyle(toHex(COLORS.line), 1);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 5, CARD_W, CARD_H, 16);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 16);
    drawFace(g, face, i, 0, -12, 1);
    const name = sharpText(this, 0, CARD_H / 2 - 16, face.name, 18, COLORS.ink).setFontStyle('bold');
    return this.add.container(x, y, [g, name]).setDepth(1);
  }

  private viewerCanAct(): boolean {
    const state = this.state;
    return !state.result && !this.covered && !this.passing && state.currentSeat === this.viewer && this.session.isHumanTurn();
  }

  private press(x: number, y: number): void {
    this.ring.setVisible(false);
    if (this.covered) {
      this.covered = false;
      this.viewer = this.state.currentSeat;
      cue('tap');
      this.draw();
      return;
    }
    if (this.passing) {
      if (Math.abs(y - MINE_Y) < 40) this.pass();
      return;
    }
    if (!this.viewerCanAct()) return;
    for (let i = 0; i < FACES.length; i++) {
      const c = this.cardAt(i);
      if (Math.abs(x - c.x) <= CARD_W / 2 && Math.abs(y - c.y) <= CARD_H / 2) return this.pick(i);
    }
    if (this.picked !== null && Math.abs(y - MINE_Y) < 36 && x > W / 2 - 40) return this.nameFace();
    for (let q = 0; q < FACE_QUESTIONS.length; q++) {
      const c = this.chipAt(q);
      if (Math.abs(x - c.x) <= CHIP_W / 2 && Math.abs(y - c.y) <= CHIP_H / 2) return this.ask(q);
    }
  }

  private pass(): void {
    this.passing = false;
    this.covered = true;
    cue('tap');
    this.draw();
  }

  private pick(i: number): void {
    this.picked = this.picked === i ? null : i;
    cue('tap');
    this.draw();
  }

  private ask(q: number): void {
    if (!this.state.legalMoves(this.viewer).includes(`q${q}`)) return;
    this.session.play(`q${q}`);
  }

  private nameFace(): void {
    if (this.picked === null) return;
    cue('go');
    this.session.play(`n${this.picked}`);
  }

  private key(key: string): boolean {
    if (this.covered || this.passing) {
      if (key !== 'Enter' && key !== ' ') return false;
      if (this.covered) this.press(W / 2, H / 2);
      else this.pass();
      return true;
    }
    if (!this.viewerCanAct()) return false;
    // One ring walks the faces, then the questions under them.
    const total = FACES.length + FACE_QUESTIONS.length;
    const inFaces = this.focus < FACES.length;
    const cols = inFaces ? COLS : 3;
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols } as Record<string, number>)[key];
    if (step !== undefined) {
      let next = this.focus + step;
      if (inFaces && key === 'ArrowDown' && next >= FACES.length) next = FACES.length + Math.min(2, Math.floor((this.focus % COLS) / 2));
      if (!inFaces && key === 'ArrowUp' && next < FACES.length) next = FACES.length - COLS + Math.min(COLS - 1, ((this.focus - FACES.length) % 3) * 2);
      this.focus = Math.max(0, Math.min(total - 1, next));
      this.showRing();
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      if (this.focus < FACES.length) {
        if (this.picked === this.focus) this.nameFace();
        else this.pick(this.focus);
      } else this.ask(this.focus - FACES.length);
      return true;
    }
    return false;
  }

  private showRing(): void {
    if (this.focus < FACES.length) {
      const c = this.cardAt(this.focus);
      this.ring.clear().lineStyle(7, toHex(COLORS.grape), 1).strokeRoundedRect(-(CARD_W + 8) / 2, -(CARD_H + 8) / 2, CARD_W + 8, CARD_H + 8, 16);
      moveRing(this, this.ring, c.x, c.y);
    } else {
      const c = this.chipAt(this.focus - FACES.length);
      this.ring.clear().lineStyle(7, toHex(COLORS.grape), 1).strokeRoundedRect(-(CHIP_W + 8) / 2, -(CHIP_H + 8) / 2, CHIP_W + 8, CHIP_H + 8, 26);
      moveRing(this, this.ring, c.x, c.y);
    }
  }

  private who(seat: Seat): string {
    return this.session.seats[seat]?.label ?? `Player ${seat + 1}`;
  }

  private text(x: number, y: number, value: string, size: number, color: string, room = W - 40, bold = true): GameObjects.Text {
    const t = sharpText(this, x, y, value, size, color);
    if (bold) t.setFontStyle('bold');
    while (t.width > room && size > 12) {
      size -= 1;
      t.setFontSize(size);
    }
    this.view.add(t);
    return t;
  }

  private draw(): void {
    const state = this.state;
    this.view.removeAll(true);
    if (this.covered) return this.drawCover(state);
    const over = !!state.result;
    const standing = new Set(state.standing(this.viewer));
    FACES.forEach((_, i) => {
      const card = this.cards[i]!.setVisible(true);
      const up = standing.has(i);
      if (up !== this.standingShown[i]) {
        this.standingShown[i] = up;
        this.tweens.killTweensOf(card);
        // Tipped over: the card falls back on its hinge, or springs up again for the next board.
        if (!up) this.tweens.add({ targets: card, scaleY: 0.18, alpha: 0.45, duration: 320, delay: (i % COLS) * 30, ease: 'Bounce.easeOut' });
        else this.tweens.add({ targets: card, scaleY: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      }
      const g = this.add.graphics();
      if (this.picked === i) {
        const c = this.cardAt(i);
        g.lineStyle(6, toHex(COLORS.tomato), 1).strokeRoundedRect(c.x - CARD_W / 2 - 3, c.y - CARD_H / 2 - 3, CARD_W + 6, CARD_H + 6, 18);
      }
      this.view.add(g);
    });
    const other: Seat = this.viewer === 0 ? 1 : 0;
    this.text(W / 2, TOP_Y, this.headline(state), 28, COLORS.ink);
    this.text(W / 2, SUB_Y, this.subline(state), 18, COLORS.soft, W - 40, false);

    // Your own secret face, bottom left, so you can answer nothing wrong by mistake.
    const mine = FACES[state.secrets[this.viewer]!]!;
    const g = this.add.graphics();
    g.fillStyle(toHex(PERSON_COLORS[this.viewer]!), 1);
    g.fillRoundedRect(20, MINE_Y - 34, 250, 68, 34);
    drawFace(g, mine, state.secrets[this.viewer]!, 60, MINE_Y + 2, 0.46);
    this.view.add(g);
    this.text(175, MINE_Y, over ? `Yours: ${mine.name}` : `You are ${mine.name}`, 24, '#FFFFFF', 150);

    if (this.passing) {
      this.button(W - 170, MINE_Y, 280, 64, 'Pass the phone', COLORS.grape, DARK.grape);
    } else if (over) {
      const theirs = FACES[state.secrets[other]!]!;
      this.text(W - 170, MINE_Y, `Theirs: ${theirs.name}`, 24, COLORS.ink, 280);
    } else if (this.picked !== null && this.viewerCanAct()) {
      this.button(W - 170, MINE_Y, 280, 64, `It's ${FACES[this.picked]!.name}!`, COLORS.tomato, DARK.tomato);
    } else {
      this.text(W - 170, MINE_Y, this.viewerCanAct() ? 'Tap a face to name it' : '', 20, COLORS.soft, 280, false);
    }

    const asked = new Set(state.asked[this.viewer]!.map((a) => a.question));
    const live = this.viewerCanAct();
    FACE_QUESTIONS.forEach((q, i) => {
      const c = this.chipAt(i);
      const used = asked.has(i);
      const chip = this.add.graphics();
      const color = used ? COLORS.line : CHIP_COLORS[i % CHIP_COLORS.length]!;
      chip.fillStyle(toHex(used ? '#D8D3E6' : darker(color)), 1);
      chip.fillRoundedRect(c.x - CHIP_W / 2, c.y - CHIP_H / 2 + 5, CHIP_W, CHIP_H, CHIP_H / 2);
      chip.fillStyle(toHex(color), live || used ? 1 : 0.5);
      chip.fillRoundedRect(c.x - CHIP_W / 2, c.y - CHIP_H / 2, CHIP_W, CHIP_H, CHIP_H / 2);
      this.view.add(chip);
      this.text(c.x, c.y, q.text, 20, used ? COLORS.soft : '#FFFFFF', CHIP_W - 16);
    });
  }

  /** The top line: what you last learned, or how it ended. */
  private headline(state: PersonState): string {
    const last = state.last;
    if (state.result) {
      if (last?.kind !== 'name') return 'Game over';
      const who = this.who(last.seat);
      return last.right ? `${who} got it: ${FACES[last.face]!.name}!` : `${who} said ${FACES[last.face]!.name}. Wrong!`;
    }
    // Your own last answer, which the other player's turn must not push off the screen.
    const asked = state.asked[this.viewer]!;
    const mine = asked[asked.length - 1];
    if (mine) return `You asked "${FACE_QUESTIONS[mine.question]!.text}" ${mine.answer ? 'Yes!' : 'No.'}`;
    return this.viewerCanAct() ? 'Ask a question or name a face' : `${this.who(state.currentSeat)} is thinking…`;
  }

  /** The second line: what the other player last asked about your face. */
  private subline(state: PersonState): string {
    const other: Seat = this.viewer === 0 ? 1 : 0;
    const list = state.asked[other]!;
    const theirs = list[list.length - 1];
    if (!theirs || state.result) return '';
    return `${this.who(other)} asked "${FACE_QUESTIONS[theirs.question]!.text}" ${theirs.answer ? 'Yes' : 'No'}`;
  }

  private button(x: number, y: number, w: number, h: number, label: string, color: string, lip: string): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(lip), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 5, w, h, h / 2);
    g.fillStyle(toHex(color), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    this.view.add(g);
    this.text(x, y, label, 24, '#FFFFFF', w - 20);
  }

  private drawCover(state: PersonState): void {
    for (const card of this.cards) card.setVisible(false);
    const seat = state.currentSeat;
    const g = this.add.graphics();
    g.fillStyle(toHex(darker(PERSON_COLORS[seat]!)), 1);
    g.fillRoundedRect(40, BOARD_Y + 8, W - 80, 560, 44);
    g.fillStyle(toHex(PERSON_COLORS[seat]!), 1);
    g.fillRoundedRect(40, BOARD_Y, W - 80, 560, 44);
    this.view.add(g);
    this.text(W / 2, TOP_Y, `Pass the phone to ${this.who(seat)}`, 32, COLORS.ink);
    this.text(W / 2, BOARD_Y + 240, `${this.who(seat)}'s board`, 44, '#FFFFFF');
    this.text(W / 2, BOARD_Y + 310, 'Tap when only you are looking', 26, '#FFFFFF', W - 140, false);
  }

  /** The bands this board keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'headline', top: TOP_Y - 20, bottom: TOP_Y + 20 },
      { name: 'their question', top: SUB_Y - 12, bottom: SUB_Y + 12 },
      { name: 'board', top: BOARD_Y - CARD_H * 0.02, bottom: BOARD_BOTTOM + 5 },
      { name: 'yours', top: MINE_Y - 34, bottom: MINE_Y + 34 },
      { name: 'questions', top: CHIPS_Y, bottom: CHIPS_Y + 4 * (CHIP_H + CHIP_GAP) },
    ];
  }
}

const darker = (css: string): string => {
  const n = toHex(css);
  const r = Math.round(((n >> 16) & 255) * 0.8);
  const g = Math.round(((n >> 8) & 255) * 0.8);
  const b = Math.round((n & 255) * 0.8);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

/** One of the 24, drawn flat: hair behind, the face, then hat, glasses, beard and earrings on top. */
function drawFace(g: GameObjects.Graphics, face: GuessFace, index: number, x: number, y: number, s: number): void {
  const r = 30 * s;
  const hair = HAIR[face.hair];
  if (hair && face.long) {
    g.fillStyle(toHex(hair), 1);
    g.fillRoundedRect(x - r * 1.15, y - r * 0.9, r * 2.3, r * 2.2, r * 0.6);
  }
  g.fillStyle(toHex(SKIN[face.skin]!), 1);
  g.fillCircle(x - r * 0.98, y + r * 0.1, r * 0.2);
  g.fillCircle(x + r * 0.98, y + r * 0.1, r * 0.2);
  g.fillCircle(x, y, r);
  if (hair) {
    g.fillStyle(toHex(hair), 1);
    g.beginPath();
    g.arc(x, y - r * 0.05, r * 1.02, Math.PI * 1.02, Math.PI * 1.98, false);
    g.closePath();
    g.fillPath();
  }
  if (face.earrings) {
    g.fillStyle(toHex(COLORS.sunny), 1);
    g.fillCircle(x - r * 1.0, y + r * 0.42, r * 0.14);
    g.fillCircle(x + r * 1.0, y + r * 0.42, r * 0.14);
  }
  if (face.beard) {
    g.fillStyle(toHex(BEARD[face.hair]), 1);
    g.beginPath();
    g.arc(x, y + r * 0.1, r * 0.98, Math.PI * 0.05, Math.PI * 0.95, false);
    g.closePath();
    g.fillPath();
  }
  g.fillStyle(toHex(COLORS.ink), 1);
  g.fillCircle(x - r * 0.36, y - r * 0.08, r * 0.11);
  g.fillCircle(x + r * 0.36, y - r * 0.08, r * 0.11);
  if (face.smile) {
    g.fillStyle(toHex(face.beard ? '#FFFFFF' : COLORS.ink), 1);
    g.beginPath();
    g.arc(x, y + r * 0.3, r * 0.36, 0, Math.PI, false);
    g.closePath();
    g.fillPath();
  } else {
    g.lineStyle(Math.max(1.5, r * 0.08), toHex(face.beard ? '#FFFFFF' : COLORS.ink), 1);
    g.lineBetween(x - r * 0.22, y + r * 0.38, x + r * 0.22, y + r * 0.38);
  }
  if (face.glasses) {
    // A white rim under the frames, so they show on every skin tone.
    g.lineStyle(Math.max(2.5, r * 0.17), 0xffffff, 0.9);
    g.strokeCircle(x - r * 0.36, y - r * 0.08, r * 0.26);
    g.strokeCircle(x + r * 0.36, y - r * 0.08, r * 0.26);
    g.lineStyle(Math.max(1.5, r * 0.09), toHex(COLORS.ink), 1);
    g.strokeCircle(x - r * 0.36, y - r * 0.08, r * 0.26);
    g.strokeCircle(x + r * 0.36, y - r * 0.08, r * 0.26);
    g.lineBetween(x - r * 0.1, y - r * 0.08, x + r * 0.1, y - r * 0.08);
  }
  if (face.hat) {
    const color = toHex(PARTY_COLORS[index % PARTY_COLORS.length]!);
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - r * 1.3, y - r * 0.82, r * 2.6, r * 0.3, r * 0.15);
    g.fillRoundedRect(x - r * 0.8, y - r * 1.55, r * 1.6, r * 0.85, r * 0.3);
  }
}

export function personStatus(state: PersonState, names: readonly string[]): string | undefined {
  if (state.result) return undefined;
  const name = names[state.currentSeat] ?? `Player ${state.currentSeat + 1}`;
  const left = state.standing(state.currentSeat).length;
  return `${name} to ask. ${left} ${left === 1 ? 'face' : 'faces'} still standing`;
}
