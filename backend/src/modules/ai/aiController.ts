import { registerContextProviders } from "./context/ContextProviderRegistrar";
import { ContextBuilder } from "./context/ContextBuilder";
import { AIService } from "./aiService";
import { ActionExecutor } from "./executor/ActionExecutor";
import { OllamaProvider } from "./providers/OllamaProvider";
import { createToolRegistry } from "./registry/ToolRegistrar";
import { registerCapabilities } from "./planning/CapabilityRegistrar";
import { Request, Response } from "express";
import crypto from "crypto";

const toolRegistry = createToolRegistry();
const contextRegistry = registerContextProviders();
const capabilityRegistry = registerCapabilities();

const provider = new OllamaProvider();
const executor = new ActionExecutor(toolRegistry);
const contextBuilder = new ContextBuilder(contextRegistry);

const aiService = new AIService(
  provider,
  executor,
  toolRegistry,
  contextBuilder,
  capabilityRegistry,
);

export class AIController {
  async chat(req: Request, res: Response): Promise<void> {
    const { message } = req.body;
    const requestId = crypto.randomUUID();

    const result = await aiService.chat(
      req.user!.id,
      message ?? "",
      requestId,
    );

    res.status(200).json(result);
  }
}

export const aiController = new AIController();