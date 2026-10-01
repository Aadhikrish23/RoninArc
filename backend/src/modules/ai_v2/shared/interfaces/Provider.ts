/**
 * Interface representing an LLM Provider client.
 */
export interface AIProvider {
  readonly id: string;
  generate(prompt: string, options?: Record<string, any>): Promise<string>;
}

/**
 * Interface representing a Memory persistence client.
 */
export interface MemoryProvider {
  readonly id: string;
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
}
