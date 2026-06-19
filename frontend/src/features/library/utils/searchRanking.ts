import type { RawgGameResult } from "../types/library";

function calculateScore(
  game: RawgGameResult,
  query: string
): number {
  const name = game.name.toLowerCase();
  const q = query.toLowerCase().trim();

  let score = 0;

  // Exact match
  if (name === q) {
    score += 100000;
  }

  // Starts with query
  if (name.startsWith(q)) {
    score += 50000;
  }

  // Contains full query
  if (name.includes(q)) {
    score += 20000;
  }

  // Word matches
  const queryWords = q.split(" ").filter(Boolean);

  for (const word of queryWords) {
    if (name.includes(word)) {
      score += 5000;
    }
  }

  // Popularity
  score += (game.added ?? 0) * 0.2;
  score += (game.ratingsCount ?? 0) * 2;
  score += (game.metacritic ?? 0) * 50;
  score += (game.rating ?? 0) * 500;

  // Penalties
  if ((game.rating ?? 0) === 0) {
    score -= 5000;
  }

  if ((game.ratingsCount ?? 0) === 0) {
    score -= 5000;
  }

  if ((game.added ?? 0) < 10) {
    score -= 10000;
  }

  return score;
}

export function rankSearchResults(
  results: RawgGameResult[],
  query: string
): RawgGameResult[] {
  if (!query.trim()) {
    return results;
  }

  return [...results]
    .sort(
      (a, b) =>
        calculateScore(b, query) -
        calculateScore(a, query)
    )
    .filter((game) => {
      const score = calculateScore(game, query);

      return score > 0;
    });
}