import { ProductManifest } from "../shared/interfaces/ProductManifest";
import { ManifestRegistry } from "./ManifestRegistry";
import { CapabilityRegistry } from "../capability/CapabilityRegistry";
import { WorkflowRegistry } from "../workflow/WorkflowRegistry";
import { ToolRegistry } from "../execution/ToolRegistry";
import { ManifestValidator } from "./ManifestValidator";

export class ManifestLoader {
  private readonly validator = new ManifestValidator();

  constructor(
    private readonly manifestRegistry: ManifestRegistry,
    private readonly capabilityRegistry: CapabilityRegistry,
    private readonly workflowRegistry: WorkflowRegistry,
    private readonly toolRegistry: ToolRegistry
  ) {}

  /**
   * Validates and registers all contents of a manifest into their respective core registries.
   */
  public load(manifest: ProductManifest): void {
    this.validator.validate(manifest);

    // Register manifest itself
    this.manifestRegistry.register(manifest);

    // Register embedded assets
    if (manifest.tools) {
      for (const tool of manifest.tools) {
        this.toolRegistry.register(tool);
      }
    }

    if (manifest.capabilities) {
      for (const cap of manifest.capabilities) {
        this.capabilityRegistry.register(cap);
      }
    }

    if (manifest.workflows) {
      for (const wf of manifest.workflows) {
        this.workflowRegistry.register(wf);
      }
    }
  }
}
