import { scoreMatch, levenshteinDistance } from "./scoreMatch";

export interface MatchValidationResult {
  accepted: boolean;
  score: number;
  reason: string;
}

/**
 * Validates a scoring match and decides whether to accept or reject it.
 * Thresholds:
 * - >= 90: Accepted automatically
 * - 80-89: Accepted only if titles are "nearly identical"
 * - < 80: Rejected
 */
export function validateMatch(
  normEpic: string,
  normRawg: string
): MatchValidationResult {
  const score = scoreMatch(normEpic, normRawg);

  if (score >= 90) {
    return { accepted: true, score, reason: "High confidence match" };
  }

  if (score >= 80) {
    // Check if titles are "nearly identical"
    const tokensEpic = normEpic.split(/\s+/);
    const tokensRawg = normRawg.split(/\s+/);
    const setEpic = new Set(tokensEpic);
    const setRawg = new Set(tokensRawg);

    // Containment: is one title a complete subset of the other?
    const containmentCount = [...setEpic].filter(x => setRawg.has(x)).length;
    const isEpicContained = containmentCount === setEpic.size;
    const isRawgContained = containmentCount === setRawg.size;

    const wordDiff = Math.abs(setEpic.size - setRawg.size);
    const isContainedWithSmallDiff = (isEpicContained || isRawgContained) && wordDiff <= 1;

    // Calculate Levenshtein similarity
    const dist = levenshteinDistance(normEpic, normRawg);
    const maxLen = Math.max(normEpic.length, normRawg.length);
    const levSim = maxLen > 0 ? (1 - dist / maxLen) * 100 : 0;

    if (levSim >= 70 || isContainedWithSmallDiff) {
      return { accepted: true, score, reason: "Medium confidence match with nearly identical titles" };
    }

    return {
      accepted: false,
      score,
      reason: `Medium confidence but titles not nearly identical (Levenshtein similarity: ${Math.round(levSim)}%, containment: ${isEpicContained || isRawgContained ? "yes" : "no"}, word diff: ${wordDiff})`
    };
  }

  return { accepted: false, score, reason: "Low confidence match" };
}
