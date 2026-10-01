import { Tool } from "../shared/interfaces/Tool";
import { ValidationError } from "../shared/errors/ValidationError";

export class ToolValidator {
  /**
   * Validates Tool schema and contract integrity.
   */
  public validate(tool: Tool): void {
    const errors: string[] = [];

    if (!tool.id) {
      errors.push("Tool ID is required.");
    }
    if (!tool.name) {
      errors.push("Tool Name is required.");
    }
    if (!tool.purpose) {
      errors.push("Tool Purpose is required.");
    }
    if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
      errors.push("Tool Input Schema object is required.");
    }
    if (!tool.outputSchema || typeof tool.outputSchema !== "object") {
      errors.push("Tool Output Schema object is required.");
    }
    if (!tool.retryPolicy) {
      errors.push("Tool Retry Policy is required.");
    }

    if (errors.length > 0) {
      throw new ValidationError(`Tool validation failed for ID: ${tool.id || "unknown"}`, errors);
    }
  }
}
