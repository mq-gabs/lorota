import type { Snapshot } from "@lorota/shared";
import { useState } from "react";
import { PhaseHeader, Question } from "../components/PhaseHeader";
import { PlayerStatus } from "../components/PlayerStatus";
import { request } from "../net";
import { S, errorText } from "../strings";

export function Voting({ snapshot }: { snapshot: Snapshot }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = snapshot.yourVote ?? pending;

  const vote = async (optionId: string) => {
    if (chosen) return;
    setPending(optionId);
    const res = await request("vote:submit", { optionId });
    if (!res.ok) {
      setPending(null);
      setError(errorText(res.error));
    }
  };

  return (
    <div className="voting">
      <PhaseHeader snapshot={snapshot} />
      <Question text={snapshot.question} />
      <h3 className="prompt">{S.whatsTheTruth}</h3>
      <div className="options">
        {snapshot.options?.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`option ${o.id === chosen ? "chosen" : ""}`}
            disabled={!!chosen}
            aria-pressed={o.id === chosen}
            onClick={() => vote(o.id)}
          >
            {o.text || " "}
          </button>
        ))}
      </div>
      {chosen && <p className="waiting">{S.youPicked}</p>}
      {error && <p className="error">{error}</p>}
      <PlayerStatus snapshot={snapshot} field="hasVoted" />
    </div>
  );
}
