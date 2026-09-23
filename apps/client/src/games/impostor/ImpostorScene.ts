import { WORD_SETS, type ImpostorMove, type ImpostorState } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import { cue } from '../../feedback';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';
import { PARTY_COLORS, PARTY_DARK } from '../party';

const W = 600;
const H = 820;
export const IMPOSTOR_SIZE = { width: W, height: H };

export const IMPOSTOR_COLORS = PARTY_COLORS;
const IMPOSTOR_DARK = PARTY_DARK;

/** The bands every phase draws in: a title, the middle, and the button along the bottom. */
const TITLE_Y = 70;
const MIDDLE_TOP = 130;
const MIDDLE_BOTTOM = 650;
const BUTTON_Y = 730;
const BUTTON_H = 84;

interface Hit {
  x: number;
  y: number;
  w: number;
  h: number;
  act: () => void;
}

/**
 * Impostor. The rules deal the cards and keep the phase; the scene is the phone going round. In the
 * reveal a cover says whose turn it is, a tap shows their card and a second tap hides it again for the
 * next person. Then the talk, with who starts and a clock; the vote, where the table picks a name and
 * presses Accuse; and, if they caught the impostor, the impostor's guess from six words.
 */
export class ImpostorScene extends Scene {
  private view!: GameObjects.Container;
  private hits: Hit[] = [];
  /** Whether the card in the reveal is face up, which is the scene's business, not the rules'. */
  private peeking = false;
  /** The name the table has tapped in the vote, before they press Accuse. */
  private picked: number | null = null;
  private talkStarted = 0;
  private clock: GameObjects.Text | null = null;
  private shownKey = '';

  constructor(private readonly session: Session<ImpostorMove>) {
    super('impostor');
  }

