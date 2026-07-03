import { AITool } from "../sdk/AITool";
import { AIToolContext } from "../sdk/AIToolContext";
import { AIToolResult } from "../sdk/AIToolResult";

export abstract class BaseTool<TInput = unknown, TOutput = unknown>
  implements AITool<TInput, TOutput>
{
  abstract readonly category: string;

  abstract readonly name: string;

  abstract readonly description: string;

  abstract execute(
    input: TInput,
    context: AIToolContext
  ): Promise<AIToolResult<TOutput>>;
}