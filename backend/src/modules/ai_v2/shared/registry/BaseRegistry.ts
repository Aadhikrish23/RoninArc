import { BaseEntity } from "../types/BaseEntity";
import { DuplicateRegistryError } from "../errors/DuplicateRegistryError";

/**
 * Reusable abstract base registry. Handles standard CRUD-like registrations,
 * lookups, discovery, and hook validations.
 */
export abstract class BaseRegistry<T extends BaseEntity> {
  protected readonly entries = new Map<string, T>();

  constructor(public readonly registryName: string) {}

  /**
   * Registers a new entity. Throws DuplicateRegistryError if key exists.
   */
  public register(entry: T): void {
    if (!entry.id) {
      throw new Error(`[${this.registryName}] Cannot register entry with missing ID.`);
    }
    if (this.entries.has(entry.id)) {
      throw new DuplicateRegistryError(this.registryName, entry.id);
    }
    this.validate(entry);
    this.entries.set(entry.id, entry);
  }

  /**
   * Retrieves an entity by its ID. Returns undefined if not found.
   */
  public get(id: string): T | undefined {
    return this.entries.get(id);
  }

  /**
   * Verifies if an entry with the given ID exists.
   */
  public has(id: string): boolean {
    return this.entries.has(id);
  }

  /**
   * Returns all registered entities in the registry.
   */
  public list(): T[] {
    return Array.from(this.entries.values());
  }

  /**
   * Clears all registered entries. Primarily useful for test isolation.
   */
  public clear(): void {
    this.entries.clear();
  }

  /**
   * Validation hook to be overridden by child classes if needed.
   */
  protected validate(entry: T): void {
    // Default no-op. Child validators execute full validation.
  }
}
