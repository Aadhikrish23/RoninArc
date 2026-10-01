export interface Metadata {
  readonly version: string;
  readonly description?: string;
  readonly properties?: Record<string, any>;
}
