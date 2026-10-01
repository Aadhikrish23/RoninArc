import assert from "assert";
import { CapabilityRegistry } from "../capability/CapabilityRegistry";
import { DuplicateRegistryError } from "../shared/errors/DuplicateRegistryError";

export async function runRegistryTests() {
  const registry = new CapabilityRegistry();

  const cap: any = {
    id: "test-cap",
    name: "Test Cap",
    purpose: "Testing",
    intentType: "TestIntent",
    mappedWorkflowId: "test-wf",
    examples: [],
    counterExamples: [],
    preconditions: [],
    postconditions: [],
    sideEffects: [],
    requiredContext: [],
    requiredMemory: [],
    safetyRules: [],
    requiresConfirmation: false,
    outputContract: {}
  };

  registry.register(cap);
  assert.strictEqual(registry.has("test-cap"), true);
  assert.deepStrictEqual(registry.get("test-cap"), cap);
  assert.strictEqual(registry.list().length, 1);

  assert.throws(() => {
    registry.register(cap);
  }, DuplicateRegistryError);

  registry.clear();
  assert.strictEqual(registry.has("test-cap"), false);
  assert.strictEqual(registry.list().length, 0);
}
