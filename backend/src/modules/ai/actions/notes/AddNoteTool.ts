import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import noteToolService from "../../services/NoteToolService";

interface AddNoteInput {
  gameId: string;
  content: string;
}

export class AddNoteTool extends BaseTool<AddNoteInput, any> {
  readonly category = "notes";

  readonly name = "add_note";

  readonly description = "Adds a personal note to a game already in the user's library.";

  async execute(input: AddNoteInput, context: AIToolContext): Promise<AIToolResult<any>> {
    const content = (input.content || "").trim();
    if (!content) {
      return this.failure("I need some text to save as a note.");
    }

    const note = await noteToolService.createNote(context.userId, input.gameId, content);

    return this.success(note, "I've added that note.");
  }
}
