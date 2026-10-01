import { BaseEntity } from "../types/BaseEntity";
import { Capability } from "./Capability";
import { Workflow } from "./Workflow";
import { Tool } from "./Tool";

/**
 * Product Manifest structure that encapsulates capabilities, workflows, and tools for a specific product.
 */
export interface ProductManifest extends BaseEntity {
  readonly productName: string;
  readonly capabilities: Capability[];
  readonly workflows: Workflow[];
  readonly tools: Tool[];
}
