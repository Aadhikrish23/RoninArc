export interface ToolResult {
  readonly success: boolean;
  readonly data?: any;
  readonly error?: string;
}

export interface WorkflowResult {
  readonly success: boolean;
  readonly output?: any;
  readonly error?: string;
}

export interface CapabilityResult {
  readonly resolved: boolean;
  readonly data?: any;
}

export interface PlannerResult {
  readonly matchedIntents: string[];
}
