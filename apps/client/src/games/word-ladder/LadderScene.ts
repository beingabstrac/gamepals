import { type LadderMove, type LadderState, rung, TAKE_BACK } from '@gamepals/rules';
import { Scene, type GameObjects } from 'phaser';
import { applySpeed } from '../../autoplay';
import type { Session } from '../../session';
import { COLORS, DARK, toHex } from '../../theme';
import { fitCamera, sharpText } from '../crisp';
import { onKeys } from '../keys';

const W = 640;
const H = 820;
export const LADDER_SIZE = { width: W, height: H };

const TOP = 44;
const STEP = 78;
const TILE = 66;
/** The rung being typed sits under the last one climbed. */
const BACK_Y = H - 56;
/** As many rungs as fit above the line. A long climb scrolls: the oldest go off the top, and
 *  the status line still says where the ladder started and where it is going. */
const MAX_ROWS = 8;

export const LADDER_COLORS = [COLORS.grape];
export const LADDER_NAMES = ['You'];

export class LadderScene extends Scene {
  private board!: GameObjects.Graphics;
  private rows: GameObjects.Text[] = [];
  private banner!: GameObjects.Text;
  private backText!: GameObjects.Text;
  private typed = '';
  private shaking = false;

  constructor(private readonly session: Session<LadderMove>) {
    super('word-ladder');
  }

  private get state(): LadderState {
    return this.session.state as LadderState;
  }

  create(): void {
    fitCamera(this, W, H);
    applySpeed(this);
    this.board = this.add.graphics();
    this.banner = sharpText(this, W / 2, BACK_Y - 46, '', 24, COLORS.soft).setDepth(3);
    this.backText = sharpText(this, W / 2, BACK_Y, 'Take a rung back', 24, COLORS.grape).setDepth(3);
    this.draw();

    this.input.on('pointerdown', (p: { worldX: number; worldY: number }) => {
      if (Math.abs(p.worldY - BACK_Y) < 30) this.back();
    });
    onKeys(this, (key) => this.key(key));
    const off = this.session.subscribe(() => {
      this.typed = '';
      this.draw();
    });
    this.events.once('shutdown', off);
  }

  private key(key: string): boolean {
    const state = this.state;
    if (state.result || !this.session.isHumanTurn()) return false;
    if (key === 'Backspace') {
      if (this.typed) {
        this.typed = this.typed.slice(0, -1);
        this.draw();
      } else this.back();
      return true;
    }
    if (key === 'Enter') {
      if (this.typed.length !== state.letters) return this.reject(`${state.letters} letters`);
      const move = rung(this.typed);
      if (!state.legalMoves(0).includes(move)) return this.reject(this.whyNot(this.typed));
      this.session.play(move);
      return true;
    }
    if (/^[a-zA-Z]$/.test(key)) {
      if (this.typed.length >= state.letters) return true;
      this.typed += key.toLowerCase();
      this.draw();
      return true;
    }
    return false;
  }

  /** Say what is wrong with this word, because "no" on its own teaches nothing. */
  private whyNot(word: string): string {
    const state = this.state;
    if (state.used.has(word)) return 'Already on the ladder';
    let different = 0;
    for (let i = 0; i < word.length; i++) if (word[i] !== state.here[i]) different++;
    if (different !== 1) return 'Change one letter';
    return 'Not a word we know';
  }

  private back(): void {
    if (this.state.result || !this.session.isHumanTurn()) return;
    if (!this.state.rungs.length) {
      this.reject('Nothing to take back');
      return;
    }
    this.session.play(TAKE_BACK);
  }

  private draw(): void {
    const state = this.state;
    const g = this.board.clear();
    const words = [state.start, ...state.rungs];
    // The climb so far, then the rung being typed. A climb longer than the board scrolls, so
    // what you are doing now is always the row you are looking at.
    // No empty row once it is over: an input row after the result invites a tap that does nothing.
    const all = state.result ? words : [...words, this.typed.padEnd(state.letters, ' ')];
    const cut = Math.max(0, all.length - MAX_ROWS);
    const shown = all.slice(cut);
    shown.forEach((word, row) => {
      const y = TOP + row * STEP + TILE / 2;
      const climbed = row < words.length;
      this.tiles(g, word, y, climbed, row === words.length);
    });
    this.rowText(state, shown, cut);

    const left = state.par - state.rungs.length;
    this.banner.setText(
      state.result
        ? state.over === 0
          ? `Up in ${state.rungs.length}. Par.`
          : `Up in ${state.rungs.length}, par was ${state.par}.`
        : `${state.target.toUpperCase()} in ${left > 0 ? left : '?'} ${left === 1 ? 'rung' : 'rungs'}`,
    );
    this.backText.setAlpha(state.rungs.length && !state.result ? 1 : 0.3);
  }

