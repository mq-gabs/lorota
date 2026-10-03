// Step sequencer: schedules notes slightly ahead against AudioContext.currentTime,
// so loops stay in tempo and wrap around with no gap.
import { noise, noteFreq, tone } from "./synth";
import type { Track } from "./tracks";

const STEPS_PER_BAR = 16;
const LOOKAHEAD_S = 0.15;
const TIMER_MS = 25;

interface NoteEvent {
  freq: number;
  steps: number;
}

/** Turns bar strings into per-step note events (with held lengths). */
function parseVoice(bars: string[]): (NoteEvent | null)[] {
  const tokens = bars.flatMap((bar) => bar.trim().split(/\s+/));
  const events: (NoteEvent | null)[] = tokens.map(() => null);
  let last: NoteEvent | null = null;
  tokens.forEach((tok, i) => {
    if (tok === "-") {
      if (last) last.steps++;
    } else if (tok === ".") {
      last = null;
    } else {
      last = { freq: noteFreq(tok), steps: 1 };
      events[i] = last;
    }
  });
  return events;
}

export class Sequencer {
  private readonly out: GainNode;
  private readonly bass: (NoteEvent | null)[];
  private readonly lead: (NoteEvent | null)[];
  private readonly drums: string[];
  private readonly totalSteps: number;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** 1 = written tempo; 1.15 = sped up. */
  tempoScale = 1;

  constructor(
    private readonly ctx: AudioContext,
    dest: AudioNode,
    private readonly track: Track,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    this.bass = parseVoice(track.bass);
    this.lead = parseVoice(track.lead);
    this.drums = track.drums.flatMap((bar) => bar.trim().split(/\s+/));
    this.totalSteps = track.bass.length * STEPS_PER_BAR;
  }

  start(fadeS: number): void {
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(0.0001, now);
    this.out.gain.exponentialRampToValueAtTime(1, now + fadeS);
    this.nextTime = now + 0.05;
    this.timer = setInterval(() => this.schedule(), TIMER_MS);
    this.schedule();
  }

  stop(fadeS: number): void {
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(Math.max(this.out.gain.value, 0.0001), now);
    this.out.gain.exponentialRampToValueAtTime(0.0001, now + fadeS);
    setTimeout(() => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.out.disconnect();
    }, fadeS * 1000 + 200);
  }

  private stepDuration(): number {
    return 60 / this.track.bpm / 4 / this.tempoScale;
  }

  private schedule(): void {
    // If the tab was throttled, skip ahead instead of firing a burst of late notes.
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += this.stepDuration();
      this.step = (this.step + 1) % this.totalSteps;
    }
  }

  private playStep(i: number, t: number): void {
    const { ctx, out } = this;
    const dur = this.stepDuration();
    const bass = this.bass[i];
    if (bass) tone(ctx, out, bass.freq, t, bass.steps * dur * 0.95, 0.5, { type: "triangle", attack: 0.01 });
    const lead = this.lead[i];
    if (lead) {
      tone(ctx, out, lead.freq, t, lead.steps * dur * 0.9, 0.11, { type: "square", attack: 0.01, cutoff: 2200 });
    }
    switch (this.drums[i]) {
      case "k":
        noise(ctx, out, t, 0.14, 0.9, { filter: "lowpass", freq: 180, sweepTo: 60, q: 3 });
        tone(ctx, out, 120, t, 0.12, 0.45, { type: "sine", slideTo: 45 });
        break;
      case "s":
        noise(ctx, out, t, 0.13, 0.28, { filter: "bandpass", freq: 1800, q: 0.7 });
        break;
      case "h":
        noise(ctx, out, t, 0.04, 0.12, { filter: "highpass", freq: 7000 });
        break;
      case "o":
        noise(ctx, out, t, 0.18, 0.1, { filter: "highpass", freq: 6000 });
        break;
    }
  }
}
