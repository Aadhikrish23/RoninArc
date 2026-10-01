import { BaseRegistry } from "../shared/registry/BaseRegistry";
import { Capability } from "../shared/interfaces/Capability";
import { CapabilityValidator } from "./CapabilityValidator";

export class CapabilityRegistry extends BaseRegistry<Capability> {
  private readonly validator = new CapabilityValidator();

  constructor() {
    super("CapabilityRegistry");
  }

  protected override validate(entry: Capability): void {
    this.validator.validate(entry);
  }
}
