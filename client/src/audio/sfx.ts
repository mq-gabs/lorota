// Synthesized sound effects. Each recipe schedules its notes starting at `t`.
import type { SfxName } from "./soundsFor";
import { noise, noteFreq as n, tone } from "./synth";

export interface SfxOptions {
  /** For `tick`: the final, higher tick. */
  final?: boolean;
}

type Recipe = (ctx: AudioContext, out: AudioNode, t: number, opts: SfxOptions) => void;

function seq(ctx: AudioContext, out: AudioNode, t: number, notes: string[], step: number, vol: number, type: OscillatorType = "square", hold = 1.6) {
  notes.forEach((note, i) => {
    if (note === ".") return;
    tone(ctx, out, n(note), t + i * step, step * hold, vol, { type, cutoff: 3500 });
  });
}

const recipes: Record<SfxName, Recipe> = {
  click: (ctx, out, t) => tone(ctx, out, 1100, t, 0.035, 0.25, { type: "sine", slideTo: 700 }),

  join: (ctx, out, t) => seq(ctx, out, t, ["C5", "G5"], 0.08, 0.2, "triangle"),

  leave: (ctx, out, t) => seq(ctx, out, t, ["G5", "C5"], 0.08, 0.2, "triangle"),

  start: (ctx, out, t) => {
    seq(ctx, out, t, ["C5", "E5", "G5", "C6"], 0.07, 0.14);
    tone(ctx, out, n("C6"), t + 0.28, 0.35, 0.12, { type: "triangle" });
    tone(ctx, out, n("C3"), t, 0.35, 0.25, { type: "triangle" });
  },

  roundStart: (ctx, out, t) => {
    noise(ctx, out, t, 0.35, 0.25, { filter: "bandpass", freq: 300, sweepTo: 4000, q: 2, attack: 0.15 });
    tone(ctx, out, n("E6"), t + 0.3, 0.7, 0.18, { type: "sine" });
    tone(ctx, out, n("B6"), t + 0.3, 0.6, 0.08, { type: "sine" });
  },

  submit: (ctx, out, t) => tone(ctx, out, 520, t, 0.1, 0.4, { type: "sine", slideTo: 1200 }),

  otherDone: (ctx, out, t) => tone(ctx, out, 1500, t, 0.06, 0.08, { type: "sine" }),

  tick: (ctx, out, t, opts) => {
    noise(ctx, out, t, 0.025, 0.3, { filter: "highpass", freq: 4000 });
    tone(ctx, out, opts.final ? 1760 : 1000, t, opts.final ? 0.12 : 0.05, 0.25, { type: "square", cutoff: 4000 });
  },

  timeUp: (ctx, out, t) => {
    tone(ctx, out, 150, t, 0.5, 0.22, { type: "sawtooth", cutoff: 1200, attack: 0.01 });
    tone(ctx, out, 157, t, 0.5, 0.22, { type: "sawtooth", cutoff: 1200, attack: 0.01 });
  },

  vote: (ctx, out, t) => tone(ctx, out, 330, t, 0.1, 0.45, { type: "sine", slideTo: 760 }),

  revealOption: (ctx, out, t) => {
    tone(ctx, out, 190, t, 0.3, 0.6, { type: "sine", slideTo: 55 });
    noise(ctx, out, t, 0.12, 0.25, { filter: "bandpass", freq: 1800, q: 0.8 });
  },

  gotFooled: (ctx, out, t) => {
    // "Wah wah wahhh": three falling notes, the last one sliding down.
    seq(ctx, out, t + 0.25, ["G4", "F#4"], 0.28, 0.18, "sawtooth", 0.9);
    tone(ctx, out, n("F4"), t + 0.81, 0.7, 0.18, { type: "sawtooth", slideTo: n("C4"), cutoff: 1500 });
  },

  fooledSomeone: (ctx, out, t) => seq(ctx, out, t + 0.25, ["C5", "E5", "G5", "B5", "C6"], 0.06, 0.13),

  truth: (ctx, out, t) => {
    seq(ctx, out, t + 0.2, ["G4", "G4", "C5"], 0.11, 0.15, "square", 0.8);
    tone(ctx, out, n("E5"), t + 0.53, 0.45, 0.15, { type: "square", cutoff: 3000 });
    tone(ctx, out, n("C4"), t + 0.53, 0.45, 0.2, { type: "triangle" });
  },

  correct: (ctx, out, t) => {
    const at = t + 1.0; // after the fanfare
    for (const [note, vol] of [["C6", 0.16], ["E6", 0.12], ["G6", 0.1], ["C7", 0.06]] as const) {
      tone(ctx, out, n(note), at, 0.9, vol, { type: "sine" });
    }
  },

  points: (ctx, out, t) => {
    ["B5", "E6", "B5", "E6", "G6", "B6"].forEach((note, i) =>
      tone(ctx, out, n(note), t + i * 0.07, 0.09, 0.12, { type: "square", cutoff: 5000 }),
    );
  },

  win: (ctx, out, t) => {
    seq(ctx, out, t, ["C5", "E5", "G5", "C6", ".", "G5", "C6"], 0.12, 0.14);
    tone(ctx, out, n("E6"), t + 0.84, 0.8, 0.14, { type: "square", cutoff: 3000 });
    seq(ctx, out, t, ["C3", ".", "G3", ".", "C3", ".", "G3"], 0.12, 0.25, "triangle", 1.8);
    tone(ctx, out, n("C3"), t + 0.84, 0.8, 0.25, { type: "triangle" });
  },

  gameOver: (ctx, out, t) => {
    seq(ctx, out, t, ["E5", "D5", "C5"], 0.13, 0.13, "square", 1.2);
    tone(ctx, out, n("G4"), t + 0.39, 0.5, 0.13, { type: "triangle" });
  },
};

export function playRecipe(ctx: AudioContext, out: AudioNode, name: SfxName, t: number, opts: SfxOptions = {}): void {
  recipes[name](ctx, out, t, opts);
}
