import assert from "assert";
import { CapabilityValidator } from "../capability/CapabilityValidator";
import { WorkflowValidator } from "../workflow/WorkflowValidator";
import { ToolValidator } from "../execution/ToolValidator";
import { ValidationError } from "../shared/errors/ValidationError";

export async function runValidatorTests() {
  const capValidator = new CapabilityValidator();
  const wfValidator = new WorkflowValidator();
  const toolValidator = new ToolValidator();

  const invalidCap: any = { id: "test-cap" };
  assert.throws(() => {
    capValidator.validate(invalidCap);
  }, ValidationError);

  const invalidWf: any = {
    id: "invalid-wf",
    name: "Invalid Workflow",
    triggerCapabilities: ["test-cap"],
    steps: [
      { id: "step-1", toolName: "tool-a", dependsOn: ["step-2"] },
      { id: "step-2", toolName: "tool-b", dependsOn: ["step-1"] }
    ],
    failurePolicy: "ABORT",
    retryStrategy: { strategy: "NONE", maxAttempts: 0 }
  };
  assert.throws(() => {
    wfValidator.validate(invalidWf);
  }, (err: any) => {
    return err instanceof ValidationError && (err.validationErrors?.some(e => e.includes("Circular dependency")) ?? false);
  });

  const invalidTool: any = { id: "invalid-tool" };
  assert.throws(() => {
    toolValidator.validate(invalidTool);
  }, ValidationError);
}
