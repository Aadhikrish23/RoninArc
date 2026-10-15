import axiosInstance from "../../../shared/api/axiosInstance";
import type { ConversationTurn, ClarificationRequest } from "../types/conversation";
import { canLaunchGames } from "../../../shared/utils/runtime";

/** Work the backend hands back because only this app can do it. */
export interface ClientAction {
  type: "launch_game";
  gameId: string;
  title: string;
}

export interface ChatResponse {
  success: boolean;
  message: string;
  status?: string;
  turns?: ConversationTurn[];
  clarificationRequest?: ClarificationRequest | null;
  clientActions?: ClientAction[];
  metrics?: {
    overallMs: number;
    layers: Record<string, number>;
  };
}

/** The game or collection page open behind the chat, so "add this game to…" means that one. */
function pageContext(): { pageGameId?: string; pageCollectionId?: string } {
  const path = window.location.hash.replace(/^#/, "").split("?")[0];
  const game = path.match(/^\/library\/game\/([A-Za-z0-9]+)/);
  if (game) return { pageGameId: game[1] };
  const collection = path.match(/^\/collections\/([A-Za-z0-9]+)/);
  if (collection) return { pageCollectionId: collection[1] };
  return {};
}

export const aiApi = {
  sendMessage: async (message: string): Promise<ChatResponse> => {
    const response = await axiosInstance.post<ChatResponse>("/ai/chat", {
      message,
      // Lets the assistant answer "launch X" honestly: hand it to the desktop app, or explain it can't from the web.
      client: { canLaunchGames: canLaunchGames(), ...pageContext() },
    });
    return response.data;
  },

  reset: async (): Promise<void> => {
    await axiosInstance.post("/ai/reset");
  },
};

export default aiApi;
