import { AIToolContext } from "../sdk/AIToolContext";
import { ConversationContext } from "./ConversationContext";
import { MemoryContext } from "../memory/MemoryContext";

export interface AIRequestContext {
  toolContext: AIToolContext;
  conversationContext: ConversationContext;
  memoryContext?: MemoryContext;
}


