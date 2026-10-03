import { useEffect, useState } from "react";
import { secondsLeft } from "../net";
import { S } from "../strings";

/** Seconds left, computed from the server's phaseEndsAt (not from when this rendered). */
export function useSecondsLeft(phaseEndsAt: number | null): number {
  const [left, setLeft] = useState(() => secondsLeft(phaseEndsAt));
  useEffect(() => {
    setLeft(secondsLeft(phaseEndsAt));
    const id = setInterval(() => setLeft(secondsLeft(phaseEndsAt)), 200);
    return () => clearInterval(id);
  }, [phaseEndsAt]);
  return left;
}

export function Countdown({ phaseEndsAt }: { phaseEndsAt: number | null }) {
  const left = useSecondsLeft(phaseEndsAt);
  return (
    <div className={`countdown ${left <= 5 ? "urgent" : left <= 10 ? "hurry" : ""}`} role="timer">
      {S.secondsLeft(left)}
    </div>
  );
}
