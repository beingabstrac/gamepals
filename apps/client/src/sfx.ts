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
