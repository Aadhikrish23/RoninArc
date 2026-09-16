import { AIExecutor } from "./sdk/AIExecutor";
import { AIProvider } from "./providers/AIProvider";
import { AIToolRegistry } from "./sdk/AIToolRegistry";
import { ContextBuilder } from "./context/ContextBuilder";
import { CapabilityRegistry } from "./planning/CapabilityRegistry";
import { AIRuntime } from "./AIRuntime";

export class AIService {
  private readonly runtime: AIRuntime;

  constructor(
    private readonly provider: AIProvider,
    private readonly executor: AIExecutor,
    private readonly toolRegistry: AIToolRegistry,
    private readonly contextBuilder: ContextBuilder,
    private readonly capabilityRegistry: CapabilityRegistry,
  ) {
    this.runtime = new AIRuntime(
      provider,
      executor,
      toolRegistry,
      contextBuilder,
      capabilityRegistry,
    );
  }

  async chat(userId: string, request: string, requestId: string) {
    return this.runtime.chat(userId, request, requestId);
  }
}



