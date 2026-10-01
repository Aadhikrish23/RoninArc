import { BaseEntity } from "../types/BaseEntity";

/**
 * Interface representing a registered capability.
 */
export interface Capability extends BaseEntity {
  readonly purpose: string;
  readonly intentType: string;
  readonly examples: string[];
  readonly counterExamples: string[];
  readonly preconditions: string[];
  readonly postconditions: string[];
  readonly sideEffects: string[];
  readonly requiredContext: string[];
  readonly requiredMemory: string[];
  readonly safetyRules: string[];
  readonly requiresConfirmation: boolean;
  readonly mappedWorkflowId: string;
  readonly outputContract: Record<string, string>;
}
