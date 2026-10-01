import { BaseEntity } from "../types/BaseEntity";
import { ExecutionPolicyType } from "../policies/ExecutionPolicy";
import { RetryPolicy } from "../policies/RetryPolicy";
import { CompensationPolicy } from "../policies/CompensationPolicy";
import { ConfirmationPolicy } from "../policies/ConfirmationPolicy";
import { ExecutionContext } from "./Execution";
import { ToolResult } from "../types/ResultTypes";

/**
 * Interface representing a primitive tool contract.
 */
export interface Tool extends BaseEntity {
  readonly purpose: string;
  readonly examples: string[];
  readonly counterExamples: string[];
  readonly executionPolicy: ExecutionPolicyType;
  readonly isReadOnly: boolean;
  readonly isCritical: boolean;
  readonly inputSchema: Record<string, any>;
  readonly outputSchema: Record<string, any>;
  readonly retryPolicy: RetryPolicy;
  readonly compensationPolicy: CompensationPolicy;
  readonly confirmationPolicy: ConfirmationPolicy;
  
  execute(input: Record<string, any>, context: ExecutionContext): Promise<ToolResult>;
}
