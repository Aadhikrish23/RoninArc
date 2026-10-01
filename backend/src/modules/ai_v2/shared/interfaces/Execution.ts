/**
 * Ambient context passed throughout workflow execution.
 */
export interface ExecutionContext {
  readonly userId: string;
  readonly conversationId: string;
  readonly requestId: string;
  readonly variables: Map<string, any>;
}
