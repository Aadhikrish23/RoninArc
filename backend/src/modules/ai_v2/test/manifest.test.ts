import assert from "assert";
import { DIContainer } from "../shared/container";
import { ManifestRegistry } from "../manifest/ManifestRegistry";
import { ManifestLoader } from "../manifest/ManifestLoader";
import { ValidationError } from "../shared/errors/ValidationError";

export async function runManifestTests() {
  DIContainer.reset();
  const container = DIContainer.get();
  const registry = container.resolve<ManifestRegistry>("ManifestRegistry");
  const loader = container.resolve<ManifestLoader>("ManifestLoader");

  const validManifest: any = {
    id: "test-manifest",
    name: "Test Product Manifest",
    productName: "TestProduct",
    capabilities: [
      {
        id: "cap-1",
        name: "Launch Game",
        purpose: "Launch",
        intentType: "LaunchGame",
        mappedWorkflowId: "wf-1",
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
      }
    ],
    workflows: [
      {
        id: "wf-1",
        name: "Launch Workflow",
        triggerCapabilities: ["cap-1"],
        steps: [{ id: "step-1", toolName: "tool-1", dependsOn: [], isCritical: true }],
        failurePolicy: "ABORT",
        retryStrategy: { strategy: "NONE", maxAttempts: 0 }
      }
    ],
    tools: [
      {
        id: "tool-1",
        name: "tool-1",
        purpose: "primitive execution",
        examples: [],
        counterExamples: [],
        executionPolicy: "SEQUENTIAL",
        isReadOnly: false,
        isCritical: true,
        inputSchema: {},
        outputSchema: {},
        retryPolicy: { strategy: "NONE", maxAttempts: 0 },
        compensationPolicy: { type: "NONE" },
        confirmationPolicy: { type: "NONE" },
        execute: async () => ({ success: true })
      }
    ]
  };

  loader.load(validManifest);
  assert.strictEqual(registry.has("test-manifest"), true);

  const invalidManifest: any = {
    id: "invalid-manifest",
    name: "Invalid Product Manifest",
    productName: "TestProduct",
    capabilities: [
      {
        id: "cap-2",
        name: "Update status",
        purpose: "Update",
        intentType: "UpdateStatus",
        mappedWorkflowId: "wf-2",
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
      }
    ],
    workflows: [
      {
        id: "wf-2",
        name: "Update Workflow",
        triggerCapabilities: ["cap-2"],
        steps: [{ id: "step-1", toolName: "non-existent-tool", dependsOn: [], isCritical: true }],
        failurePolicy: "ABORT",
        retryStrategy: { strategy: "NONE", maxAttempts: 0 }
      }
    ],
    tools: []
  };

  assert.throws(() => {
    loader.load(invalidManifest);
  }, ValidationError);
}
