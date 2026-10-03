/** Competition ranking: tied scores share a position (1, 1, 3). */
export function rankPositions(scores: readonly number[]): number[] {
  return scores.map((s) => 1 + scores.filter((t) => t > s).length);
}
