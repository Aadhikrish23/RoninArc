import { BaseEntity } from "../types/BaseEntity";
import { RetryPolicy } from "../policies/RetryPolicy";

/**
 * Interface representing a single step within a workflow DAG.
 */
export interface WorkflowStep {
  readonly id: string;
  readonly toolName: string;
  readonly inputMapping: Record<string, string>;
  readonly dependsOn: string[];
  readonly isCritical: boolean;
  readonly compensationTool?: string;
}

/**
 * Interface representing a declared workflow.
 */
export interface Workflow extends BaseEntity {
  readonly triggerCapabilities: string[];
  readonly preconditions: string[];
  readonly steps: WorkflowStep[];
  readonly failurePolicy: "ABORT" | "COMPENSATE" | "CONTINUE";
  readonly retryStrategy: RetryPolicy;
}
