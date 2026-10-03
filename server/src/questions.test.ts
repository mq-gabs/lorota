import { describe, expect, it } from "vitest";
import { loadQuestions } from "./questions";

describe("questions file", () => {
  const questions = loadQuestions();

  it("has exactly 30 entries with unique ids q001..q030", () => {
    expect(questions).toHaveLength(30);
    expect(new Set(questions.map((q) => q.id)).size).toBe(30);
    questions.forEach((q, i) => expect(q.id).toBe(`q${String(i + 1).padStart(3, "0")}`));
  });

  it("has non-empty text, answer and source, and every text has a blank", () => {
    for (const q of questions) {
      expect(q.text.trim()).not.toBe("");
      expect(q.answer.trim()).not.toBe("");
      expect(q.source.trim()).not.toBe("");
      expect(typeof q.checked).toBe("boolean");
      expect(q.text).toContain("___");
    }
  });
});
