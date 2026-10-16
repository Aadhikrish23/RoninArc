import { test, expect } from "@playwright/test";
import { asksForOpinion, asksToReadNotes, collectionDirection, isQuestionOnly, meansDroppedStatus, normalizeSlang, parseCollectionCommand, parseQuickCommand, recommendationFollowUp, resolveOrdinals, simpleAddTitle, statedScore, unsupportedReply, wasAskedFor, withPageGame } from "../../../backend/src/modules/ai/conversation/FollowUps";
import { isConfirmReply, yesAndMore } from "../../../backend/src/modules/ai/conversation/PendingConfirmationStore";
import { sameGame } from "../../../backend/src/modules/ai/conversation/TargetGrounding";
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

// Playtest round 7: questions that changed data, and collection moves reported backwards.
test.describe("AI: questions are not commands", () => {
  for (const text of ["should i play elden ring or sekiro first", "is outer wilds worth playing?", "which one should i start", "yo whats a good starting class"]) {
    test(`${JSON.stringify(text)} is only a question @negative`, () => expect(isQuestionOnly(text)).toBe(true));
  }
  for (const text of ["can you add hades", "pause rdr2 im taking a break", "what's up, also mark celeste done", "could u rate it 8"]) {
    test(`${JSON.stringify(text)} is a request @positive`, () => expect(isQuestionOnly(text)).toBe(false));
  }
  test("'is this one worth it?' is an opinion question about the page's game @positive", () => {
    expect(asksForOpinion("is this one worth it? its been sitting in my backlog forever")).toBe(true);
    expect(withPageGame("is this one worth it?", "Outer Wilds")).toBe("is Outer Wilds worth it?");
  });
});

test.describe("AI: collection direction from the wording", () => {
  for (const [text, expected] of [
    ["put ds3 in there", "add"],
    ["throw sekiro and elden ring in too", "add"],
    ["take hollow knight out of soulslikes", "remove"],
    ["remove dead cells from that collection", "remove"],
  ] as const) {
    test(`${JSON.stringify(text)} -> ${expected} @positive`, () => expect(collectionDirection(text)).toBe(expected));
  }
  test("'throw sekiro n elden ring in too' reads as 'and' @positive", () => {
    expect(normalizeSlang("throw sekiro n elden ring in too")).toBe("throw sekiro and elden ring in too");
  });
});

test.describe("AI: opinions and 'drop'", () => {
  test("'should i play elden ring or sekiro first' wants an opinion @positive", () => {
    expect(asksForOpinion("should i play elden ring or sekiro first")).toBe(true);
  });
  test("'what should i play tonight' is a recommendation, not an opinion @negative", () => {
    expect(asksForOpinion("what should i play tonight?")).toBe(false);
  });
  test("'drop gta 5 its mid' is the Dropped status @positive", () => expect(meansDroppedStatus("drop gta 5 its mid")).toBe(true));
  test("'remove gta 5 from my library' is a removal @negative", () => expect(meansDroppedStatus("drop gta 5, remove it from my library")).toBe(false));
});

test.describe("AI: plain adds skip the planner", () => {
  for (const [text, title] of [["add gta 5", "gta 5"], ["i own hollow knight", "hollow knight"], ["add Elden Ring to my library", "Elden Ring"]] as const) {
    test(`${JSON.stringify(text)} adds ${title} @positive`, () => expect(simpleAddTitle(text)).toBe(title));
  }
  for (const text of ["add elden ring to soulslikes", "add celeste and mark it completed", "add a note on hades: heat 0", "add tears of the kingdom as completed", "add it"]) {
    test(`${JSON.stringify(text)} still goes to the planner @negative`, () => expect(simpleAddTitle(text)).toBeUndefined());
  }
});

// Playtest round 9.
test.describe("AI: round 9 helpers", () => {
  test("'10/10 masterpiece' states a score @positive", () => expect(statedScore("just beat witcher 3, 10/10 masterpiece")).toBe(10));
  test("'a solid 8 out of 10' states a score @positive", () => expect(statedScore("a solid 8 out of 10 honestly")).toBe(8));
  test("'2 hrs' is not a score @negative", () => expect(statedScore("only got 2 hrs")).toBeUndefined());
  test("'add silksong pls' adds silksong @positive", () => expect(simpleAddTitle(normalizeSlang("add silksong pls"))).toBe("silksong"));
  test("'yeah do it, and hollow knight too' is a yes plus more @positive", () => {
    expect(yesAndMore("yeah do it, and hollow knight too. also put ds3 in there")).toBe("hollow knight too. also put ds3 in there");
  });
  test("a plain 'yes' is not 'yes plus more' @negative", () => expect(yesAndMore("yes")).toBeUndefined());
});

// Playtest round 10: commands that don't need the model, and plain "yes".
test.describe("AI: quick commands and yes", () => {
  for (const [text, expected] of [
    ["rate hollow knight 9 it was amazing", { kind: "rate", game: "hollow knight", rating: 9, comment: "it was amazing" }],
    ["pause rdr2 im taking a break from it", { kind: "status", game: "rdr2", status: "paused" }],
    ["I finished celeste!! that summit was brutal", { kind: "status", game: "celeste", status: "completed" }],
    ["note for rdr2: stopped at chapter 4", { kind: "note", game: "rdr2", text: "stopped at chapter 4" }],
    ["mark witcher 3 as playing", { kind: "status", game: "witcher 3", status: "playing" }],
  ] as const) {
    test(`${JSON.stringify(text)} is a quick command @positive`, () => expect(parseQuickCommand(text)).toEqual(expected));
  }
  test("two requests in one message go to the planner @negative", () => {
    expect(parseQuickCommand("drop disco elysium, too much reading. and im starting stardew tonight")).toBeUndefined();
  });
  for (const text of ["yes", "yeah do it", "ok", "sure thing", "yes please"]) {
    test(`${JSON.stringify(text)} is a yes @positive`, () => expect(isConfirmReply(text)).toBe(true));
  }
  test("'Hades II' is not 'Hades' @negative", () => expect(sameGame("Hades II", "Hades")).toBe(false));
  test("'Hollow Knight: Silksong' is not 'Hollow Knight' @negative", () => expect(sameGame("Hollow Knight: Silksong", "Hollow Knight")).toBe(false));
  test("'gta 5' is Grand Theft Auto V @positive", () => expect(sameGame("gta 5", "Grand Theft Auto V")).toBe(true));
});
