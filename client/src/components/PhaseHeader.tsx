import type { Snapshot } from "@lorota/shared";
import { S } from "../strings";
import { Countdown } from "./Countdown";

export function PhaseHeader({ snapshot, timer = true }: { snapshot: Snapshot; timer?: boolean }) {
  return (
    <div className="phase-header">
      {snapshot.round && (
        <span className="round">
          {S.roundOf(snapshot.round.number, snapshot.round.total)} · {S.themes[snapshot.theme]}
        </span>
      )}
      {timer && <Countdown phaseEndsAt={snapshot.phaseEndsAt} />}
    </div>
  );
}

export function Question({ text }: { text: string | null }) {
  if (!text) return null;
  const parts = text.split("___");
  return (
    <h2 className="question">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <span className="blank">_____</span>}
        </span>
      ))}
    </h2>
  );
}
