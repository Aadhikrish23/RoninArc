import { test, expect } from "@playwright/test";
import { asksForOpinion, asksToReadNotes, collectionDirection, isQuestionOnly, meansDroppedStatus, normalizeSlang, parseCollectionCommand, parseQuickCommand, parseQuickCommands, fillCollectionThere, pinPronoun, saveThatAsNote, recommendationFollowUp, resolveOrdinals, simpleAddTitle, statedScore, unsupportedReply, wasAskedFor, withPageGame } from "../../../backend/src/modules/ai/conversation/FollowUps";
import { isConfirmReply, noAndMore, yesAndMore } from "../../../backend/src/modules/ai/conversation/PendingConfirmationStore";
import { RECOMMEND_ASK } from "../../../backend/src/modules/ai/pipeline/Patterns";
import { namedTitles, sameGame } from "../../../backend/src/modules/ai/conversation/TargetGrounding";
import { dropUnstatedStatusChanges, ensureCollectionAdds } from "../../../backend/src/modules/ai/pipeline/StatusEvidence";
import { correctPlan } from "../../../backend/src/modules/ai/pipeline/PlanCorrections";
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
    test(`${JSON.stringify(text)} gets an honest no @negative`, () => expect(unsupportedReply(text)).toMatch(/^(I can't|There's nothing I can undo)/));
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

