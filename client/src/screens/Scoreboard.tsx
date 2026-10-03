import type { Snapshot } from "@lorota/shared";
import { PhaseHeader } from "../components/PhaseHeader";
import { Ranking } from "../components/Ranking";
import { S } from "../strings";

export function Scoreboard({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="scoreboard">
      <PhaseHeader snapshot={snapshot} timer={false} />
      <h2 className="title">{S.scoreboard}</h2>
      <Ranking snapshot={snapshot} showGain />
    </div>
  );
}
