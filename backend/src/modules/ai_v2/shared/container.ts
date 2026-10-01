import { ManifestRegistry } from "../manifest/ManifestRegistry";
import { CapabilityRegistry } from "../capability/CapabilityRegistry";
import { WorkflowRegistry } from "../workflow/WorkflowRegistry";
import { ToolRegistry } from "../execution/ToolRegistry";
import { ManifestLoader } from "../manifest/ManifestLoader";

/**
 * Reusable simple Dependency Injection Container for Runtime V2.
 */
export class DIContainer {
  private static instance: DIContainer | null = null;
  private readonly services = new Map<string, any>();

  private constructor() {
    this.registerDefaults();
  }

  public static get(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Resets the singleton instance. Primarily for test isolation.
   */
  public static reset(): void {
    DIContainer.instance = null;
  }

  /**
   * Binds a service instance under a token name.
   */
  public register<T>(token: string, instance: T): void {
    this.services.set(token, instance);
  }

  /**
   * Resolves a bound service instance by its token name.
   */
  public resolve<T>(token: string): T {
    const service = this.services.get(token);
    if (!service) {
      throw new Error(`DIContainer: Token '${token}' could not be resolved.`);
    }
    return service;
  }

  private registerDefaults(): void {
    const manifestRegistry = new ManifestRegistry();
    const capabilityRegistry = new CapabilityRegistry();
    const workflowRegistry = new WorkflowRegistry();
    const toolRegistry = new ToolRegistry();
    const manifestLoader = new ManifestLoader(
      manifestRegistry,
      capabilityRegistry,
      workflowRegistry,
      toolRegistry
    );

    this.register("ManifestRegistry", manifestRegistry);
    this.register("CapabilityRegistry", capabilityRegistry);
    this.register("WorkflowRegistry", workflowRegistry);
    this.register("ToolRegistry", toolRegistry);
    this.register("ManifestLoader", manifestLoader);
  }
}
