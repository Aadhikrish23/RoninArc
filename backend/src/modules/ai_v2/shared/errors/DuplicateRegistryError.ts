import { BaseError } from "./BaseError";

/**
 * Thrown when trying to register an entity key that already exists.
 */
export class DuplicateRegistryError extends BaseError {
  constructor(registryName: string, entityId: string) {
    super(`Duplicate entry registration attempted in registry '${registryName}' for key: ${entityId}`, "V2_DUPLICATE_REGISTRY");
  }
}
