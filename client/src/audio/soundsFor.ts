// Decides which effects to play by diffing two consecutive snapshots. Pure: no audio here.
// Hidden information (who wrote/picked what) only drives sounds during REVEAL.
import type { Snapshot } from "@lorota/shared";

export type SfxName =
  | "click"
  | "join"
  | "leave"
  | "start"
  | "roundStart"
  | "submit"
  | "otherDone"
  | "tick"
  | "timeUp"
  | "vote"
  | "revealOption"
  | "gotFooled"
  | "fooledSomeone"
  | "truth"
  | "correct"
  | "points"
  | "win"
  | "gameOver";

export function soundsFor(prev: Snapshot | null, next: Snapshot, myId: string): SfxName[] {
  if (!prev || prev.roomCode !== next.roomCode) return [];
  const out: SfxName[] = [];

  // Players entering / leaving (other than me).
  const before = new Map(prev.players.map((p) => [p.id, p]));
  const after = new Map(next.players.map((p) => [p.id, p]));
  const joined = next.players.some((p) => p.id !== myId && p.connected && !before.get(p.id)?.connected);
  const left = prev.players.some((p) => p.id !== myId && p.connected && !after.get(p.id)?.connected);
  if (joined) out.push("join");
  if (left) out.push("leave");

  const samePhase = prev.phase === next.phase && prev.round?.number === next.round?.number;

  if (samePhase) {
    if (next.phase === "WRITING") {
      if (prev.yourAnswer === null && next.yourAnswer !== null) out.push("submit");
      if (othersFlipped(prev, next, myId, "hasSubmitted")) out.push("otherDone");
    }
    if (next.phase === "VOTING") {
      if (prev.yourVote === null && next.yourVote !== null) out.push("vote");
      if (othersFlipped(prev, next, myId, "hasVoted")) out.push("otherDone");
    }
  } else {
    if (next.lastPhaseTimedOut && (prev.phase === "WRITING" || prev.phase === "VOTING")) out.push("timeUp");
    if (next.phase === "WRITING") {
      if (prev.phase === "LOBBY") out.push("start");
      out.push("roundStart");
    }
    if (next.phase === "SCOREBOARD") out.push("points");
    if (next.phase === "GAME_OVER" && prev.phase !== "LOBBY") {
      const me = next.players.find((p) => p.id === myId);
      const top = Math.max(...next.players.map((p) => p.score));
      out.push(me && me.score === top ? "win" : "gameOver");
    }
  }

  if (next.phase === "REVEAL") {
    const alreadyShown = prev.phase === "REVEAL" && samePhase ? prev.revealed.length : 0;
    for (const r of next.revealed.slice(alreadyShown)) {
      out.push("revealOption");
      if (r.kind === "TRUTH") {
        out.push("truth");
        if (r.voterIds.includes(myId)) out.push("correct");
      } else if (r.authorId === myId) {
        if (r.voterIds.some((v) => v !== myId)) out.push("fooledSomeone");
      } else if (r.voterIds.includes(myId)) {
        out.push("gotFooled");
      }
    }
  }

  return out;
}

function othersFlipped(prev: Snapshot, next: Snapshot, myId: string, key: "hasSubmitted" | "hasVoted"): boolean {
  const before = new Map(prev.players.map((p) => [p.id, p[key]]));
  return next.players.some((p) => p.id !== myId && p[key] && !before.get(p.id));
}
