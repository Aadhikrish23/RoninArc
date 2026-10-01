/**
 * Core interface that all sub-runtimes must implement.
 */
export interface Runtime {
  readonly id: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}
