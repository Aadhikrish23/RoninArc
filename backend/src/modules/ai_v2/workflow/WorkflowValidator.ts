import { Workflow } from "../shared/interfaces/Workflow";
import { ValidationError } from "../shared/errors/ValidationError";

export class WorkflowValidator {
  /**
   * Validates Workflow steps structure, properties, and detects basic circular dependencies.
   */
  public validate(workflow: Workflow): void {
    const errors: string[] = [];

    if (!workflow.id) {
      errors.push("Workflow ID is required.");
    }
    if (!workflow.name) {
      errors.push("Workflow Name is required.");
    }
    if (!workflow.triggerCapabilities || workflow.triggerCapabilities.length === 0) {
      errors.push("Workflow must map to at least one trigger capability.");
    }
    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push("Workflow must contain at least one step.");
    } else {
      const stepIds = new Set<string>();
      for (const step of workflow.steps) {
        if (!step.id) {
          errors.push("Every workflow step must have an ID.");
        } else {
          if (stepIds.has(step.id)) {
            errors.push(`Duplicate workflow step ID found: ${step.id}`);
          }
          stepIds.add(step.id);
        }
        if (!step.toolName) {
          errors.push(`Step '${step.id || "unknown"}' must map to a toolName.`);
        }
      }

      // Dependency resolution & circular check
      for (const step of workflow.steps) {
        if (step.dependsOn) {
          for (const depId of step.dependsOn) {
            if (!stepIds.has(depId)) {
              errors.push(`Step '${step.id}' depends on non-existent step: '${depId}'`);
            }
            if (depId === step.id) {
              errors.push(`Step '${step.id}' cannot depend on itself.`);
            }
          }
        }
      }

      // Simple circular dependency path check
      try {
        this.detectCircularDependencies(workflow.steps);
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(`Workflow validation failed for ID: ${workflow.id || "unknown"}`, errors);
    }
  }

  private detectCircularDependencies(steps: any[]): void {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const adjList = new Map<string, string[]>();

    for (const step of steps) {
      adjList.set(step.id, step.dependsOn || []);
    }

    const dfs = (node: string) => {
      visited.add(node);
      recStack.add(node);

      const neighbors = adjList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          throw new Error(`Circular dependency detected involving step: ${node} -> ${neighbor}`);
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        dfs(step.id);
      }
    }
  }
}
