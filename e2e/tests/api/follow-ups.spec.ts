import { test, expect } from "@playwright/test";
import { asksToReadNotes, recommendationFollowUp, resolveOrdinals } from "../../../backend/src/modules/ai/conversation/FollowUps";

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
