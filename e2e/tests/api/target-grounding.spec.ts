import { test, expect } from "@playwright/test";
import { mentions } from "../../../backend/src/modules/ai/conversation/TargetGrounding";

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
