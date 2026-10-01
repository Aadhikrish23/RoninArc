import { BaseRegistry } from "../shared/registry/BaseRegistry";
import { ProductManifest } from "../shared/interfaces/ProductManifest";

export class ManifestRegistry extends BaseRegistry<ProductManifest> {
  constructor() {
    super("ManifestRegistry");
  }
}
