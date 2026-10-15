import { test, expect } from "@playwright/test";
import { dropUngroundedIntents, franchiseMatch, mentions } from "../../../backend/src/modules/ai/conversation/TargetGrounding";

// The AI only changes a game the user actually named (or referred to). These
// cases come from the gamer playtests: gibberish and two-part messages made the
// model act on games nobody mentioned.
const cases: [string, string, boolean][] = [
  ["asdfgh", "Hades II", false],
  ["zxcvb qwerty", "Hades II", false],
  ["finally beat celeste!! also im playing sekrio rn", "Elden Ring", false],
  ["finally beat celeste!! also im playing sekrio rn", "Celeste", true],
  ["finally beat celeste!! also im playing sekrio rn", "Sekiro: Shadows Die Twice", true],
  ["put ds3 in there", "Dark Souls III", true],
  ["actually remove that last one, HK isnt really a soulslike", "Hollow Knight", true],
  ["pause rdr2 im taking a break", "Red Dead Redemption 2", true],
  ["mark gta 5 as dropped", "Grand Theft Auto V", true],
  ["what did i rate witcher 3?", "The Witcher 3: Wild Hunt", true],
  ["yeet cod mw2 outta my library", "Call of Duty: Modern Warfare 2", true],
  ["add elden ring", "Elden Ring", true],
  ["started hades last night", "Hades", true],
  ["started hades last night", "Hades II", false],
  ["yeet cod off my list, i dont even own that anymore", "Call of Duty: Modern Warfare II", true],
];

test.describe("AI target grounding", () => {
  for (const [text, title, expected] of cases) {
    test(`${JSON.stringify(text)} ${expected ? "names" : "does not name"} ${title} @${expected ? "positive" : "negative"}`, () => {
      expect(mentions(text, title)).toBe(expected);
    });
  }
});

test.describe("AI target grounding: questions", () => {
  test('"what are my top rated games" does not name Top Gun @negative', () => {
    expect(mentions("what are my top rated games", "Top Gun: Maverick")).toBe(false);
  });
});

// Playtest round 4: "this game" on a game's page, and "it" after that game was deleted.
test.describe("AI target grounding: page and stale references", () => {
  const plan = (type: string, name: string) => ({
    id: "t",
    requestId: "t",
    intents: [{ type, targets: [{ type: "Game", name }], parameters: [] }],
  }) as any;
  const owned = ["Hollow Knight", "Hades", "Celeste"];

  test('"add this game to cozy nights" on Hollow Knight\'s page targets Hollow Knight @positive', () => {
    const p = plan("OrganizeCollection", "Stardew Valley");
    expect(dropUngroundedIntents(p, { message: "add this game to cozy nights", recentText: "", owned, pageGame: "Hollow Knight" })).toBe(0);
    expect(p.intents[0].targets[0].name).toBe("Hollow Knight");
  });

  test('"this game" names a different library game: the named one wins @positive', () => {
    const p = plan("SetStatus", "Hollow Knight");
    expect(dropUngroundedIntents(p, { message: "mark hades as playing, this game rocks", recentText: "", owned, pageGame: "Hollow Knight" })).toBe(0);
    expect(p.intents[0].targets[0].name).toBe("Hades");
  });

  test('without a page, "this game" with nothing to refer to is dropped @negative', () => {
    const p = plan("SetStatus", "Stardew Valley");
    expect(dropUngroundedIntents(p, { message: "mark this game as playing", recentText: "", owned, currentGame: null })).toBe(1);
  });

  test('"the 2022 one" is not a reference to the last game @negative', () => {
    const p = plan("AddGame", "God of War Ragnarök");
    expect(dropUngroundedIntents(p, { message: "the 2022 one", recentText: "", owned, currentGame: "God of War" })).toBe(1);
  });
});

// Playtest round 6: "add a note on gta: ..." was refused because "gta" has no sequel number.
test.describe("AI target grounding: franchise shorthand", () => {
  test('"gta" names the only GTA in the library @positive', () => {
    const p = { id: "t", requestId: "t", intents: [{ type: "AddNote", targets: [{ type: "Game", name: "Grand Theft Auto V" }], parameters: [] }] } as any;
    expect(dropUngroundedIntents(p, { message: "add a note on gta: finish the big score", recentText: "", owned: ["Grand Theft Auto V", "Hades"] })).toBe(0);
  });
  test('"gta" is ambiguous with two GTAs @negative', () => {
    expect(franchiseMatch("add a note on gta", ["Grand Theft Auto V", "Grand Theft Auto IV"])).toBeUndefined();
  });
});
