import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Theme } from "@lorota/shared";

export interface Question {
  id: string;
  text: string;
  answer: string;
  source: string;
  checked: boolean;
  /** "geral" means the question fits no specific theme and is only drawn in Geral. */
  theme: Theme;
}

// Works from both src/ (dev) and dist/ (prod): each is one level below server/.
export const QUESTIONS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../data/questions.json");

export function loadQuestions(path = QUESTIONS_PATH): Question[] {
  return JSON.parse(readFileSync(path, "utf8")) as Question[];
}
