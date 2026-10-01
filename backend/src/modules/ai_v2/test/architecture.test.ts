import assert from "assert";
import { DIContainer } from "../shared/container";

export async function runArchitectureTests() {
  DIContainer.reset();
  const container = DIContainer.get();

  const capRegistry1 = container.resolve("CapabilityRegistry");
  const capRegistry2 = container.resolve("CapabilityRegistry");
  assert.strictEqual(capRegistry1, capRegistry2);

  const wfRegistry1 = container.resolve("WorkflowRegistry");
  const wfRegistry2 = container.resolve("WorkflowRegistry");
  assert.strictEqual(wfRegistry1, wfRegistry2);

  const toolRegistry1 = container.resolve("ToolRegistry");
  const toolRegistry2 = container.resolve("ToolRegistry");
  assert.strictEqual(toolRegistry1, toolRegistry2);

  const loader = container.resolve("ManifestLoader");
  assert.ok(loader);
}
