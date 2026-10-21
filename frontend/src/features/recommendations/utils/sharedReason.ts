import type { Recommendation } from "../types/recommendation";

/**
 * "Roguelite, like Hades" under every Discover card read like a template. When one reason is on
 * every pick, it describes the list, so it moves to the list's subtitle and comes off the cards.
 */
export function liftSharedReason(recs: Recommendation[]): { recs: Recommendation[]; shared?: string } {
  if (recs.length < 2) return { recs };
  const shared = recs[0].reasons.find((reason) => !/^(You're in the middle|On pause|Shorter:)/.test(reason) && recs.every((r) => r.reasons.includes(reason)));
  if (!shared) return { recs };
  return { recs: recs.map((r) => ({ ...r, reasons: r.reasons.filter((reason) => reason !== shared) })), shared };
}
