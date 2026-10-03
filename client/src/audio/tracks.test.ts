import { describe, expect, it } from "vitest";
import { noteFreq } from "./synth";
import { TRACKS } from "./tracks";

describe("music tracks", () => {
  for (const [name, track] of Object.entries(TRACKS)) {
    it(`${name}: every voice has the same 8-16 bars of 16 valid steps`, () => {
      const bars = track.bass.length;
      expect(bars).toBeGreaterThanOrEqual(8);
      expect(bars).toBeLessThanOrEqual(16);
      for (const voice of [track.bass, track.lead, track.drums]) {
        expect(voice).toHaveLength(bars);
        for (const bar of voice) expect(bar.trim().split(/\s+/)).toHaveLength(16);
      }
      for (const tok of [...track.bass, ...track.lead].flatMap((b) => b.trim().split(/\s+/))) {
        if (tok !== "-" && tok !== ".") expect(noteFreq(tok)).toBeGreaterThan(0);
      }
      for (const tok of track.drums.flatMap((b) => b.trim().split(/\s+/))) expect(["k", "s", "h", "o", "."]).toContain(tok);
    });
  }
});
