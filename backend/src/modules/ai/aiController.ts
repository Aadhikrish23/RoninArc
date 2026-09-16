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

// Conversation state (ConversationStore, session references) is mutable and keyed
// per-user with no locking of its own. Two concurrent requests from the same user
// (e.g. a double-click, or a retry racing the original) would otherwise interleave
// reads/writes of that shared session and corrupt each other's turn. Chaining each
// user's requests onto their own queue makes them run strictly one-at-a-time.
const userRequestQueues = new Map<string, Promise<unknown>>();

function runExclusivePerUser<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const previous = userRequestQueues.get(userId) || Promise.resolve();
  const next = previous.then(task, task);
  userRequestQueues.set(
    userId,
    next.catch(() => {}),
  );
  return next;
}

export class AIController {
  async chat(req: Request, res: Response): Promise<void> {
    const { message } = req.body;
    const requestId = crypto.randomUUID();

    if (typeof message !== "string" || message.trim() === "") {
      res.status(400).json({
        success: false,
        message: "Please tell me what you'd like to do.",
      });
      return;
    }

    try {
      const result = await runExclusivePerUser(req.user!.id, () =>
        aiService.chat(req.user!.id, message, requestId),
      );
      res.status(200).json(result);
    } catch (error: any) {
      if (error && (error.code === "PROVIDER_VALIDATION_ERROR" || error.code === "POLICY_VIOLATION")) {
        res.status(200).json({
          success: false,
          message: error.message || "Validation failed."
        });
        return;
      }
      throw error;
    }
  }
}

export const aiController = new AIController();