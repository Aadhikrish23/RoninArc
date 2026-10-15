import { test, expect } from "@playwright/test";
import { asksToReadNotes, parseCollectionCommand, recommendationFollowUp, resolveOrdinals, unsupportedReply, wasAskedFor } from "../../../backend/src/modules/ai/conversation/FollowUps";
import { matchesTitle } from "../../../frontend/src/features/library/utils/titleSearch";

// Playtest round 5: follow-ups the assistant got wrong.
const picks = {
  user: "i want a short roguelike like hades",
  assistant: "New to discover:\n- **Children of Morta**: Shares Indie with Hades\n- **Crypt of the NecroDancer**: Roguelike\n- **Darkwood**: Horror",
};

test.describe("AI follow-ups: 'the second one'", () => {
  test("'add the second one' names the second pick @positive", () => {
    expect(resolveOrdinals("ooh add the second one", picks)).toBe("ooh add Crypt of the NecroDancer");
  });
  test("'number 3' works too @positive", () => {
    expect(resolveOrdinals("add number 3", picks)).toBe("add Darkwood");
  });
  test("without a list to point at, the message is unchanged @negative", () => {
    expect(resolveOrdinals("add the second one", { user: "add hades", assistant: "I've added Hades." })).toBe("add the second one");
  });
  test("an ordinal past the end of the list is unchanged @negative", () => {
    expect(resolveOrdinals("add the fifth one", picks)).toBe("add the fifth one");
  });
});

test.describe("AI follow-ups: refining recommendations", () => {
  test("'nah those are massive games' refines the last ask @positive", () => {
    const combined = recommendationFollowUp("nah those are massive games lol. i mean a roguelike i can finish in like 10-15 hours", picks);
    expect(combined).toContain("roguelike like hades");
    expect(combined).toContain("10-15 hours");
    expect(combined).not.toContain("massive");
  });
  test("an action after picks is not a refinement @negative", () => {
    expect(recommendationFollowUp("add the shorter one", picks)).toBeUndefined();
  });
  test("after something that wasn't a recommendation, nothing to refine @negative", () => {
    expect(recommendationFollowUp("something shorter", { user: "add hades", assistant: "I've added Hades." })).toBeUndefined();
  });
});

test.describe("AI notes: reading is not writing", () => {
  for (const text of ["read me my notes for this game", "did i write any notes on hollow knight", "show my hades notes"]) {
    test(`${JSON.stringify(text)} reads notes @positive`, () => expect(asksToReadNotes(text)).toBe(true));
  }
  for (const text of ["add a note to hades: get the shade cloak", "note: finish gwent in toussaint", "make a note that the boss is weak to fire"]) {
    test(`${JSON.stringify(text)} writes a note @negative`, () => expect(asksToReadNotes(text)).toBe(false));
  }
});

// Playtest round 6: requests the assistant can't do turned into random changes.
test.describe("AI: things it can't do yet", () => {
  for (const text of ["remind me on friday to play bg3 with the boys", "can you set a reminder for saturday", "undo the last thing you did"]) {
    test(`${JSON.stringify(text)} gets an honest no @negative`, () => expect(unsupportedReply(text)).toMatch(/^I can't/));
  }
  test("ordinary requests aren't refused @positive", () => {
    expect(unsupportedReply("rate hollow knight 9")).toBeUndefined();
  });
});

test.describe("AI: collection commands", () => {
  const collections = ["Outer Wilds", "Soulslikes"];
  const recent = [{ user: "remind me saturday", assistant: 'I\'ve added Outer Wilds to your collection "Outer Wilds".' }];

  test("'delete that collection' means the one just mentioned @positive", () => {
    expect(parseCollectionCommand("u made an outer wilds collection, delete that collection pls", collections, recent)).toEqual({ kind: "delete", name: "Outer Wilds" });
  });
  test("'delete the whole collection called Outer Wilds' @positive", () => {
    expect(parseCollectionCommand("no, delete the whole collection called Outer Wilds", collections, [])).toEqual({ kind: "delete", name: "Outer Wilds" });
  });
  test("'rename soulslikes to hard games' @positive", () => {
    expect(parseCollectionCommand("rename soulslikes to Hard Games", collections, [])).toEqual({ kind: "rename", name: "Soulslikes", newName: "Hard Games" });
  });
  test("removing a game FROM a collection is not deleting it @negative", () => {
    expect(parseCollectionCommand("remove hades from my soulslikes collection", collections, [])).toBeUndefined();
  });
  test("removing a game from the library is not deleting a list @negative", () => {
    expect(parseCollectionCommand("remove elden ring, it's not on my list anymore", collections, [])).toBeUndefined();
  });
});

test.describe("AI: only the changes that were asked for", () => {
  test("'add a note on that one: ...' asks for no status change @negative", () => {
    expect(wasAskedFor("SetStatus", "also add a note on that one: stuck on the concierge, try a spear build")).toBe(false);
    expect(wasAskedFor("AddNote", "also add a note on that one: stuck on the concierge, try a spear build")).toBe(true);
  });
  test("'remind me saturday to try outer wilds' asks for no collection @negative", () => {
    expect(wasAskedFor("OrganizeCollection", "remind me saturday to try outer wilds")).toBe(false);
  });
  for (const [type, text] of [
    ["SetStatus", "im droppin cod mw2 its mid"],
    ["CompleteGame", "I finished celeste!!"],
    ["RateGame", "mark witcher 3 as complted and give it a 10"],
    ["SetStatus", "started hades last night"],
  ] as const) {
    test(`${type} for ${JSON.stringify(text)} was asked for @positive`, () => expect(wasAskedFor(type, text)).toBe(true));
  }
});

test.describe("Library search shorthand", () => {
  for (const [query, title, expected] of [
    ["gta", "Grand Theft Auto V", true],
    ["gta 5", "Grand Theft Auto V", true],
    ["rdr2", "Red Dead Redemption 2", true],
    ["witcher", "The Witcher 3: Wild Hunt", true],
    ["gta", "Hades", false],
  ] as const) {
    test(`${JSON.stringify(query)} ${expected ? "finds" : "doesn't find"} ${title} @${expected ? "positive" : "negative"}`, () => {
      expect(matchesTitle(title, query)).toBe(expected);
    });
  }
});
