import { describe, expect, it } from "vitest";
import { MAX_LIE_LENGTH } from "./config";
import { formatLive, normalize } from "./format";

describe("formatLive / normalize", () => {
  it("handles the spec examples", () => {
    expect(normalize("não sei!")).toBe("NÃO SEI");
    expect(normalize("guarda-chuva")).toBe("GUARDA CHUVA");
    expect(normalize("d'água")).toBe("DÁGUA");
    expect(normalize("d’água")).toBe("DÁGUA");
    expect(normalize("!!!")).toBe("");
  });

  it("keeps a single trailing space in formatLive and removes it in normalize", () => {
    expect(formatLive("lata ")).toBe("LATA ");
    expect(formatLive("lata    ")).toBe("LATA ");
    expect(formatLive("lata,")).toBe("LATA ");
    expect(normalize("lata ")).toBe("LATA");
  });

  it("removes leading and repeated spaces", () => {
    expect(formatLive("   cabo   de    guerra")).toBe("CABO DE GUERRA");
    expect(formatLive(" ")).toBe("");
    expect(normalize("  a  -  b  ")).toBe("A B");
  });

  it("keeps accents and digits, composes to NFC", () => {
    expect(normalize("açúcar 1923")).toBe("AÇÚCAR 1923");
    expect(normalize("água")).toBe("ÁGUA");
  });

  it("truncates at MAX_LIE_LENGTH", () => {
    const long = "a".repeat(60);
    expect(formatLive(long)).toHaveLength(MAX_LIE_LENGTH);
    expect(normalize(`${"b".repeat(39)} c`)).toBe("B".repeat(39));
    expect(formatLive(`${"b".repeat(39)} c`)).toBe(`${"B".repeat(39)} `);
  });

  it("turns emoji into spaces", () => {
    expect(normalize("😀")).toBe("");
    expect(normalize("oi😀tchau")).toBe("OI TCHAU");
    expect(formatLive("pizza 🍕🍕")).toBe("PIZZA ");
  });

  it("is idempotent", () => {
    for (const s of ["não sei!", "  x  y ", "d'água", "😀a"]) {
      expect(normalize(normalize(s))).toBe(normalize(s));
      expect(formatLive(formatLive(s))).toBe(formatLive(s));
    }
  });
});
