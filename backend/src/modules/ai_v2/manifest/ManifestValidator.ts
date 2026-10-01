import { ProductManifest } from "../shared/interfaces/ProductManifest";
import { ValidationError } from "../shared/errors/ValidationError";
import { CapabilityValidator } from "../capability/CapabilityValidator";
import { WorkflowValidator } from "../workflow/WorkflowValidator";
import { ToolValidator } from "../execution/ToolValidator";

export class ManifestValidator {
  private readonly capabilityValidator = new CapabilityValidator();
  private readonly workflowValidator = new WorkflowValidator();
  private readonly toolValidator = new ToolValidator();

  /**
   * Performs deep validation of a product manifest including nested capability,
   * workflow, and tool validators.
   */
  public validate(manifest: ProductManifest): void {
    const errors: string[] = [];

    if (!manifest.id) {
      errors.push("Manifest ID is required.");
    }
    if (!manifest.name) {
      errors.push("Manifest Name is required.");
    }
    if (!manifest.productName) {
      errors.push("Product Name is required.");
    }

    // Validate embedded capabilities
    if (manifest.capabilities) {
      for (const cap of manifest.capabilities) {
        try {
          this.capabilityValidator.validate(cap);
        } catch (err: any) {
          errors.push(`Capability '${cap.id || "unknown"}' invalid: ${err.message}`);
        }
      }
    }

    // Validate embedded workflows
    if (manifest.workflows) {
      for (const wf of manifest.workflows) {
        try {
          this.workflowValidator.validate(wf);
        } catch (err: any) {
          errors.push(`Workflow '${wf.id || "unknown"}' invalid: ${err.message}`);
        }
      }
    }

    // Validate embedded tools
    if (manifest.tools) {
      for (const tool of manifest.tools) {
        try {
          this.toolValidator.validate(tool);
        } catch (err: any) {
          errors.push(`Tool '${tool.id || "unknown"}' invalid: ${err.message}`);
        }
      }
    }

    // Check integrity - capabilities mapped to workflows must exist in workflow array
    if (manifest.capabilities && manifest.workflows) {
      const workflowIds = new Set(manifest.workflows.map((w) => w.id));
      for (const cap of manifest.capabilities) {
        if (cap.mappedWorkflowId && !workflowIds.has(cap.mappedWorkflowId)) {
          errors.push(`Capability '${cap.id}' maps to non-existent Workflow: '${cap.mappedWorkflowId}'`);
        }
      }
    }

    // Check integrity - workflows referencing tools must exist in tool array
    if (manifest.workflows && manifest.tools) {
      const toolNames = new Set(manifest.tools.map((t) => t.name));
      for (const wf of manifest.workflows) {
        for (const step of wf.steps) {
          if (step.toolName && !toolNames.has(step.toolName)) {
            errors.push(`Workflow '${wf.id}' step '${step.id}' requires unregistered Tool Name: '${step.toolName}'`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(`ProductManifest validation failed for ID: ${manifest.id || "unknown"}`, errors);
    }
  }
}
