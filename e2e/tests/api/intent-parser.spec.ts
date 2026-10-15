import { test, expect } from "@playwright/test";
import { fixMismatchedClosers } from "../../../backend/src/modules/ai/parser/IntentParser";

// Playtest round 5: the model closed "parameters" with "}" and the intent with "]",
// so "add botw 2 and mark it completed" failed every time (temperature 0 repeats it).
test.describe("AI intent JSON repair", () => {
  test("wrong closing brackets are fixed @positive", () => {
    const raw = '{"intents": [{"type": "SetStatus", "targets": [], "parameters": [{"type": "Status", "value": "completed"}}]]}';
    expect(JSON.parse(fixMismatchedClosers(raw))).toEqual({
      intents: [{ type: "SetStatus", targets: [], parameters: [{ type: "Status", value: "completed" }] }],
    });
  });

  test("brackets inside strings are left alone @negative", () => {
    const raw = '{"note": "beat [boss} first", "list": [1, 2]}';
    expect(fixMismatchedClosers(raw)).toBe(raw);
  });
});
