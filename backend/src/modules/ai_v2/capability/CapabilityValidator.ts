import { Capability } from "../shared/interfaces/Capability";
import { ValidationError } from "../shared/errors/ValidationError";

export class CapabilityValidator {
  /**
   * Validates Capability fields constraints.
   */
  public validate(capability: Capability): void {
    const errors: string[] = [];

    if (!capability.id) {
      errors.push("Capability ID is required.");
    }
    if (!capability.name) {
      errors.push("Capability Name is required.");
    }
    if (!capability.purpose) {
      errors.push("Capability Purpose is required.");
    }
    if (!capability.intentType) {
      errors.push("Capability IntentType is required.");
    }
    if (!capability.mappedWorkflowId) {
      errors.push("Capability MappedWorkflowId is required.");
    }

    if (errors.length > 0) {
      throw new ValidationError(`Capability validation failed for ID: ${capability.id || "unknown"}`, errors);
    }
  }
}
