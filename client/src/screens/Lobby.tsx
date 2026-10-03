import { MAX_PLAYERS, MIN_PLAYERS } from "@lorota/shared";
import type { Snapshot } from "@lorota/shared";
import { useState } from "react";
import { request } from "../net";
import { S, errorText } from "../strings";

export function Lobby({ snapshot, onLeave }: { snapshot: Snapshot; onLeave: () => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = snapshot.players.filter((p) => p.connected).length;

  const copyLink = async () => {
    const url = `${window.location.origin}/r/${snapshot.roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(S.copyInvite, url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const start = async () => {
    const res = await request("game:start", {});
    setError(res.ok ? null : errorText(res.error));
  };

  return (
    <div className="lobby">
      <section className="card center">
        <span className="label">{S.roomCode}</span>
        <div className="big-code">{snapshot.roomCode}</div>
        <button type="button" className="btn" onClick={copyLink}>
          {copied ? S.linkCopied : S.copyInvite}
        </button>
      </section>

      <section className="card">
        <h2>
          {S.players} ({connected}/{MAX_PLAYERS})
        </h2>
        <ul className="lobby-players">
          {snapshot.players.map((p) => {
            const isHost = p.id === snapshot.hostId;
            return (
              <li key={p.id} className={p.connected ? "" : "offline"}>
                <span className="name">{p.nickname}</span>
                {p.id === snapshot.you.id && <span className="tag">{S.youTag}</span>}
                {isHost && <span className="tag host">{S.hostTag}</span>}
                {!p.connected && <span className="tag">{S.disconnected}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {snapshot.you.isHost ? (
        <div className="actions">
          <button type="button" className="btn primary wide" disabled={connected < MIN_PLAYERS} onClick={start}>
            {S.startGame}
          </button>
          {connected < MIN_PLAYERS && <p className="hint">{S.needMorePlayers}</p>}
        </div>
      ) : (
        <p className="waiting">{S.waitingHost}</p>
      )}
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn ghost" onClick={onLeave}>
        {S.leaveRoom}
      </button>
    </div>
  );
}

