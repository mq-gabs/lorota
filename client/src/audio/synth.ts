// Low-level Web Audio helpers shared by effects and music.

export interface ToneOptions {
  type?: OscillatorType;
  /** Linear-ramp the frequency to this value over the note. */
  slideTo?: number;
  attack?: number;
  /** Lowpass cutoff, for softer square/saw tones. */
  cutoff?: number;
}

export function tone(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  duration: number,
  volume: number,
  opts: ToneOptions = {},
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "triangle";
  osc.frequency.setValueAtTime(freq, start);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, start + duration);
  const attack = opts.attack ?? 0.005;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  let out: AudioNode = gain;
  if (opts.cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = opts.cutoff;
    gain.connect(filter);
    out = filter;
  }
  osc.connect(gain);
  out.connect(dest);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;

function getNoise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

export interface NoiseOptions {
  filter?: BiquadFilterType;
  freq?: number;
  /** Sweep the filter frequency to this value over the burst. */
  sweepTo?: number;
  q?: number;
  attack?: number;
}

export function noise(
  ctx: AudioContext,
  dest: AudioNode,
  start: number,
  duration: number,
  volume: number,
  opts: NoiseOptions = {},
): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter ?? "highpass";
  filter.frequency.setValueAtTime(opts.freq ?? 1000, start);
  if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, start + duration);
  filter.Q.value = opts.q ?? 1;
  const gain = ctx.createGain();
  const attack = opts.attack ?? 0.002;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter).connect(gain).connect(dest);
  // Random offset so consecutive hits don't sound identical.
  src.start(start, Math.random() * 0.5, duration + 0.02);
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A4" -> 440, "C#5", "Bb2"... */
export function noteFreq(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note: ${name}`);
  const semis = NOTE_INDEX[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semis;
  return 440 * 2 ** ((midi - 69) / 12);
}
