/**
 * Payload generated for final user response.
 */
export interface ResponseResult {
  readonly message: string;
  readonly format: "markdown" | "text";
  readonly actions?: Record<string, any>;
}

/**
 * Interface representing a Context query provider.
 */
export interface ContextProvider {
  readonly id: string;
  getContext(scope: string[]): Promise<Record<string, any>>;
}
