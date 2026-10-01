export enum RetryStrategyType {
  NONE = "NONE",
  LINEAR = "LINEAR",
  EXPONENTIAL = "EXPONENTIAL"
}

export interface RetryPolicy {
  readonly strategy: RetryStrategyType;
  readonly maxAttempts: number;
  readonly initialDelayMs?: number;
}
