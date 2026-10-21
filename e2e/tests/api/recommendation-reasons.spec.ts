import { test, expect } from "@playwright/test";
import { buildTasteProfile, diversifyReasons, rankDiscover } from "../../../backend/src/modules/recommendation/recommendationEngine";

// Playtesters (rounds 16-20): every card said "Matches your taste for Action" or "Critically
// acclaimed", and Sekiro was "Similar to The Witcher 3" for sharing Action, Adventure and RPG.
test.describe("Recommendation reasons", () => {
  const rec = (reasons: string[], extra: Partial<{ genres: string[]; released: string; source: string }> = {}) => ({
    reasons,
    genres: extra.genres ?? ["Platformer", "Indie"],
    released: extra.released ?? "2018-01-25",
    source: extra.source ?? "rawg",
  });

  test("the same kind of reason appears on at most two cards @positive", () => {
    const out = diversifyReasons([
      rec(["Critically acclaimed (Metacritic 94)"]),
      rec(["Critically acclaimed (Metacritic 92)"]),
      rec(["Critically acclaimed (Metacritic 91)", "Shorter: about 8h on average"]),
      rec(["Critically acclaimed (Metacritic 90)"]),
    ]);
    expect(out.map((r) => r.reasons)).toEqual([
      ["Critically acclaimed (Metacritic 94)"],
      ["Critically acclaimed (Metacritic 92)"],
      ["Shorter: about 8h on average"],
      ["Released in 2018"],
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
      [{ id: 7, name: "Sekiro: Shadows Die Twice", genres: ["Action", "Adventure", "RPG"], rating: 4.4, metacritic: 88 } as any],
      [],
      profile,
      { limit: 3, dismissed: new Set() },
    );
    expect(pick.reasons.join(" | ")).not.toContain("Similar to The Witcher 3");
  });
});
