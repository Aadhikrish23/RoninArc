import { Metadata } from "./Metadata";

/**
 * Base baseline for all registered assets (Capabilities, Workflows, Tools, Manifests).
 */
export interface BaseEntity {
  readonly id: string;
  readonly name: string;
  readonly metadata?: Metadata;
}
