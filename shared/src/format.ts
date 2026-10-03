import { MAX_LIE_LENGTH } from "./config";

/** Formatting applied to the answer input on every change while typing (spec 2.3). */
export function formatLive(text: string): string {
  let s = text.normalize("NFC").toLocaleUpperCase("pt-BR");
  s = s.replace(/['’]/g, "").replace(/[^\p{L}\p{N} ]/gu, " ");
  s = s.replace(/ {2,}/g, " ").replace(/^ /, "");
  const chars = Array.from(s);
  return chars.length > MAX_LIE_LENGTH ? chars.slice(0, MAX_LIE_LENGTH).join("") : s;
}

/** Final form of an answer: stored and displayed. */
export function normalize(text: string): string {
  return formatLive(text).replace(/ $/, "");
}

/** Length in user-perceived characters (code points), as used for limits. */
export function charLength(text: string): number {
  return Array.from(text).length;
}