  private get state(): ImpostorState {
    return this.session.state as ImpostorState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.view = this.add.container(0, 0);
    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      const hit = this.hits.find((h) => Math.abs(p.worldX - h.x) <= h.w / 2 && Math.abs(p.worldY - h.y) <= h.h / 2);
      hit?.act();
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => {
      this.peeking = false;
      this.picked = null;
      this.draw();
    });
    this.events.once('shutdown', off);
    this.draw();
  }

  update(time: number): void {
    if (this.clock && this.state.phase === 'talk') {
      if (!this.talkStarted) this.talkStarted = time;
      const seconds = Math.floor((time - this.talkStarted) / 1000);
      this.clock.setText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
    }
  }

  private key(key: string): boolean {
    const state = this.state;
    const press = key === 'Enter' || key === ' ';
    if (state.phase === 'reveal' && press) {
      this.flip();
      return true;
    }
    if (state.phase === 'talk' && press) {
      this.play('talked');
      return true;
    }
    const n = Number(key) - 1;
    if (state.phase === 'vote') {
      if (Number.isInteger(n) && n >= 0 && n < state.players) {
        this.pick(n);
        return true;
      }
      if (press && this.picked !== null) {
        this.play(`v${this.picked}`);
        return true;
      }
    }
    if (state.phase === 'guess' && Number.isInteger(n) && n >= 0 && n < state.choices.length) {
      this.play(`g${n}`);
      return true;
    }
    return false;
  }

  private play(move: ImpostorMove): void {
    if (this.state.result || !this.session.isHumanTurn()) return;
    cue('place');
    this.session.play(move);
  }

  private flip(): void {
    if (!this.session.isHumanTurn()) return;
    if (!this.peeking) {
      this.peeking = true;
      cue('tap');
      this.draw();
      return;
    }
    this.play('seen');
  }

  private pick(seat: number): void {
    if (!this.session.isHumanTurn()) return;
    this.picked = seat;
    cue('tap');
    this.draw();
  }

  private name(seat: number): string {
    return this.session.seats[seat]?.label ?? `Player ${seat + 1}`;
  }

  private draw(): void {
    const state = this.state;
    const key = `${state.phase}.${state.turn}.${this.peeking}.${this.picked}`;
    const fresh = key !== this.shownKey;
    this.shownKey = key;
    this.view.removeAll(true);
    this.hits = [];
    this.clock = null;
    if (state.phase === 'reveal') this.drawReveal(state);
    else if (state.phase === 'talk') this.drawTalk(state);
    else if (state.phase === 'vote') this.drawVote(state);
    else if (state.phase === 'guess') this.drawGuess(state);
    else this.drawOver(state);
    if (fresh) {
      // Each new step springs in, so a pass of the phone always looks like something happened.
      this.view.setScale(0.94).setAlpha(0.6);
      this.view.setPosition((W * 0.06) / 2, (H * 0.06) / 2);
      this.tweens.killTweensOf(this.view);
      this.tweens.add({ targets: this.view, scale: 1, x: 0, y: 0, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    }
  }

  private title(text: string, color: string = COLORS.ink): void {
    const t = sharpText(this, W / 2, TITLE_Y, text, 34, color).setFontStyle('bold');
    this.fit(t, W - 40, 34);
    this.view.add(t);
  }

  private fit(text: GameObjects.Text, room: number, size: number): void {
    while (text.width > room && size > 14) {
      size -= 1;
      text.setFontSize(size);
    }
  }

  /** A candy button with a lip, and what it does when tapped. */
  private button(x: number, y: number, w: number, h: number, label: string, color: string, lip: string, act: () => void, size = 30): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(lip), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 6, w, h, h / 2.4);
    g.fillStyle(toHex(color), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2.4);
    const t = sharpText(this, x, y, label, size, '#FFFFFF').setFontStyle('bold');
    this.fit(t, w - 24, size);
    this.view.add([g, t]);
    this.hits.push({ x, y, w, h: h + 6, act });
  }

  private face(x: number, y: number, r: number, seat: number): void {
    const g = this.add.graphics();
    g.fillStyle(toHex(IMPOSTOR_DARK[seat % 8]!), 1);
    g.fillCircle(x, y + r * 0.1, r);
    g.fillStyle(toHex(IMPOSTOR_COLORS[seat % 8]!), 1);
    g.fillCircle(x, y, r);
    g.fillStyle(toHex(COLORS.ink), 1);
    g.fillCircle(x - r * 0.3, y - r * 0.08, r * 0.1);
    g.fillCircle(x + r * 0.3, y - r * 0.08, r * 0.1);
    g.fillEllipse(x, y + r * 0.28, r * 0.42, r * 0.2);
    this.view.add(g);
  }

  private card(color: number, lip: number): GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(lip, 1);
    g.fillRoundedRect(70, MIDDLE_TOP + 20 + 10, W - 140, MIDDLE_BOTTOM - MIDDLE_TOP - 40, 40);
    g.fillStyle(color, 1);
    g.fillRoundedRect(70, MIDDLE_TOP + 20, W - 140, MIDDLE_BOTTOM - MIDDLE_TOP - 40, 40);
    this.view.add(g);
    return g;
  }

  private drawReveal(state: ImpostorState): void {
    const seat = state.turn;
    const mid = (MIDDLE_TOP + MIDDLE_BOTTOM) / 2;
    if (!this.peeking) {
      this.title(`Pass the phone to ${this.name(seat)}`);
      // The cover: whose card this is, and nothing else.
      const g = this.card(toHex(IMPOSTOR_COLORS[seat % 8]!), toHex(IMPOSTOR_DARK[seat % 8]!));
      g.fillStyle(0xffffff, 0.18);
      for (let i = 0; i < 6; i++) g.fillCircle(130 + i * 70, MIDDLE_TOP + 70 + (i % 2) * 30, 14);
      this.face(W / 2, mid - 40, 70, seat);
      const who = sharpText(this, W / 2, mid + 80, this.name(seat), 40, '#FFFFFF').setFontStyle('bold');
      const only = sharpText(this, W / 2, mid + 130, 'Only you look!', 24, '#FFFFFF');
      this.view.add([who, only]);
      this.hits.push({ x: W / 2, y: mid, w: W - 140, h: MIDDLE_BOTTOM - MIDDLE_TOP, act: () => this.flip() });
      this.button(W / 2, BUTTON_Y, 360, BUTTON_H, 'Tap to look', COLORS.grape, DARK.grape, () => this.flip());
      return;
    }
    const card = state.cardFor(seat);
    this.title(`${this.name(seat)}, your card`);
    this.card(0xffffff, toHex(COLORS.line));
    const set = sharpText(this, W / 2, MIDDLE_TOP + 90, card.set, 26, COLORS.soft);
    this.view.add(set);
    if (card.impostor) {
      const you = sharpText(this, W / 2, mid - 10, 'You are the', 30, COLORS.ink);
      const word = sharpText(this, W / 2, mid + 50, 'IMPOSTOR', 58, COLORS.tomato).setFontStyle('bold');
      const tip = sharpText(this, W / 2, mid + 130, 'Blend in. Work out the word.', 22, COLORS.soft);
      this.fit(word, W - 180, 58);
      this.view.add([you, word, tip]);
    } else {
      const the = sharpText(this, W / 2, mid - 10, 'The word is', 30, COLORS.ink);
      const word = sharpText(this, W / 2, mid + 50, card.word!, 58, COLORS.grape).setFontStyle('bold');
      const tip = sharpText(this, W / 2, mid + 130, 'Keep it secret. Find the impostor.', 22, COLORS.soft);
      this.fit(word, W - 180, 58);
      this.fit(tip, W - 180, 22);
      this.view.add([the, word, tip]);
    }
    const last = seat === state.players - 1;
    this.button(W / 2, BUTTON_Y, 360, BUTTON_H, last ? 'Hide and start' : 'Hide and pass', COLORS.mint, DARK.mint, () => this.flip());
  }

  private drawTalk(state: ImpostorState): void {
    this.title('Talk time');
    const mid = (MIDDLE_TOP + MIDDLE_BOTTOM) / 2;
    this.card(0xffffff, toHex(COLORS.line));
    this.face(W / 2, MIDDLE_TOP + 130, 54, state.starter);
    const starts = sharpText(this, W / 2, MIDDLE_TOP + 225, `${this.name(state.starter)} starts`, 36, COLORS.ink).setFontStyle('bold');
    const round = sharpText(this, W / 2, mid + 50, 'Go round once. Each say one', 24, COLORS.soft);
    const round2 = sharpText(this, W / 2, mid + 82, `word about the ${WORD_SETS[state.set]!.name.toLowerCase()} word.`, 24, COLORS.soft);
    this.fit(round2, W - 180, 24);
    this.clock = sharpText(this, W / 2, mid + 160, '0:00', 44, COLORS.grape).setFontStyle('bold');
    this.view.add([starts, round, round2, this.clock]);
    this.button(W / 2, BUTTON_Y, 360, BUTTON_H, 'Time to vote', COLORS.tomato, DARK.tomato, () => this.play('talked'));
  }

  private drawVote(state: ImpostorState): void {
    this.talkStarted = 0;
    this.title('Who is the impostor?');
    const rows = Math.ceil(state.players / 2);
    const cellH = Math.min(118, (MIDDLE_BOTTOM - MIDDLE_TOP) / rows);
    const top = MIDDLE_TOP + (MIDDLE_BOTTOM - MIDDLE_TOP - rows * cellH) / 2;
    for (let seat = 0; seat < state.players; seat++) {
      const col = seat % 2;
      const row = Math.floor(seat / 2);
      const x = col === 0 ? W / 2 - 138 : W / 2 + 138;
      const y = top + row * cellH + cellH / 2;
      const on = this.picked === seat;
      const g = this.add.graphics();
      g.fillStyle(on ? toHex(IMPOSTOR_DARK[seat % 8]!) : toHex(COLORS.line), 1);
      g.fillRoundedRect(x - 128, y - cellH / 2 + 8 + 5, 256, cellH - 16, 26);
      g.fillStyle(on ? toHex(IMPOSTOR_COLORS[seat % 8]!) : 0xffffff, 1);
      g.fillRoundedRect(x - 128, y - cellH / 2 + 8, 256, cellH - 16, 26);
      this.view.add(g);
      this.face(x - 80, y, Math.min(30, cellH / 3.4), seat);
      const t = sharpText(this, x + 26, y, this.name(seat), 26, on ? '#FFFFFF' : COLORS.ink).setFontStyle('bold');
      this.fit(t, 150, 26);
      this.view.add(t);
      this.hits.push({ x, y, w: 256, h: cellH - 16, act: () => this.pick(seat) });
    }
    if (this.picked === null) {
      const t = sharpText(this, W / 2, BUTTON_Y, 'Agree on a name, then tap it', 24, COLORS.soft);
      this.view.add(t);
    } else {
      const seat = this.picked;
      this.button(W / 2, BUTTON_Y, 400, BUTTON_H, `Accuse ${this.name(seat)}`, COLORS.tomato, DARK.tomato, () => this.play(`v${seat}`));
    }
  }

  private drawGuess(state: ImpostorState): void {
    this.title(`Caught! ${this.name(state.impostor)} gets one guess`, COLORS.tomato);
    const words = WORD_SETS[state.set]!.words;
    const cellH = (MIDDLE_BOTTOM - MIDDLE_TOP) / 3;
    state.choices.forEach((word, i) => {
      const x = i % 2 === 0 ? W / 2 - 138 : W / 2 + 138;
      const y = MIDDLE_TOP + Math.floor(i / 2) * cellH + cellH / 2;
      this.button(x, y, 256, cellH - 30, words[word]!, IMPOSTOR_COLORS[(i + 3) % 8]!, IMPOSTOR_DARK[(i + 3) % 8]!, () => this.play(`g${i}`), 28);
    });
    const t = sharpText(this, W / 2, BUTTON_Y, `${this.name(state.impostor)}, which was the word?`, 24, COLORS.soft);
    this.fit(t, W - 40, 24);
    this.view.add(t);
  }

  private drawOver(state: ImpostorState): void {
    const impostorWon = state.result?.winners.includes(state.impostor) ?? false;
    this.title(impostorWon ? 'The impostor wins!' : 'Everyone else wins!', impostorWon ? COLORS.tomato : COLORS.mint);
    const mid = (MIDDLE_TOP + MIDDLE_BOTTOM) / 2;
    this.card(0xffffff, toHex(COLORS.line));
    this.face(W / 2, MIDDLE_TOP + 120, 54, state.impostor);
    const who = sharpText(this, W / 2, MIDDLE_TOP + 215, `${this.name(state.impostor)} was the impostor`, 28, COLORS.ink).setFontStyle('bold');
    this.fit(who, W - 180, 28);
    const was = sharpText(this, W / 2, mid + 50, 'The word was', 24, COLORS.soft);
    const word = sharpText(this, W / 2, mid + 105, state.secret, 50, COLORS.grape).setFontStyle('bold');
    this.fit(word, W - 180, 50);
    const how =
      state.accused !== null && state.accused !== state.impostor
        ? `The table picked ${this.name(state.accused)}.`
        : state.guessed === state.word
          ? 'Caught, but guessed it right.'
          : `Caught, and guessed ${WORD_SETS[state.set]!.words[state.guessed ?? 0]}.`;
    const line = sharpText(this, W / 2, mid + 170, how, 22, COLORS.soft);
    this.fit(line, W - 180, 22);
    this.view.add([who, was, word, line]);
    if (!impostorWon) cue('win');
  }

  /** The three bands every phase keeps to, for the layout check. */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    return [
      { name: 'title', top: TITLE_Y - 24, bottom: TITLE_Y + 24 },
      { name: 'middle', top: MIDDLE_TOP, bottom: MIDDLE_BOTTOM + 10 },
      { name: 'button', top: BUTTON_Y - BUTTON_H / 2, bottom: BUTTON_Y + BUTTON_H / 2 + 6 },
    ];
  }
}

export function impostorStatus(state: ImpostorState, names: readonly string[]): string | undefined {
  const name = (seat: number) => names[seat] ?? `Player ${seat + 1}`;
  if (state.phase === 'reveal') return `${name(state.turn)} looks at their card`;
  if (state.phase === 'talk') return `${name(state.starter)} starts. One word each.`;
  if (state.phase === 'vote') return 'Vote for the impostor';
  if (state.phase === 'guess') return `${name(state.impostor)} guesses the word`;
  return undefined;
}

export function impostorResult(state: ImpostorState, names: readonly string[]): string | undefined {
  if (!state.result) return undefined;
  const name = names[state.impostor] ?? `Player ${state.impostor + 1}`;
  if (state.accused !== null && state.accused !== state.impostor) return `${name} got away with it. The word was ${state.secret}.`;
  if (state.guessed === state.word) return `${name} was caught but guessed ${state.secret}.`;
  return `${name} was caught. The word was ${state.secret}.`;
}
