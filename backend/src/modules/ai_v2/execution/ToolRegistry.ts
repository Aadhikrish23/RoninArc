import { BaseRegistry } from "../shared/registry/BaseRegistry";
import { Tool } from "../shared/interfaces/Tool";
import { ToolValidator } from "./ToolValidator";

export class ToolRegistry extends BaseRegistry<Tool> {
  private readonly validator = new ToolValidator();

  constructor() {
    super("ToolRegistry");
  }

  protected override validate(entry: Tool): void {
    this.validator.validate(entry);
  }
}
