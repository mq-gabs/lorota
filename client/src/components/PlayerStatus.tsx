import type { Snapshot } from "@lorota/shared";
import { S } from "../strings";

/** Per-player "done" indicator for WRITING (submitted) and VOTING (voted). */
export function PlayerStatus({ snapshot, field }: { snapshot: Snapshot; field: "hasSubmitted" | "hasVoted" }) {
  return (
    <ul className="player-status">
      {snapshot.players.map((p) => (
        <li key={p.id} className={`${p[field] ? "done" : ""} ${p.connected ? "" : "offline"}`}>
          <span className="mark" aria-hidden="true">
            {p[field] ? "✓" : "…"}
          </span>
          {p.nickname}
          {p.id === snapshot.you.id && <small> ({S.youTag})</small>}
          {!p.connected && <small> · {S.disconnected}</small>}
        </li>
      ))}
    </ul>
  );
}
