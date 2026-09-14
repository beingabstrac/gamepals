/** One synthesized note: a pitch (optionally sliding) with a quick attack and decay. */
interface Tone {
  readonly freq: number;
  readonly to?: number;
  readonly duration: number;
  readonly type?: OscillatorType;
  readonly volume?: number;
  readonly delay?: number;
}

const note = (freq: number, delay: number, duration = 0.14): Tone => ({
  freq,
  delay,
  duration,
  type: 'triangle',
  volume: 0.18,
});

/** Tiny built-in sound set: no audio files to download or license. */
export const SFX = {
  tap: [{ freq: 700, to: 900, duration: 0.05, type: 'triangle', volume: 0.08 }],
  place: [{ freq: 420, to: 640, duration: 0.09, type: 'triangle', volume: 0.18 }],
  botPlace: [{ freq: 360, to: 280, duration: 0.09, type: 'triangle', volume: 0.13 }],
  win: [note(523, 0), note(659, 0.09), note(784, 0.18), note(1047, 0.27, 0.32)],
  lose: [note(392, 0, 0.18), note(330, 0.16, 0.18), note(262, 0.32, 0.36)],
  draw: [note(440, 0, 0.16), note(440, 0.18, 0.2)],
  roll: [
    { freq: 300, to: 520, duration: 0.04, type: 'square', volume: 0.05 },
    { freq: 480, to: 280, duration: 0.04, type: 'square', volume: 0.05, delay: 0.06 },
    { freq: 340, to: 620, duration: 0.05, type: 'square', volume: 0.05, delay: 0.12 },
  ],
  hit: [{ freq: 900, to: 520, duration: 0.05, type: 'triangle', volume: 0.16 }],
  wall: [{ freq: 520, to: 380, duration: 0.035, type: 'triangle', volume: 0.07 }],
  goal: [
    { freq: 220, to: 440, duration: 0.3, type: 'sawtooth', volume: 0.08 },
    note(659, 0.12, 0.16),
    note(880, 0.24, 0.3),
  ],
  clang: [
    { freq: 1300, to: 1100, duration: 0.25, type: 'square', volume: 0.05 },
    { freq: 1950, to: 1800, duration: 0.3, type: 'sine', volume: 0.07 },
  ],
  thud: [{ freq: 140, to: 70, duration: 0.12, type: 'sine', volume: 0.3 }],
  gong: [
    { freq: 196, to: 190, duration: 0.9, type: 'sine', volume: 0.22 },
    { freq: 392, to: 380, duration: 0.7, type: 'sine', volume: 0.08 },
  ],
  pull: [{ freq: 240, to: 180, duration: 0.05, type: 'triangle', volume: 0.12 }],
  go: [{ freq: 880, duration: 0.12, type: 'square', volume: 0.07 }, note(1175, 0.1, 0.16)],
  buzz: [
    { freq: 150, duration: 0.18, type: 'sawtooth', volume: 0.09 },
    { freq: 120, duration: 0.2, type: 'sawtooth', volume: 0.09, delay: 0.2 },
  ],
  capture: [
    { freq: 880, to: 220, duration: 0.22, type: 'sawtooth', volume: 0.09 },
    { freq: 660, to: 990, duration: 0.12, type: 'triangle', volume: 0.12, delay: 0.2 },
  ],
  // Echo's four pads: an A major chord (A, C sharp, E, high A), so any sequence sounds like a tune.
  echo0: [{ freq: 440, duration: 0.34, type: 'sine', volume: 0.22 }, { freq: 880, duration: 0.2, type: 'triangle', volume: 0.04 }],
  echo1: [{ freq: 554.37, duration: 0.34, type: 'sine', volume: 0.22 }, { freq: 1108.73, duration: 0.2, type: 'triangle', volume: 0.04 }],
  echo2: [{ freq: 659.25, duration: 0.34, type: 'sine', volume: 0.22 }, { freq: 1318.51, duration: 0.2, type: 'triangle', volume: 0.04 }],
  echo3: [{ freq: 880, duration: 0.34, type: 'sine', volume: 0.2 }, { freq: 1760, duration: 0.2, type: 'triangle', volume: 0.04 }],
} satisfies Record<string, readonly Tone[]>;

export type SoundName = keyof typeof SFX;

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

export function playSound(name: SoundName): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const tone of SFX[name] as readonly Tone[]) {
    const start = now + (tone.delay ?? 0);
    const end = start + tone.duration;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.setValueAtTime(tone.freq, start);
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(tone.volume ?? 0.15, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}
