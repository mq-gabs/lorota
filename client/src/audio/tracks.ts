// Original loops, written as note data for the step sequencer in music.ts.
// Each bar is 16 sixteenth-note steps. Tokens: a note ("C4", "F#3", "Bb2"),
// "-" holds the previous note one more step, "." is a rest.
// Drums: "k" kick, "s" snare, "h" closed hat, "o" open hat, "." rest.

export interface Track {
  bpm: number;
  bass: string[];
  lead: string[];
  drums: string[];
}

export type TrackName = "lobby" | "game";

// Relaxed, ~100 BPM, F major lounge: Fmaj7 | Em7 | Dm7 | G7 | Fmaj7 | Em7 | Dm7 G7 | C
const lobby: Track = {
  bpm: 100,
  bass: [
    "F2 - - . . . C3 . F2 - . . A2 . C3 .",
    "E2 - - . . . B2 . E2 - . . G2 . B2 .",
    "D2 - - . . . A2 . D2 - . . F2 . A2 .",
    "G2 - - . . . D3 . G2 - . . B2 . D3 .",
    "F2 - - . . . C3 . F2 - . . A2 . C3 .",
    "E2 - - . . . B2 . E2 - . . G2 . B2 .",
    "D2 - - . . . A2 . G2 - - . . . B2 .",
    "C3 - - . . . G2 . C3 - . . E2 . G2 .",
  ],
  lead: [
    "A4 - - - C5 - E5 - - - D5 - C5 - - -",
    "B4 - - - G4 - - - E4 - G4 - B4 - - -",
    "A4 - - - F4 - A4 - D5 - - - C5 - A4 -",
    "B4 - - - - - . . D5 - B4 - G4 - - -",
    "A4 - - - C5 - F5 - - - E5 - C5 - A4 -",
    "G4 - - - B4 - E5 - - - D5 - B4 - G4 -",
    "F4 - A4 - D5 - - - B4 - - - D5 - F5 -",
    "E5 - - - - - - - . . . . G4 - B4 -",
  ],
  drums: [
    "k . . h s . . h k . . h s . . h",
    "k . . h s . . h k . k h s . . h",
    "k . . h s . . h k . . h s . . h",
    "k . . h s . . h k . k h s . o .",
    "k . . h s . . h k . . h s . . h",
    "k . . h s . . h k . k h s . . h",
    "k . . h s . . h k . . h s . . h",
    "k . . h s . . h k . . h s . s s",
  ],
};

// Driving, ~120 BPM, A minor quiz-show: Am | F | C | G | Am | F | G | E
const game: Track = {
  bpm: 120,
  bass: [
    "A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .",
    "F2 . F3 . F2 . F3 . F2 . F3 . F2 . F3 .",
    "C3 . C4 . C3 . C4 . C3 . C4 . C3 . C4 .",
    "G2 . G3 . G2 . G3 . G2 . G3 . B2 . D3 .",
    "A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .",
    "F2 . F3 . F2 . F3 . F2 . F3 . F2 . F3 .",
    "G2 . G3 . G2 . G3 . G2 . G3 . G2 . G3 .",
    "E2 . E3 . E2 . E3 . E2 . E3 . G#2 . B2 .",
  ],
  lead: [
    "E5 . A4 . C5 . E5 . D5 . C5 . B4 . C5 .",
    "A4 . . . C5 . F5 . E5 . C5 . A4 - - .",
    "G4 . C5 . E5 . G5 . F5 . E5 . D5 . E5 .",
    "D5 - - . B4 . G4 . A4 . B4 . D5 - - .",
    "E5 . A5 . G5 . E5 . D5 . E5 . C5 . A4 .",
    "F5 . E5 . C5 . A4 . C5 - - . F5 . E5 .",
    "D5 . G5 . F5 . D5 . B4 . D5 . G4 . B4 .",
    "G#4 - - . B4 - - . E5 - - . D5 . B4 .",
  ],
  drums: [
    "k . h . s . h k k . h . s . h h",
    "k . h . s . h k k . h . s . h h",
    "k . h . s . h k k . h . s . h h",
    "k . h . s . h k k . h . s . o .",
    "k . h . s . h k k . h . s . h h",
    "k . h . s . h k k . h . s . h h",
    "k . h . s . h k k . h . s . h h",
    "k . h . s . h . s s . s s s s s",
  ],
};

export const TRACKS: Record<TrackName, Track> = { lobby, game };
