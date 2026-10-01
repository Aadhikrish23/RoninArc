import { BaseRegistry } from "../shared/registry/BaseRegistry";
import { Workflow } from "../shared/interfaces/Workflow";
import { WorkflowValidator } from "./WorkflowValidator";

export class WorkflowRegistry extends BaseRegistry<Workflow> {
  private readonly validator = new WorkflowValidator();

  constructor() {
    super("WorkflowRegistry");
  }

  protected override validate(entry: Workflow): void {
    this.validator.validate(entry);
  }
}