// Playtest round 11.
test.describe("AI: round 11 names and renames", () => {
  const owned = ["The Witcher 3: Wild Hunt", "Dead Cells", "Hollow Knight", "Hades II"];
  test("'the witcher' is The Witcher 3 when it's the only Witcher @positive", () => {
    expect(namedTitles("yo just beat the witcher finally, mark it done", owned)).toEqual(["The Witcher 3: Wild Hunt"]);
  });
  test("'last night' doesn't typo-match Hollow Knight @negative", () => {
    expect(namedTitles("started hades last night", owned)).toEqual([]);
  });
  test("'rename X to Git Gud and tell me whats in it' names it Git Gud @positive", () => {
    // The rest ("tell me whats in it") runs after the rename as its own message.
    expect(parseCollectionCommand("rename the soulslike list to Git Gud and tell me whats in it", ["Soulslike"], [])).toEqual({ kind: "rename", name: "Soulslike", newName: "Git Gud", rest: "tell me whats in it" });
  });
  test("'rename it to just Git Gud' finds the collection just renamed @positive", () => {
    const recent = [{ user: "x", assistant: 'I\'ve renamed the collection "Soulslike" to "Git Gud and tell me".' }];
    expect(parseCollectionCommand("lol no, rename it to just Git Gud", ["Git Gud and tell me"], recent)).toEqual({ kind: "rename", name: "Git Gud and tell me", newName: "Git Gud" });
  });
  test("a reminder plus a purchase: both get an answer @negative", () => {
    expect(unsupportedReply("remind me on friday to play witcher, and also buy silksong for me on steam")).toMatch(/^I can't set reminders or buy games yet/);
  });
});

// Playtest round 12.
test.describe("AI: round 12 pronouns, notes and limits", () => {
  const owned = ["Dead Cells", "Sekiro: Shadows Die Twice", "The Witcher 3: Wild Hunt"];
  const nameIn = (clause: string) => namedTitles(clause, owned)[0];
  test("'put it in there, and start sekiro': it is the conversation's game @positive", () => {
    expect(pinPronoun("put it in the soulslike one too, and start playing sekiro", "Dead Cells", nameIn))
      .toBe("put Dead Cells in the soulslike one too, and start playing sekiro");
  });
  test("'beat the witcher, mark it done': it is the game named before it @positive", () => {
    expect(pinPronoun("just beat the witcher, mark it done", "Dead Cells", nameIn)).toBe("just beat the witcher, mark The Witcher 3: Wild Hunt done");
  });
  test("a single clause is left alone @negative", () => expect(pinPronoun("rate it 9", "Dead Cells", nameIn)).toBe("rate it 9"));

  test("'save that as a note on sekiro but also add \"...\"' saves the last answer plus the addition @positive", () => {
    const last = { user: "tips for genichiro?", assistant: "Watch his posture and use the Mikiri Counter." };
    expect(saveThatAsNote('save that as a note on sekiro but also add "jump + attack to reverse lightning"', last))
      .toEqual({ gameText: "sekiro", text: "Watch his posture and use the Mikiri Counter.\n\njump + attack to reverse lightning" });
  });
  test("'nuke my whole library' is refused clearly @negative", () => {
    expect(unsupportedReply("ugh nuke my whole library i wanna start fresh")).toMatch(/^I can't clear your whole library/);
  });
  test("'remind me ... elden ring coop' is a reminder, not a co-op question @negative", () => {
    expect(unsupportedReply("remind me friday 8pm to play elden ring coop with my buddy")).toMatch(/^I can't set reminders/);
  });
});

// Playtest round 13.
test.describe("AI: round 13 commands after questions", () => {
  test("'unpause it' / 'resume X' are status commands @positive", () => {
    expect(parseQuickCommand("ok, and unpause it?")).toEqual({ kind: "status", game: "it", status: "playing" });
    expect(parseQuickCommand("resume disco elysium")).toEqual({ kind: "status", game: "disco elysium", status: "playing" });
  });
  test("a question with a trailing command isn't only a question @positive", () => {
    expect(isQuestionOnly("how long is disco elysium? thinking of going back to it, unpause it")).toBe(false);
  });
});

// Playtest round 14.
test.describe("AI: round 14 multi-command and collection direction", () => {
  test("'drop cod, mp is dead anyway. give it a 4' is two commands @positive", () => {
    expect(parseQuickCommands("drop cod, mp is dead anyway. give it a 4")).toEqual([
      { kind: "status", game: "cod", status: "dropped" },
      { kind: "rate", game: "it", rating: 4 },
    ]);
  });
  test("'i want dark souls 3 out of soulslike' takes it out @positive", () => {
    expect(collectionDirection("huh? i want dark souls 3 out of soulslike")).toBe("remove");
  });
});

// Playtest round 15: status changes need a reason next to the game.
test.describe("AI: round 15 status evidence and collection adds", () => {
  const owned = ["Elden Ring", "Hollow Knight", "Red Dead Redemption 2"];
  const status = (name: string, value: string) => ({ type: "SetStatus", targets: [{ type: "Game", name }], parameters: [{ type: "Status", value }] });
  test("'put A and B in soulslike, and pause rdr2' keeps only the pause, and adds both @positive", () => {
    const plan: any = { intents: [status("Hollow Knight", "plan"), status("Red Dead Redemption 2", "paused")] };
    const message = "ok put elden ring and hollow knight in soulslike, and pause rdr2 im taking a break from it";
    expect(dropUnstatedStatusChanges(plan, message, owned)).toBe(1);
    ensureCollectionAdds(plan, message, owned, ["Soulslike"]);
    expect(plan.intents.map((i: any) => [i.type, i.targets[0].name])).toEqual([
      ["SetStatus", "Red Dead Redemption 2"],
      ["OrganizeCollection", "Elden Ring"],
      ["OrganizeCollection", "Hollow Knight"],
    ]);
  });
  test("'pause' in one clause doesn't pause a game named in another @negative", () => {
    const plan: any = { intents: [status("Hollow Knight", "paused")] };
    expect(dropUnstatedStatusChanges(plan, "put them in soulslike. and hollow knight was completed, i finished it", owned)).toBe(1);
  });
  test("'i finished celeste' keeps its Completed @positive", () => {
    const plan: any = { intents: [status("Hollow Knight", "completed")] };
    expect(dropUnstatedStatusChanges(plan, "finally beat hollow knight!!", owned)).toBe(0);
  });
});

// Regression replay after round 15.
test.describe("AI: regression replay fixes", () => {
  test('"start playing it" points at it, not a game called "playing it" @positive', () => {
    expect(parseQuickCommand("also start playing it")).toEqual({ kind: "status", game: "it", status: "playing" });
    expect(parseQuickCommand("continue playing hollow knight")).toEqual({ kind: "status", game: "hollow knight", status: "playing" });
  });
  test('"drop cod. give it a 4" is two commands on the same game @positive', () => {
    expect(parseQuickCommands("drop cod. give it a 4")).toEqual([
      { kind: "status", game: "cod", status: "dropped" },
      { kind: "rate", game: "it", rating: 4 },
    ]);
  });
});

test.describe("AI: collection name trimmed everywhere in the plan", () => {
  test('"put it in a soulslike collection" creates and fills the same "Soulslike" @positive', () => {
    const plan: any = {
      intents: [
        { type: "CreateCollection", targets: [{ type: "Collection", name: "Soulslike Collection" }], parameters: [] },
        { type: "OrganizeCollection", targets: [{ type: "Game", name: "Sekiro: Shadows Die Twice" }, { type: "Collection", name: "Soulslike Collection" }], parameters: [{ type: "Boolean", value: true }] },
      ],
    };
    correctPlan(plan, "put it in a soulslike collection");
    expect(plan.intents.map((i: any) => i.targets.find((t: any) => t.type === "Collection").name)).toEqual(["Soulslike", "Soulslike"]);
  });
});

// Playtest round 16.
test.describe("AI: round 16 moods, slang ratings and no-then-ask", () => {
  test('"want something chill for like 30 min from what i own" is a recommendation ask @positive', () => {
    expect(RECOMMEND_ASK.test("im wiped from work, want something chill for like 30 min from what i own")).toBe(true);
    expect(RECOMMEND_ASK.test("i mean something relaxing to play for half an hour, from my library")).toBe(true);
  });
  test('"rate hollow knight 9" is not a recommendation ask @negative', () => {
    expect(RECOMMEND_ASK.test("rate hollow knight 9")).toBe(false);
  });
  test('"dropped cod its mid, and gimme stardew a 8" is two commands @positive', () => {
    expect(parseQuickCommands("dropped cod its mid, and gimme stardew a 8 cuz its comfy af")).toEqual([
      { kind: "status", game: "cod", status: "dropped" },
      { kind: "rate", game: "stardew", rating: 8, comment: "its comfy af" },
    ]);
  });
  test('"nah. where did i leave off in disco elysium" declines, then asks @positive', () => {
    expect(noAndMore("nah. where did i leave off in disco elysium again")).toBe("where did i leave off in disco elysium again");
  });
  test('"nah keep it" is only a no @negative', () => {
    expect(noAndMore("nah keep it")).toBeUndefined();
    expect(noAndMore("no thanks!")).toBeUndefined();
  });
});

// Playtest round 17.
test.describe("AI: round 17 follow-ups", () => {
  const owned = ["The Witcher 3: Wild Hunt", "Stardew Valley", "Hollow Knight"];
  test('"started the witcher again" names the Witcher, not Stardew ("started" is not a typo of "stardew") @negative', () => {
    expect(namedTitles("started the witcher again on death march", owned)).toEqual(["The Witcher 3: Wild Hunt"]);
    expect(pinPronoun("started the witcher again on death march, im playing it now", "Stardew Valley", (c) => namedTitles(c, owned)[0])).toBe(
      "started the witcher again on death march, im playing The Witcher 3: Wild Hunt now",
    );
  });
  test('"ya and hollow knight too" is a yes plus more @positive', () => {
    expect(yesAndMore("ya and hollow knight too")).toBe("hollow knight too");
    expect(yesAndMore("yes add those, and hollow knight too")).toBe("hollow knight too");
  });
  test('"put ds3 in there" means the collection just talked about @positive', () => {
    const exchanges = [{ user: "make a soulslike collection", assistant: 'I\'ve created the collection "Soulslikes". Want me to add Sekiro to it?' }] as any;
    expect(fillCollectionThere("put ds3 in there", exchanges, ["Soulslikes"])).toBe('put ds3 in "Soulslikes"');
    expect(fillCollectionThere("put ds3 in there", [], ["Soulslikes"])).toBe("put ds3 in there");
  });
});

test.describe("AI: round 17 scores in passing", () => {
  test('"finished celeste, its a 9" states a 9 @positive', () => {
    expect(statedScore("finished celeste, its a 9")).toBe(9);
    expect(statedScore("finished it, it's a 7.5")).toBe(7.5);
  });
  test('"i gave it 3 tries" and "its 2 hours long" are not scores @negative', () => {
    expect(statedScore("i gave it 3 tries")).toBeUndefined();
    expect(statedScore("its 2 hours long")).toBeUndefined();
  });
});

// Playtest round 18.
test.describe("AI: round 18 refunds", () => {
  test('"remove that last game, i refunded it" after a collection add leaves the library @positive', () => {
    const plan: any = { intents: [{ type: "RemoveGame", targets: [{ type: "Game", name: "Dark Souls III" }], parameters: [] }] };
    correctPlan(plan, "actually remove that last game, i refunded it lol", 'I\'ve added Dark Souls III to your collection "Soulslikes".');
    expect(plan.intents[0].type).toBe("RemoveGame");
  });
  test('"remove that last game" after a collection add stays a collection removal @negative', () => {
    const plan: any = { intents: [{ type: "RemoveGame", targets: [{ type: "Game", name: "Dark Souls III" }], parameters: [] }] };
    correctPlan(plan, "actually remove that last game", 'I\'ve added Dark Souls III to your collection "Soulslikes".');
    expect(plan.intents[0].type).toBe("OrganizeCollection");
  });
});

// Playtest round 19.
test.describe("AI: round 19 follow-ups", () => {
  test('"change this one to 8.5 actually" is a rating on the page\'s game @positive', () => {
    expect(parseQuickCommand("change this one to 8.5 actually, the white palace knocked a point off")).toEqual({
      kind: "rate", game: "this one", rating: 8.5, comment: "the white palace knocked a point off",
    });
  });
  test('"set hades to playing" stays a status change @negative', () => {
    expect(parseQuickCommand("set hades to playing")).toEqual({ kind: "status", game: "hades", status: "playing" });
  });
  test('"started elden ring... also take hollow knight out of soulslikes" is not one quick command @negative', () => {
    expect(parseQuickCommand("started elden ring last night, finally. also take hollow knight out of soulslikes")).toBeUndefined();
  });
  test('"ye sure" is a yes @positive', () => {
    expect(isConfirmReply("ye sure")).toBe(true);
  });
  test('"remove that last game" after adding two to a collection is the one named last @positive', () => {
    const plan: any = { intents: [{ type: "RemoveGame", targets: [{ type: "Game", name: "Dark Souls III" }], parameters: [] }] };
    correctPlan(plan, "actually remove that last game", 'I\'ve added Elden Ring to your collection "Soulslikes". I\'ve added Dark Souls III and Hollow Knight to your collection "Soulslikes".');
    expect(plan.intents[0].type).toBe("OrganizeCollection");
    expect(plan.intents[0].targets[0].name).toBe("Hollow Knight");
  });
});

// Playtest round 20.
test.describe("AI: round 20 renames, typos and follow-ups", () => {
  test('"rename soulslikes to Git Gud and get rid of cod mw2" names it "Git Gud" and keeps the rest @positive', () => {
    expect(parseCollectionCommand("rename soulslikes to Git Gud and get rid of cod mw2 i'm never touching it again", ["Soulslikes"], [])).toEqual({
      kind: "rename", name: "Soulslikes", newName: "Git Gud", rest: "get rid of cod mw2 i'm never touching it again",
    });
  });
  test('"rename soulslikes to Git Gud" has no rest @negative', () => {
    expect(parseCollectionCommand("rename soulslikes to Git Gud", ["Soulslikes"], [])).toEqual({ kind: "rename", name: "Soulslikes", newName: "Git Gud" });
  });
  test('"mark stardew as plyaing" reads as playing @positive', () => {
    expect(normalizeSlang("mark stardew as plyaing")).toBe("mark stardew as playing");
  });
  test('"give witcher 3 a 10 and mark stardew as playing" is two commands @positive', () => {
    expect(parseQuickCommands("give witcher 3 a 10 and mark stardew as playing")).toEqual([
      { kind: "rate", game: "witcher 3", rating: 10 },
      { kind: "status", game: "stardew", status: "playing" },
    ]);
  });
  test('"throw it in the rockstar collection with rdr2 too": "it" is the game just added @positive', () => {
    const owned = ["Grand Theft Auto: San Andreas", "Red Dead Redemption 2"];
    expect(pinPronoun("throw it in the rockstar collection with rdr2 too", "Grand Theft Auto: San Andreas", (c) => namedTitles(c, owned)[0])).toBe(
      "throw Grand Theft Auto: San Andreas in the rockstar collection with rdr2 too",
    );
  });
  test('"rate hades 9 it was amazing": "it" after the named game stays @negative', () => {
    const owned = ["Hades", "Stardew Valley"];
    expect(pinPronoun("rate hades 9 it was amazing", "Stardew Valley", (c) => namedTitles(c, owned)[0])).toBe("rate hades 9 it was amazing");
  });
  test('"remove that last game" reads the last game added, within one sentence @positive', () => {
    const plan: any = { intents: [{ type: "RemoveGame", targets: [{ type: "Game", name: "Dark Souls III" }], parameters: [] }] };
    correctPlan(plan, "nah actually remove that last game", 'I\'ve added Elden Ring to your collection "Soulslikes". I\'ve added Dark Souls III to your library as Plan to Play. I\'ve added Dark Souls III to your collection "Soulslikes".');
    expect(plan.intents[0].targets[0].name).toBe("Dark Souls III");
  });
});

// Playtest round 21.
test.describe("AI: round 21 collection references", () => {
  test('"rename it to fromsoft pain" right after "**Soulslikes** has 2 games" renames Soulslikes @positive', () => {
    const exchanges = [{ user: "whats in my soulslikes list", assistant: "**Soulslikes** has 2 games:\n- Sekiro\n- Elden Ring" }] as any;
    expect(parseCollectionCommand("rename it to fromsoft pain", ["Soulslikes"], exchanges)).toEqual({ kind: "rename", name: "Soulslikes", newName: "fromsoft pain" });
  });
});
