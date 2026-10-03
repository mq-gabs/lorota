import type { Snapshot } from "@lorota/shared";
import { useState } from "react";
import { Ranking, rankedPlayers } from "../components/Ranking";
import { request } from "../net";
import { S, errorText, joinNames } from "../strings";

export function GameOver({ snapshot, onLeave }: { snapshot: Snapshot; onLeave: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const winners = rankedPlayers(snapshot)
    .filter((p) => p.position === 1)
    .map((p) => p.nickname);

  const playAgain = async () => {
    const res = await request("game:playAgain", {});
    setError(res.ok ? null : errorText(res.error));
  };

  return (
    <div className="game-over">
      <h2 className="title">{S.gameOver}</h2>
      <p className="winner-line">
        {winners.length > 1 ? S.winnersAre(joinNames(winners)) : S.winnerIs(winners[0] ?? "")}
      </p>
      <Ranking snapshot={snapshot} showGain={false} highlightWinners />
      {snapshot.you.isHost ? (
        <button type="button" className="btn primary wide" onClick={playAgain}>
          {S.playAgain}
        </button>
      ) : (
        <p className="waiting">{S.waitingPlayAgain}</p>
      )}
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn ghost" onClick={onLeave}>
        {S.leaveRoom}
      </button>
    </div>
  );
}
