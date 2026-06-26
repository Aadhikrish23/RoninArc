/**
 * Calculates Levenshtein distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[len1][len2];
}

/**
 * Computes a similarity score from 0 to 100 between two normalized titles.
 * Uses exact match, Levenshtein, token Jaccard, token containment, and substring bonuses.
 */
export function scoreMatch(normEpic: string, normRawg: string): number {
  if (normEpic === normRawg) return 100;
  if (!normEpic || !normRawg) return 0;

  const dist = levenshteinDistance(normEpic, normRawg);
  const maxLen = Math.max(normEpic.length, normRawg.length);
  const levSim = maxLen > 0 ? (1 - dist / maxLen) * 100 : 0;

  const tokensEpic = normEpic.split(/\s+/);
  const tokensRawg = normRawg.split(/\s+/);
  const setEpic = new Set(tokensEpic);
  const setRawg = new Set(tokensRawg);

  const intersection = tokensEpic.filter(x => setRawg.has(x));
  const uniqueIntersection = new Set(intersection);
  const union = new Set([...tokensEpic, ...tokensRawg]);

  const jaccard = union.size > 0 ? (uniqueIntersection.size / union.size) * 100 : 0;

  const shorterSet = setEpic.size < setRawg.size ? setEpic : setRawg;
  const longerSet = setEpic.size < setRawg.size ? setRawg : setEpic;
  const containmentCount = [...shorterSet].filter(x => longerSet.has(x)).length;
  const containment = shorterSet.size > 0 ? (containmentCount / shorterSet.size) * 100 : 0;

  let substringBonus = 0;
  if (normEpic.includes(normRawg) || normRawg.includes(normEpic)) {
    substringBonus = 15;
  }

  // Combined score (weights: 40% Levenshtein, 30% Jaccard, 30% Containment, plus Substring Bonus)
  let combined = (levSim * 0.4) + (jaccard * 0.3) + (containment * 0.3) + substringBonus;

  if (combined > 100) combined = 100;

  return Math.round(combined);
}
