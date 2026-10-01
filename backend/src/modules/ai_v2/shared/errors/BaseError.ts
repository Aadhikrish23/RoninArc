/**
 * Base custom error for all AI Runtime V2 operational exceptions.
 */
export class BaseError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
  }
}
