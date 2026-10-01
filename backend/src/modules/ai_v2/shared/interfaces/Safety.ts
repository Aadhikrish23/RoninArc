import { ConfirmationPolicy } from "../policies/ConfirmationPolicy";

/**
 * Defines safety gate policy for step executions.
 */
export interface SafetyPolicy {
  readonly requiresConfirmation: boolean;
  readonly confirmationPolicy: ConfirmationPolicy;
}
