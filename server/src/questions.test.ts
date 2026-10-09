import { THEMES } from "@lorota/shared";
import { describe, expect, it } from "vitest";
import { loadQuestions } from "./questions";

describe("questions file", () => {
  const questions = loadQuestions();

  it("has exactly 186 entries with unique ids q001..q186", () => {
    expect(questions).toHaveLength(186);
    expect(new Set(questions.map((q) => q.id)).size).toBe(186);
    questions.forEach((q, i) => expect(q.id).toBe(`q${String(i + 1).padStart(3, "0")}`));
  });

  it("has non-empty text, answer and source, and every text has a blank", () => {
    for (const q of questions) {
      expect(q.text.trim()).not.toBe("");
      expect(q.answer.trim()).not.toBe("");
      expect(q.source.trim()).not.toBe("");
      expect(typeof q.checked).toBe("boolean");
      expect(q.text).toContain("___");
      expect(THEMES).toContain(q.theme);
    }
  });

  it("has at least 30 questions in every specific theme", () => {
    for (const theme of THEMES.filter((t) => t !== "geral")) {
      expect(questions.filter((q) => q.theme === theme).length, theme).toBeGreaterThanOrEqual(30);
    }
  });

  it("has no repeated questions or answers", () => {
    expect(new Set(questions.map((q) => q.text)).size).toBe(questions.length);
    expect(new Set(questions.map((q) => q.answer.toLowerCase())).size).toBe(questions.length);
  });
});
