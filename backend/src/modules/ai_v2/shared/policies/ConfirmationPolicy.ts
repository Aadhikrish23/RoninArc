export enum ConfirmationPolicyType {
  NONE = "NONE",
  EXPLICIT = "EXPLICIT"
}

export interface ConfirmationPolicy {
  readonly type: ConfirmationPolicyType;
  readonly message?: string;
}
