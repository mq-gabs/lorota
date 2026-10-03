// Pure game rules: option building, scoring and reveal ordering. No I/O, no timers.
import { FOOL_POINTS, TRUTH_POINTS, normalize } from "@lorota/shared";
import type { RevealedOption } from "@lorota/shared";

export type Rng = () => number;

export interface Option {
  id: string;
  text: string; // normalized
  kind: "LIE" | "TRUTH";
  authorId: string | null;
}

export function randomId(rng: Rng, length = 10): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) id += alphabet[Math.floor(rng() * alphabet.length)];
  return id;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Final answer of every player for the round: their submitted answer, else their
 * last draft, else empty. Every listed player gets exactly one answer.
 */
export function resolveAnswers(
  playerIds: readonly string[],
  submitted: ReadonlyMap<string, string>,
  drafts: ReadonlyMap<string, string>,
): Map<string, string> {
  const answers = new Map<string, string>();
  for (const id of playerIds) {
    answers.set(id, normalize(submitted.get(id) ?? drafts.get(id) ?? ""));
  }
  return answers;
}

/** One option per player plus the truth, shuffled. Nothing is ever merged or dropped. */
export function buildOptions(
  playerIds: readonly string[],
  answers: ReadonlyMap<string, string>,
  truth: string,
  rng: Rng,
): Option[] {
  const options: Option[] = playerIds.map((id) => ({
    id: "",
    text: normalize(answers.get(id) ?? ""),
    kind: "LIE",
    authorId: id,
  }));
  options.push({ id: "", text: normalize(truth), kind: "TRUTH", authorId: null });
  const used = new Set<string>();
  for (const o of options) {
    let id: string;
    do id = randomId(rng, 8);
    while (used.has(id));
    used.add(id);
    o.id = id;
  }
  return shuffle(options, rng);
}

/** Points gained this round per player id (only players who gained something appear). */
export function scoreRound(options: readonly Option[], votes: ReadonlyMap<string, string>): Map<string, number> {
  const byId = new Map(options.map((o) => [o.id, o]));
  const gains = new Map<string, number>();
  const add = (id: string, n: number) => gains.set(id, (gains.get(id) ?? 0) + n);
  for (const [voterId, optionId] of votes) {
    const o = byId.get(optionId);
    if (!o) continue;
    if (o.kind === "TRUTH") add(voterId, TRUTH_POINTS);
    else if (o.authorId && o.authorId !== voterId) add(o.authorId, FOOL_POINTS);
  }
  return gains;
}

/**
 * Reveal sequence: lies from fewest to most votes (stable on voting-screen order),
 * then the truth last.
 */
export function buildReveal(options: readonly Option[], votes: ReadonlyMap<string, string>): RevealedOption[] {
  const votersOf = (id: string) => [...votes].filter(([, o]) => o === id).map(([v]) => v);
  const lies = options
    .filter((o) => o.kind === "LIE")
    .map((o, index) => ({ o, index, voters: votersOf(o.id) }))
    .sort((a, b) => a.voters.length - b.voters.length || a.index - b.index);
  const truth = options.find((o) => o.kind === "TRUTH")!;
  return [
    ...lies.map(({ o, voters }) => ({
      optionId: o.id,
      kind: "LIE" as const,
      authorId: o.authorId,
      voterIds: voters,
      pointsEach: FOOL_POINTS,
    })),
    {
      optionId: truth.id,
      kind: "TRUTH" as const,
      authorId: null,
      voterIds: votersOf(truth.id),
      pointsEach: TRUTH_POINTS,
    },
  ];
}

