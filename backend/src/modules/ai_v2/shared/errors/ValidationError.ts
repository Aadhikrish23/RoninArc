import { BaseError } from "./BaseError";

/**
 * Thrown when entity verification or contract validations fail.
 */
export class ValidationError extends BaseError {
  constructor(message: string, public readonly validationErrors?: string[]) {
    super(message, "V2_VALIDATION_ERROR");
  }
}
