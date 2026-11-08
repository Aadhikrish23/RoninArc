import { test, expect } from "@playwright/test";
import { buildTasteProfile, diversifyReasons, rankDiscover } from "../../../backend/src/modules/recommendation/recommendationEngine";

// Playtesters (rounds 16-20): every card said "Matches your taste for Action" or "Critically
// acclaimed", and Sekiro was "Similar to The Witcher 3" for sharing Action, Adventure and RPG.
test.describe("Recommendation reasons", () => {
  const rec = (reasons: string[], extra: Partial<{ genres: string[]; released: string; source: string }> = {}) => ({
    reasons,
    genres: extra.genres ?? ["Platformer", "Indie"],
    released: extra.released ?? "2018-01-25",
    source: extra.source ?? "igdb",
  });

  test("a repeated reason gives way when a card has another one @positive", () => {
    const out = diversifyReasons([
      rec(["Critically acclaimed (critics 94/100)"]),
      rec(["Critically acclaimed (critics 92/100)"]),
      rec(["Critically acclaimed (critics 91/100)", "Shorter: about 8h on average"]),
      rec(["Critically acclaimed (critics 90/100)"]),
    ]);
    expect(out.map((r) => r.reasons)).toEqual([
      ["Critically acclaimed (critics 94/100)"],
      ["Critically acclaimed (critics 92/100)"],
      ["Shorter: about 8h on average"],
      // Nothing else to say: it keeps its own reason rather than filler.
      ["Critically acclaimed (critics 90/100)"],
    ]);
  });

  test("status and length reasons are never trimmed @negative", () => {
    const out = diversifyReasons([1, 2, 3].map(() => rec(["You're in the middle of it"], { source: "library" })));
    expect(out.every((r) => r.reasons[0] === "You're in the middle of it")).toBe(true);
  });

  test("sharing only broad genres is not 'similar' @negative", () => {
    const profile = buildTasteProfile([
      { _id: "1", title: "The Witcher 3: Wild Hunt", tags: ["Action", "Adventure", "RPG"], progressStatus: "completed", rating: 10 } as any,
    ]);
    const [pick] = rankDiscover(
      [{ id: 7, name: "Sekiro: Shadows Die Twice", genres: ["Action", "Adventure", "RPG"], rating: 4.4, criticScore: 88 } as any],
      [],
      profile,
      { limit: 3, dismissed: new Set() },
    );
    expect(pick.reasons.join(" | ")).not.toContain("Similar to The Witcher 3");
  });
});
