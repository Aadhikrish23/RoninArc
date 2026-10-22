import { test, expect } from "@playwright/test";
import { buildTasteProfile, rankDiscover } from "../../../backend/src/modules/recommendation/recommendationEngine";
import { collectionDirectionFor, pinPronoun, simpleAddTitle } from "../../../backend/src/modules/ai/domains/games/conversation/FollowUps";
import { namedTitles } from "../../../backend/src/modules/ai/domains/games/conversation/TargetGrounding";
import { ensureCollectionAdds } from "../../../backend/src/modules/ai/domains/games/pipeline/StatusEvidence";
import { shapePlan } from "../../../backend/src/modules/ai/domains/games/pipeline/PlanShaping";

// Findings from playtest round 24.

test.describe("'it' after adding a game in the same message", () => {
  const owned = ["Hades", "Stardew Valley"];
  // PreRoute's own lookup: a clause that adds a game names that game, even though it isn't owned yet.
  const nameIn = (clause: string) => simpleAddTitle(clause) ?? namedTitles(clause, owned)[0];

  test("'add hades 2 and put it in X' puts Hades II there, not the owned Hades @positive", () => {
    expect(pinPronoun("add hades 2 and put it in mind-blowers", "Hades", nameIn)).toBe("add hades 2 and put hades 2 in mind-blowers");
  });

  test("'add silksong and throw it in soulslikes' doesn't fall back to the last game talked about @negative", () => {
    expect(pinPronoun("add silksong and throw it in soulslikes, also hollow knight", "Stardew Valley", nameIn)).toContain("throw silksong in soulslikes");
  });

  test("the pinned 'hades 2' doesn't also add the owned Hades to the collection @negative", () => {
    const plan: any = {
      intents: [
        { type: "AddGame", targets: [{ type: "Library", name: "Hades 2" }], parameters: [] },
        { type: "OrganizeCollection", targets: [{ type: "Collection", name: "mind-blowers" }, { type: "Game", name: "Hades 2" }], parameters: [] },
      ],
    };
    ensureCollectionAdds(plan, "add hades 2 and put hades 2 in mind-blowers", owned, ["mind-blowers"]);
    expect(plan.intents).toHaveLength(2);
  });
});

test.describe("a correction that moves games between a collection", () => {
  const message = "no lol i meant silksong goes in soulslikes, not stardew. take stardew out of there";

  test("each game goes by its own part of the message @positive", () => {
    expect(collectionDirectionFor(message, "Hollow Knight: Silksong")).toBe("add");
    expect(collectionDirectionFor(message, "Stardew Valley")).toBe("remove");
  });

  test("a game the message doesn't name has no direction of its own @negative", () => {
    expect(collectionDirectionFor(message, "Elden Ring")).toBeUndefined();
  });

  test("'X goes in Y' adds X even when the model left it out @positive", () => {
    const plan: any = {
      intents: [{ type: "OrganizeCollection", targets: [{ type: "Collection", name: "soulslikes" }, { type: "Game", name: "Stardew Valley" }], parameters: [{ type: "Boolean", value: false }] }],
    };
    ensureCollectionAdds(plan, message, ["Hollow Knight: Silksong", "Stardew Valley"], ["soulslikes"]);
    const added = plan.intents.find((i: any) => i.targets.some((t: any) => t.name === "Hollow Knight: Silksong"));
    expect(added?.parameters).toEqual([{ type: "Boolean", value: true }]);
  });
});

test.describe("a note in the same message as a rating", () => {
  const message = "rate witcher 3 8.5 and add a note to it: blood and wine dlc still unplayed";
  const rating = (text?: string): any => ({
    type: "RateGame",
    targets: [{ type: "Game", name: "The Witcher 3: Wild Hunt" }],
    parameters: [{ type: "Rating", value: 8.5 }, ...(text ? [{ type: "Text", value: text }] : [])],
  });

  test("note text the model put in the rating becomes a note, not the review @positive", () => {
    const plan: any = { intents: [rating("blood and wine dlc still unplayed")] };
    shapePlan(plan, message, true);
    expect(plan.intents.map((i: any) => i.type)).toEqual(["RateGame", "AddNote"]);
    expect(plan.intents[0].parameters).toEqual([{ type: "Rating", value: 8.5 }]);
    expect(plan.intents[1].parameters[0].value).toBe("blood and wine dlc still unplayed");
  });

  test("with the note already planned, the rating just loses the copied text @negative", () => {
    const note = { type: "AddNote", targets: [{ type: "Game", name: "The Witcher 3: Wild Hunt" }], parameters: [{ type: "Text", value: "blood and wine dlc still unplayed" }] };
    const plan: any = { intents: [rating("blood and wine dlc still unplayed"), note] };
    shapePlan(plan, message, true);
    expect(plan.intents.filter((i: any) => i.type === "AddNote")).toHaveLength(1);
    expect(plan.intents[0].parameters).toEqual([{ type: "Rating", value: 8.5 }]);
  });

  test("a real comment on a rating is kept @negative", () => {
    const plan: any = { intents: [rating("it was amazing")] };
    shapePlan(plan, "rate hollow knight 9 it was amazing", true);
    expect(plan.intents[0].parameters).toContainEqual({ type: "Text", value: "it was amazing" });
  });
});

test.describe("length reasons on recommendations", () => {
  const profile = buildTasteProfile([]);
  const pick = (candidate: any, options: any = {}) =>
    rankDiscover([{ id: 1, rating: 4.4, metacritic: 85, ...candidate }], [], profile, { limit: 3, dismissed: new Set(), length: "short", ...options })[0];

  test("open-ended games make no length claim @negative", () => {
    const stardew = pick({ name: "Stardew Valley", genres: ["Simulation", "RPG", "Indie"], avgHours: 13 });
    expect(stardew?.reasons.join(" | ") ?? "").not.toMatch(/players log/);
  });

  test("'shorter' says what it's shorter than @positive", () => {
    const short = pick({ name: "Crypt of the NecroDancer", genres: ["Action", "Indie"], avgHours: 4 }, { like: { title: "Hades", tags: ["Roguelike"] } });
    expect(short.reasons).toContain("Shorter than Hades: players log about 4h");
  });

  test("without a game to compare with it just says short @positive", () => {
    const short = pick({ name: "Limbo", genres: ["Platformer", "Indie"], avgHours: 4 });
    expect(short.reasons).toContain("Short: players log about 4h");
  });

  test("asking for something long never says 'shorter' @negative", () => {
    const long = pick({ name: "The Witcher 3: Wild Hunt", genres: ["RPG"], avgHours: 60 }, { length: "long" });
    expect(long.reasons.join(" | ")).not.toMatch(/Short/);
    expect(long.reasons).toContain("Long: players log about 60h");
  });
});
