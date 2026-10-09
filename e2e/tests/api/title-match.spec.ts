import { test, expect } from "@playwright/test";
import { MIN_CONFIDENT_MATCH, rankByTitle, titleMatchScore } from "../../../backend/src/modules/rawg/titleMatch";

// Pure function behind the AI's "add <game>": picks the RAWG result whose
// title matches what was typed, instead of whichever result RAWG lists first.
// The lists below are real RAWG search results for these queries.
const best = (query: string, names: string[]) => rankByTitle(query, names.map((name) => ({ name })))[0];

test.describe("RAWG title matching", () => {
  for (const [query, names, expected] of [
    ["rdr 2", ["Grand Theft Auto V", "Portal 2", "Left 4 Dead 2", "Red Dead Redemption 2", "Half-Life 2"], "Red Dead Redemption 2"],
    ["gta 5", ["The Elder Scrolls V: Skyrim", "Grand Theft Auto IV", "Grand Theft Auto V", "Gears 5"], "Grand Theft Auto V"],
    ["hollow knight", ["Batman: Arkham Knight", "Hollow Knight: Silksong", "Hollow Knight"], "Hollow Knight"],
    ["witcher 3", ["The Witcher", "The Witcher 3: Wild Hunt", "The Witcher 2"], "The Witcher 3: Wild Hunt"],
    ["botw", ["Breath of Fire", "The Legend of Zelda: Breath of the Wild"], "The Legend of Zelda: Breath of the Wild"],
    ["skyrim", ["Skyrim VR", "The Elder Scrolls V: Skyrim"], "The Elder Scrolls V: Skyrim"],
  ] as const) {
    test(`"${query}" picks ${expected} @positive`, () => {
      const top = best(query, [...names]);
      expect(top.item.name).toBe(expected);
      expect(top.score).toBeGreaterThanOrEqual(MIN_CONFIDENT_MATCH);
    });
  }

  test("ties keep RAWG's own order @positive", () => {
    expect(rankByTitle("fallout", [{ name: "Fallout 4" }, { name: "Fallout 3" }]).map((r) => r.item.name)).toEqual(["Fallout 4", "Fallout 3"]);
  });

  test("nothing related is not a confident match, so the AI won't add it @negative", () => {
    expect(best("zxqv blorp", ["Portal 2", "Half-Life 2"]).score).toBeLessThan(MIN_CONFIDENT_MATCH);
    expect(titleMatchScore("", "Portal 2")).toBe(0);
  });
});
