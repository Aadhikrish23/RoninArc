import { BaseError } from "./BaseError";

/**
 * Thrown when system context snapshots fail validation requirements.
 */
export class PreconditionFailedError extends BaseError {
  constructor(message: string) {
    super(message, "V2_PRECONDITION_FAILED");
  }
}
