import type { RevealedOption, Snapshot } from "@lorota/shared";
import { Question } from "../components/PhaseHeader";
import { S, joinNames } from "../strings";

export function Reveal({ snapshot }: { snapshot: Snapshot }) {
  const nick = (id: string | null) => snapshot.players.find((p) => p.id === id)?.nickname ?? "?";
  const textOf = (optionId: string) => snapshot.options?.find((o) => o.id === optionId)?.text ?? "";
  const items = snapshot.revealed;

  return (
    <div className="reveal">
      {snapshot.round && <div className="phase-header"><span className="round">{S.roundOf(snapshot.round.number, snapshot.round.total)}</span></div>}
      <Question text={snapshot.question} />
      <ol className="reveal-list">
        {items.map((r, i) => (
          <RevealCard
            key={r.optionId}
            item={r}
            text={textOf(r.optionId)}
            nick={nick}
            myId={snapshot.you.id}
            latest={i === items.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}

function RevealCard({
  item,
  text,
  nick,
  myId,
  latest,
}: {
  item: RevealedOption;
  text: string;
  nick: (id: string | null) => string;
  myId: string;
  latest: boolean;
}) {
  const isTruth = item.kind === "TRUTH";
  const voters = item.voterIds.map((v) => (v === item.authorId ? S.ownPick(nick(v)) : nick(v)));
  const fooled = item.voterIds.filter((v) => v !== item.authorId).length;
  const involvesMe = item.authorId === myId || item.voterIds.includes(myId);

  let votersLine: string;
  let pointsLine: string;
  if (isTruth) {
    votersLine = voters.length ? S.whoGotIt(joinNames(voters)) : S.nobodyGotIt;
    pointsLine = voters.length ? S.pointsEach(item.pointsEach) : S.noPoints;
  } else {
    votersLine = voters.length ? S.whoFell(joinNames(voters)) : S.nobodyFell;
    pointsLine = fooled ? S.pointsTo(fooled * item.pointsEach, nick(item.authorId)) : S.noPoints;
  }

  return (
    <li className={`reveal-card ${isTruth ? "truth" : "lie"} ${latest ? "latest" : ""} ${involvesMe ? "mine" : ""}`}>
      <div className={`answer-chip ${text ? "" : "blank"}`}>{text || " "}</div>
      <div className="byline">{isTruth ? S.theTruth : S.writtenBy(nick(item.authorId))}</div>
      <div className="voters">{votersLine}</div>
      <div className={`points ${pointsLine === S.noPoints ? "zero" : ""}`}>{pointsLine}</div>
    </li>
  );
}
