export interface AIToolResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}