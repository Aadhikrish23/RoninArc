import noteService from "../../notes/noteService";

export class NoteToolService {
  async createNote(
    userId: string,
    gameId: string,
    content: string,
  ): Promise<Awaited<ReturnType<typeof noteService.createNote>>> {
    return noteService.createNote(userId, gameId, content);
  }
}

export default new NoteToolService();
