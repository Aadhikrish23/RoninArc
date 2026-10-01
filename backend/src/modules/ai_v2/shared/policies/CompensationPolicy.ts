export enum CompensationPolicyType {
  NONE = "NONE",
  COMPENSATE = "COMPENSATE",
  IGNORE = "IGNORE"
}

export interface CompensationPolicy {
  readonly type: CompensationPolicyType;
  readonly compensationToolName?: string;
}
