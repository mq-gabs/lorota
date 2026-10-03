import { rankPositions } from "@lorota/shared";
import type { Snapshot } from "@lorota/shared";
import { S } from "../strings";

export function rankedPlayers(snapshot: Snapshot) {
  const players = [...snapshot.players].sort((a, b) => b.score - a.score);
  const positions = rankPositions(players.map((p) => p.score));
  return players.map((p, i) => ({ ...p, position: positions[i] }));
}

export function Ranking({ snapshot, showGain, highlightWinners }: { snapshot: Snapshot; showGain: boolean; highlightWinners?: boolean }) {
  return (
    <ol className="ranking">
      {rankedPlayers(snapshot).map((p) => (
        <li
          key={p.id}
          className={`${highlightWinners && p.position === 1 ? "winner" : ""} ${p.id === snapshot.you.id ? "me" : ""}`}
        >
          <span className="pos">{S.position(p.position)}</span>
          <span className="name">
            {p.nickname}
            {!p.connected && <small> · {S.disconnected}</small>}
          </span>
          {showGain && <span className={`gain ${p.roundGain > 0 ? "positive" : ""}`}>{S.roundGain(p.roundGain)}</span>}
          <span className="score">{S.points(p.score)}</span>
        </li>
      ))}
    </ol>
  );
}
