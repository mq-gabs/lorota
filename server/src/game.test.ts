import { FOOL_POINTS, TRUTH_POINTS } from "@lorota/shared";
import { describe, expect, it } from "vitest";
import { buildOptions, buildReveal, resolveAnswers, scoreRound } from "./game";
import type { Option } from "./game";

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const lie = (id: string, authorId: string, text = ""): Option => ({ id, text, kind: "LIE", authorId });
const truth = (id = "t"): Option => ({ id, text: "VERDADE", kind: "TRUTH", authorId: null });
const votes = (o: Record<string, string>) => new Map(Object.entries(o));

describe("scoreRound", () => {
  it("matches the spec example", () => {
    const options = [lie("a", "A"), lie("b", "B"), lie("c", "C"), lie("d", "D"), truth()];
    const gains = scoreRound(options, votes({ A: "t", B: "a", C: "a", D: "d" }));
    expect(gains.get("A")).toBe(2000);
    expect(gains.get("B") ?? 0).toBe(0);
    expect(gains.get("C") ?? 0).toBe(0);
    expect(gains.get("D") ?? 0).toBe(0);
  });

  it("gives nothing for picking your own answer", () => {
    const gains = scoreRound([lie("a", "A"), lie("b", "B"), truth()], votes({ A: "a" }));
    expect(gains.get("A") ?? 0).toBe(0);
  });

  it("scores identical answers separately", () => {
    const options = [lie("a", "A", "X"), lie("b", "B", "X"), lie("c", "C", "Y"), truth()];
    const gains = scoreRound(options, votes({ C: "b" }));
    expect(gains.get("B")).toBe(FOOL_POINTS);
    expect(gains.get("A") ?? 0).toBe(0);
  });

  it("treats a player's copy of the truth as a lie", () => {
    const options = [lie("a", "A", "VERDADE"), lie("b", "B", "Y"), truth()];
    const gains = scoreRound(options, votes({ B: "a" }));
    expect(gains.get("A")).toBe(FOOL_POINTS);
    expect(gains.get("B") ?? 0).toBe(0);
  });

  it("gives non-voters nothing", () => {
    const options = [lie("a", "A"), lie("b", "B"), truth()];
    const gains = scoreRound(options, votes({ A: "t" }));
    expect(gains.get("A")).toBe(TRUTH_POINTS);
    expect(gains.get("B") ?? 0).toBe(0);
  });
});

describe("buildOptions", () => {
  const ids = ["A", "B", "C", "D"];

  it("has one option per player plus exactly one truth", () => {
    for (const n of [2, 3, 4]) {
      const answers = new Map(ids.slice(0, n).map((id) => [id, `resposta ${id}`]));
      const options = buildOptions(ids.slice(0, n), answers, "morto", seeded(n));
      expect(options).toHaveLength(n + 1);
      expect(options.filter((o) => o.kind === "TRUTH")).toHaveLength(1);
      expect(options.find((o) => o.kind === "TRUTH")!.text).toBe("MORTO");
      expect(new Set(options.map((o) => o.authorId).filter(Boolean))).toEqual(new Set(ids.slice(0, n)));
      expect(new Set(options.map((o) => o.id)).size).toBe(n + 1);
    }
  });

  it("keeps empty answers, answers equal to the truth and duplicates, never merging", () => {
    const answers = new Map([
      ["A", ""],
      ["B", "Morto!"],
      ["C", "vivo"],
      ["D", "VIVO"],
    ]);
    const options = buildOptions(ids, answers, "morto", seeded(7));
    expect(options).toHaveLength(5);
    const texts = options.map((o) => o.text).sort();
    expect(texts).toEqual(["", "MORTO", "MORTO", "VIVO", "VIVO"]);
    expect(options.filter((o) => o.text === "MORTO" && o.kind === "TRUTH")).toHaveLength(1);
    expect(options.find((o) => o.authorId === "A")!.text).toBe("");
  });

  it("gives players with no answer an empty option", () => {
    const options = buildOptions(["A", "B"], new Map(), "x", seeded(3));
    expect(options.filter((o) => o.kind === "LIE").map((o) => o.text)).toEqual(["", ""]);
  });
});

describe("resolveAnswers (timeout)", () => {
  it("uses the submitted answer, else the last draft, else empty", () => {
    const answers = resolveAnswers(
      ["A", "B", "C"],
      new Map([["A", "enviada"]]),
      new Map([
        ["A", "rascunho a"],
        ["B", "rascunho b"],
      ]),
    );
    expect(answers.get("A")).toBe("ENVIADA");
    expect(answers.get("B")).toBe("RASCUNHO B");
    expect(answers.get("C")).toBe("");
  });
});

describe("buildReveal", () => {
  it("orders lies by votes ascending (stable), truth last", () => {
    const options = [lie("a", "A"), lie("b", "B"), truth(), lie("c", "C"), lie("d", "D")];
    const reveal = buildReveal(options, votes({ A: "b", B: "b", C: "d", D: "t" }));
    expect(reveal.map((r) => r.optionId)).toEqual(["a", "c", "d", "b", "t"]);
    expect(reveal.at(-1)).toMatchObject({ kind: "TRUTH", authorId: null, voterIds: ["D"], pointsEach: TRUTH_POINTS });
    expect(reveal.find((r) => r.optionId === "b")).toMatchObject({ authorId: "B", voterIds: ["A", "B"] });
  });
});
