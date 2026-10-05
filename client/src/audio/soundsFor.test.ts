import type { Phase, RevealedOption, Snapshot, SnapshotPlayer } from "@lorota/shared";
import { describe, expect, it } from "vitest";
import { soundsFor } from "./soundsFor";

const ME = "me";

function player(id: string, extra: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return { id, nickname: id, connected: true, score: 0, roundGain: 0, hasSubmitted: false, hasVoted: false, ...extra };
}

function snap(phase: Phase, extra: Partial<Snapshot> = {}): Snapshot {
  return {
    roomCode: "ABCD",
    phase,
    you: { id: ME, isHost: true },
    hostId: ME,
    players: [player(ME), player("b"), player("c")],
    round: phase === "LOBBY" ? null : { number: 1, total: 8 },
    question: null,
    phaseEndsAt: null,
    yourAnswer: null,
    options: null,
    yourVote: null,
    revealed: [],
    serverNow: 0,
    lastPhaseTimedOut: false,
    chat: [],
    ...extra,
  };
}

const lie = (optionId: string, authorId: string, voterIds: string[]): RevealedOption => ({
  optionId,
  kind: "LIE",
  authorId,
  voterIds,
  pointsEach: 500,
});
const truth = (voterIds: string[]): RevealedOption => ({
  optionId: "t",
  kind: "TRUTH",
  authorId: null,
  voterIds,
  pointsEach: 1000,
});

describe("soundsFor", () => {
  it("returns nothing for the first snapshot", () => {
    expect(soundsFor(null, snap("REVEAL", { revealed: [truth([ME])] }), ME)).toEqual([]);
  });

  it("plays join and leave for other players", () => {
    const lobby = snap("LOBBY", { players: [player(ME)] });
    expect(soundsFor(lobby, snap("LOBBY", { players: [player(ME), player("b")] }), ME)).toEqual(["join"]);
    const dc = snap("LOBBY", { players: [player(ME), player("b", { connected: false })] });
    expect(soundsFor(snap("LOBBY", { players: [player(ME), player("b")] }), dc, ME)).toEqual(["leave"]);
    expect(soundsFor(dc, snap("LOBBY", { players: [player(ME), player("b")] }), ME)).toEqual(["join"]);
  });

  it("plays start and roundStart when the game starts, roundStart on later rounds", () => {
    expect(soundsFor(snap("LOBBY"), snap("WRITING"), ME)).toEqual(["start", "roundStart"]);
    expect(
      soundsFor(snap("SCOREBOARD"), snap("WRITING", { round: { number: 2, total: 8 } }), ME),
    ).toEqual(["roundStart"]);
  });

  it("plays submit for me and otherDone for others", () => {
    const w = snap("WRITING");
    expect(soundsFor(w, snap("WRITING", { yourAnswer: "" }), ME)).toEqual(["submit"]);
    const other = snap("WRITING", { players: [player(ME), player("b", { hasSubmitted: true }), player("c")] });
    expect(soundsFor(w, other, ME)).toEqual(["otherDone"]);
  });

  it("plays vote for me and otherDone for others", () => {
    const v = snap("VOTING");
    expect(soundsFor(v, snap("VOTING", { yourVote: "x" }), ME)).toEqual(["vote"]);
    const other = snap("VOTING", { players: [player(ME), player("b"), player("c", { hasVoted: true })] });
    expect(soundsFor(v, other, ME)).toEqual(["otherDone"]);
  });

  it("plays timeUp only when the phase ended by timeout", () => {
    expect(soundsFor(snap("WRITING"), snap("VOTING", { lastPhaseTimedOut: true }), ME)).toEqual(["timeUp"]);
    expect(soundsFor(snap("WRITING"), snap("VOTING"), ME)).toEqual([]);
  });

  it("plays gotFooled when a revealed lie is the one I picked", () => {
    const r = snap("REVEAL", { revealed: [lie("o1", "b", [ME])], lastPhaseTimedOut: false });
    expect(soundsFor(snap("VOTING", { yourVote: "o1" }), r, ME)).toEqual(["revealOption", "gotFooled"]);
  });

  it("plays fooledSomeone only when someone else picked my lie", () => {
    const prev = snap("REVEAL", { revealed: [lie("o1", "b", [])] });
    const mine = snap("REVEAL", { revealed: [lie("o1", "b", []), lie("o2", ME, ["c"])] });
    expect(soundsFor(prev, mine, ME)).toEqual(["revealOption", "fooledSomeone"]);
    const selfOnly = snap("REVEAL", { revealed: [lie("o1", "b", []), lie("o2", ME, [ME])] });
    expect(soundsFor(prev, selfOnly, ME)).toEqual(["revealOption"]);
  });

  it("plays truth, plus correct when I picked it", () => {
    const prev = snap("REVEAL", { revealed: [lie("o1", "b", [])] });
    expect(soundsFor(prev, snap("REVEAL", { revealed: [lie("o1", "b", []), truth(["b"])] }), ME)).toEqual([
      "revealOption",
      "truth",
    ]);
    expect(soundsFor(prev, snap("REVEAL", { revealed: [lie("o1", "b", []), truth([ME])] }), ME)).toEqual([
      "revealOption",
      "truth",
      "correct",
    ]);
  });

  it("plays points on the scoreboard and win/gameOver at the end", () => {
    expect(soundsFor(snap("REVEAL"), snap("SCOREBOARD"), ME)).toEqual(["points"]);
    const players = [player(ME, { score: 2000 }), player("b", { score: 2000 }), player("c", { score: 500 })];
    expect(soundsFor(snap("SCOREBOARD"), snap("GAME_OVER", { players }), ME)).toEqual(["win"]);
    const behind = [player(ME, { score: 0 }), player("b", { score: 500 }), player("c")];
    expect(soundsFor(snap("SCOREBOARD"), snap("GAME_OVER", { players: behind }), ME)).toEqual(["gameOver"]);
  });

  it("plays nothing when going back to the lobby", () => {
    expect(soundsFor(snap("GAME_OVER"), snap("LOBBY"), ME)).toEqual([]);
  });
});