  private tiles(g: GameObjects.Graphics, word: string, y: number, climbed: boolean, typing: boolean): void {
    const width = word.length * (TILE + 8) - 8;
    for (let i = 0; i < word.length; i++) {
      const x = (W - width) / 2 + i * (TILE + 8);
      const fill = climbed ? toHex(COLORS.grape) : typing && word[i] !== ' ' ? 0xdcd6ee : 0xffffff;
      g.fillStyle(0xe3def0, 1);
      g.fillRoundedRect(x, y - TILE / 2 + 4, TILE, TILE, 12);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(x, y - TILE / 2, TILE, TILE, 12);
      if (!climbed) {
        g.lineStyle(3, toHex(typing ? DARK.grape : COLORS.line), 1);
        g.strokeRoundedRect(x, y - TILE / 2, TILE, TILE, 12);
      }
    }
  }

  private rowText(state: LadderState, shown: readonly string[], cut: number): void {
    const climbedCount = state.rungs.length + 1 - cut;
    let slot = 0;
    shown.forEach((word, row) => {
      const y = TOP + row * STEP + TILE / 2;
      const width = word.length * (TILE + 8) - 8;
      for (let i = 0; i < word.length; i++) {
        const text = (this.rows[slot] ??= sharpText(this, 0, 0, '', 38, COLORS.ink).setDepth(2));
        text
          .setPosition((W - width) / 2 + i * (TILE + 8) + TILE / 2, y)
          .setText((word[i] ?? ' ').trim().toUpperCase())
          .setColor(row < climbedCount ? '#ffffff' : COLORS.ink)
          .setVisible(true);
        slot++;
      }
    });
    for (let i = slot; i < this.rows.length; i++) this.rows[i]!.setVisible(false);
  }

  /**
   * The bands that must not sit on top of each other, for the layout check. Every one of these
   * scenes put a status line through its own content at least once.
   */
  layoutCheck(): { name: string; top: number; bottom: number }[] {
    const rows = Math.min(this.state.rungs.length + 2, MAX_ROWS);
    return [
      { name: 'ladder', top: TOP, bottom: TOP + (rows - 1) * STEP + TILE },
      { name: 'banner', top: BACK_Y - 46 - 14, bottom: BACK_Y - 46 + 14 },
      { name: 'take back', top: BACK_Y - 16, bottom: BACK_Y + 16 },
    ];
  }

  /** A refused word shakes its row rather than doing nothing. */
  private reject(why: string): boolean {
    this.banner.setText(why);
    if (this.shaking) return true;
    this.shaking = true;
    // The typed row is always the last one drawn, however much has scrolled off the top.
    const row = Math.min(this.state.rungs.length + 1, MAX_ROWS - 1);
    const from = row * (this.state.letters || 1);
    const texts = this.rows.slice(from, from + this.state.letters);
    const start = texts.map((text) => text.x);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 260,
      onUpdate: (tween) => {
        const shift = Math.sin(tween.getValue()! * Math.PI * 6) * 8;
        texts.forEach((text, i) => text.setX(start[i]! + shift));
      },
      onComplete: () => {
        texts.forEach((text, i) => text.setX(start[i]!));
        this.shaking = false;
      },
    });
    return true;
  }
}

export const ladderStatus = (state: LadderState): string | undefined =>
  state.result ? undefined : `${state.start.toUpperCase()} to ${state.target.toUpperCase()}, par ${state.par}`;

export const ladderResult = (state: LadderState): string | undefined => {
  if (!state.result) return undefined;
  return state.over === 0 ? `Up in ${state.rungs.length}. Par. 🎉` : `Up in ${state.rungs.length}, par was ${state.par}.`;
};
