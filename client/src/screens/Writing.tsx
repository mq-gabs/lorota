import type { Snapshot } from "@lorota/shared";
import { useState } from "react";
import { LieInput } from "../components/LieInput";
import { PhaseHeader, Question } from "../components/PhaseHeader";
import { PlayerStatus } from "../components/PlayerStatus";
import { request, socket } from "../net";
import { S, errorText } from "../strings";

export function Writing({ snapshot }: { snapshot: Snapshot }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = snapshot.yourAnswer !== null;

  const submit = async (text: string) => {
    setSending(true);
    const res = await request("lie:submit", { text });
    setSending(false);
    setError(res.ok ? null : errorText(res.error));
  };

  return (
    <div className="writing">
      <PhaseHeader snapshot={snapshot} />
      <Question text={snapshot.question} />
      {sent ? (
        <section className="card center">
          <span className="label">{S.youSent}</span>
          <div className={`answer-chip ${snapshot.yourAnswer ? "" : "blank"}`}>{snapshot.yourAnswer || S.blankAnswer}</div>
          <p className="waiting">{S.waitingOthers}</p>
        </section>
      ) : (
        <LieInput onDraft={(text) => socket.emit("lie:draft", { text })} onSubmit={submit} disabled={sending} />
      )}
      {error && <p className="error">{error}</p>}
      <PlayerStatus snapshot={snapshot} field="hasSubmitted" />
    </div>
  );
}
